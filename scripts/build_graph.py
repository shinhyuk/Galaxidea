"""Lay out every embedded idea as one graph and write it as static files
for the home page.

Nothing here is sorted into categories by hand. Each idea is placed by what
its text means: ideas that mean similar things land close together, each is
joined to its nearest neighbours, and groups are whatever dense regions
appear.

Usage:
  python scripts/build_graph.py --out public/graph

Output (all positions and ids are by node index, in `items.id` order):
  graph.json    counts, build date, and the groups (label, color, centre)
  xy.bin        Uint16 pairs: x, y in 0..65535
  group.bin     Uint16 per node: index into groups, 65535 = in no group
  weight.bin    Uint8 per node: how many others have it as a neighbour
  edges.bin     Uint32 pairs: the two node indexes of each link
  names.json    name of every node, for search
  d/<n>.json    details of nodes n*1000 .. n*1000+999

Needs DATABASE_URL. Install scripts/requirements-graph.txt first.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

import numpy as np

from collect_github import connect, load_env_file, log

NO_GROUP = 65535
CHUNK = 1000
NEIGHBOURS = 6
LINKS_PER_NODE = 2

# Words that say nothing about what a group is about.
STOP_WORDS = set(
    """a an and are as at be by for from in into is it its of on or that the this to with your you
    using use used based via can more most all any new simple easy fast open source free tool tools
    library framework project app application apps written support supports build built make made
    like one two also not only other such than which will while method system device apparatus
    thereof wherein comprising includes including provided provides according present invention""".split()
)


def normalize(vectors: np.ndarray) -> np.ndarray:
    lengths = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.maximum(lengths, 1e-12)


def nearest_neighbours(unit: np.ndarray, k: int, step: int = 2000) -> np.ndarray:
    """Indexes of the k most similar other rows for every row, most similar
    first. `unit` must already be normalized."""
    count = len(unit)
    k = min(k, count - 1)
    result = np.empty((count, k), dtype=np.int32)
    for start in range(0, count, step):
        scores = unit[start : start + step] @ unit.T
        rows = np.arange(len(scores))
        scores[rows, start + rows] = -np.inf  # not its own neighbour
        top = np.argpartition(-scores, k - 1, axis=1)[:, :k]
        order = np.argsort(-scores[rows[:, None], top], axis=1)
        result[start : start + step] = top[rows[:, None], order]
    return result


def links_from(neighbours: np.ndarray, per_node: int) -> np.ndarray:
    """Each node joined to its closest few, every pair listed once."""
    pairs = set()
    for node, row in enumerate(neighbours):
        for other in row[:per_node]:
            pairs.add((min(node, int(other)), max(node, int(other))))
    return np.array(sorted(pairs), dtype=np.uint32).reshape(-1, 2)


def weights_from(neighbours: np.ndarray, per_node: int) -> np.ndarray:
    """How often each node is someone else's close neighbour, on a 0..255
    scale. The hubs of the graph get the high numbers."""
    counts = np.bincount(neighbours[:, :per_node].ravel(), minlength=len(neighbours))
    scaled = np.log1p(counts) / max(np.log1p(counts.max()), 1e-12)
    return np.round(scaled * 255).astype(np.uint8)


def quantize(points: np.ndarray, margin: float = 0.04) -> np.ndarray:
    """Fit 2D points into 0..65535 on both axes without stretching them."""
    low = points.min(axis=0)
    span = max((points.max(axis=0) - low).max(), 1e-12)
    centred = (points - low - (points.max(axis=0) - low) / 2) / span  # -0.5..0.5
    return np.round((centred * (1 - 2 * margin) + 0.5) * 65535).astype(np.uint16)


def words(text: str) -> list[str]:
    found = (
        word.strip(".-")
        for word in re.findall(r"[a-z][a-z0-9+#.-]{2,}|[가-힣]{2,}", text.lower())
    )
    return [word for word in found if len(word) > 1 and word not in STOP_WORDS]


def group_labels(texts: list[str], groups: np.ndarray, group_count: int, terms: int = 2) -> list[str]:
    """Name each group by the words that are common in it and uncommon in
    the others."""
    per_group = [Counter() for _ in range(group_count)]
    for text, group in zip(texts, groups):
        if group != NO_GROUP:
            per_group[group].update(set(words(text)))
    spread = Counter()
    for counter in per_group:
        spread.update(counter.keys())
    sizes = np.bincount(groups[groups != NO_GROUP], minlength=group_count)
    labels = []
    for index, counter in enumerate(per_group):
        scored = sorted(
            counter.items(),
            key=lambda item: -(item[1] / max(sizes[index], 1)) * np.log(group_count / spread[item[0]] + 1),
        )
        labels.append(" · ".join(word for word, _ in scored[:terms]))
    return labels


def group_color(index: int) -> str:
    """Evenly spread hues, so neighbouring group numbers look different."""
    return f"hsl({(index * 137.508) % 360:.0f} 72% 66%)"


def load_items() -> tuple[list[tuple], np.ndarray]:
    rows = []
    vectors = []
    with connect() as conn:
        with conn.cursor(name="graph") as cur:
            cur.itersize = 2000
            cur.execute(
                "select id, source, name, one_liner, url, launched_at, embedding::text "
                "from items where embedding is not null order by id"
            )
            for *row, embedding in cur:
                rows.append(tuple(row))
                vectors.append(np.array(json.loads(embedding), dtype=np.float32))
    return rows, np.vstack(vectors) if vectors else np.empty((0, 0), dtype=np.float32)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", default="public/graph")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parent.parent
    load_env_file(root / ".env.local")

    rows, vectors = load_items()
    count = len(rows)
    if count < 50:
        raise SystemExit(f"only {count} embedded items; not enough to lay out")
    log(f"loaded {count} items")

    unit = normalize(vectors)
    neighbours = nearest_neighbours(unit, NEIGHBOURS)
    links = links_from(neighbours, LINKS_PER_NODE)
    log(f"{len(links)} links")

    import umap
    from sklearn.cluster import HDBSCAN

    layout = umap.UMAP(
        n_neighbors=15, min_dist=0.3, metric="cosine", random_state=42
    ).fit_transform(unit)
    xy = quantize(layout)
    log("layout done")

    # "leaf" keeps the small dense clumps instead of merging them into a
    # few continents, which is what the eye sees in the layout.
    found = HDBSCAN(
        min_cluster_size=max(10, count // 700), min_samples=5, cluster_selection_method="leaf"
    ).fit_predict(layout)
    # Biggest group first, so group 0 is the largest.
    by_size = [g for g, _ in Counter(found[found >= 0].tolist()).most_common()]
    rank = {group: index for index, group in enumerate(by_size)}
    groups = np.array([rank.get(int(g), NO_GROUP) for g in found], dtype=np.uint16)
    texts = [f"{name.rsplit('/', 1)[-1]} {one_liner}" for _, _, name, one_liner, _, _ in rows]
    labels = group_labels(texts, groups, len(by_size))
    log(f"{len(by_size)} groups, {int((groups == NO_GROUP).sum())} items in none")

    out = (root / args.out).resolve()
    (out / "d").mkdir(parents=True, exist_ok=True)
    for stale in (out / "d").glob("*.json"):
        stale.unlink()
    xy.tofile(out / "xy.bin")
    groups.tofile(out / "group.bin")
    weights_from(neighbours, LINKS_PER_NODE).tofile(out / "weight.bin")
    links.tofile(out / "edges.bin")
    (out / "names.json").write_text(
        json.dumps([row[2] for row in rows], ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    for start in range(0, count, CHUNK):
        details = [
            [source, name, one_liner, url, launched_at.year if launched_at else None]
            for _, source, name, one_liner, url, launched_at in rows[start : start + CHUNK]
        ]
        (out / "d" / f"{start // CHUNK}.json").write_text(
            json.dumps(details, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    sources = Counter(row[1] for row in rows)
    meta = {
        "count": count,
        "links": int(len(links)),
        "built": date.today().isoformat(),
        "sources": dict(sources),
        "chunk": CHUNK,
        "groups": [
            {
                "label": labels[index],
                "color": group_color(index),
                "size": int((groups == index).sum()),
                "x": int(np.median(xy[groups == index, 0])),
                "y": int(np.median(xy[groups == index, 1])),
            }
            for index in range(len(by_size))
        ],
    }
    (out / "graph.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")

    # The same positions go into the database, so a new question can be
    # placed next to the items it resembles.
    placed = [
        (int(xy[i, 0]), int(xy[i, 1]), labels[groups[i]] if groups[i] != NO_GROUP else None, rows[i][0])
        for i in range(count)
    ]
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("create temp table placed (gx integer, gy integer, graph_group text, id bigint)")
            with cur.copy("copy placed (gx, gy, graph_group, id) from stdin") as copy:
                for row in placed:
                    copy.write_row(row)
            cur.execute(
                "update items set gx = placed.gx, gy = placed.gy, graph_group = placed.graph_group "
                "from placed where items.id = placed.id"
            )
        conn.commit()
    log(f"done: wrote {count} nodes to {out}")


if __name__ == "__main__":
    main()

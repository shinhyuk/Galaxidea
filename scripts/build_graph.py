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
  region.bin    Uint8 per node: index into regions (the dozen large areas)
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
REGIONS = 11
# Bright, well separated colors for the large areas, as "r,g,b".
REGION_COLORS = [
    "255,170,80", "190,120,255", "90,225,165", "100,165,255", "255,120,200", "255,205,90",
    "160,230,100", "110,220,255", "150,130,255", "255,140,120", "120,240,220", "230,160,255",
]
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


def recent_share(years: np.ndarray, members: np.ndarray, since: int) -> float:
    """Share of a set of items that appeared in `since` or later."""
    return float((years[members] >= since).mean()) if members.any() else 0.0


def describe(xy: np.ndarray, groups: np.ndarray, years: np.ndarray, texts: list[str], this_year: int) -> dict:
    """Everything the page shows besides the dots: the large regions, how
    recent each region and group is compared with the whole, and how many
    items appeared each year. Works from positions alone, so it can be
    recomputed for an existing graph without the embeddings."""
    from sklearn.cluster import KMeans

    count = len(xy)
    since = this_year - 1
    overall = max(recent_share(years, np.ones(count, dtype=bool), since), 1e-9)

    found = KMeans(n_clusters=min(REGIONS, count), n_init=10, random_state=42).fit_predict(xy.astype(np.float32))
    by_size = [r for r, _ in Counter(found.tolist()).most_common()]
    rank = {region: index for index, region in enumerate(by_size)}
    regions = np.array([rank[int(r)] for r in found], dtype=np.uint8)
    names = group_labels(texts, regions.astype(np.uint16), len(by_size), terms=2)
    region_info = []
    for index in range(len(by_size)):
        members = regions == index
        centre = np.median(xy[members], axis=0)
        spread = float(np.median(np.linalg.norm(xy[members] - centre, axis=1)))
        share = recent_share(years, members, since)
        region_info.append({
            "label": names[index],
            "color": REGION_COLORS[index % len(REGION_COLORS)],
            "size": int(members.sum()),
            "x": int(centre[0]),
            "y": int(centre[1]),
            "spread": int(spread),
            "recent": round(share, 3),
            "lift": round(share / overall, 2),
        })

    group_recent = []
    for index in range(int(groups[groups != NO_GROUP].max()) + 1 if (groups != NO_GROUP).any() else 0):
        share = recent_share(years, groups == index, since)
        group_recent.append({"recent": round(share, 3), "lift": round(share / overall, 2)})

    known = years[years > 0]
    first = max(int(known.min()), this_year - 14) if len(known) else this_year
    per_year = {str(year): int((years == year).sum()) for year in range(first, this_year + 1)}
    return {
        "regions": region_info,
        "region_of": regions,
        "group_recent": group_recent,
        "years": per_year,
        "since": since,
        "recent": round(overall, 3),
    }


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


def refresh(out: Path) -> None:
    meta = json.loads((out / "graph.json").read_text(encoding="utf-8"))
    xy = np.fromfile(out / "xy.bin", dtype=np.uint16).reshape(-1, 2)
    groups = np.fromfile(out / "group.bin", dtype=np.uint16)
    details = []
    for chunk in range((meta["count"] + CHUNK - 1) // CHUNK):
        details += json.loads((out / "d" / f"{chunk}.json").read_text(encoding="utf-8"))
    years = np.array([row[4] or 0 for row in details], dtype=np.int32)
    texts = [f"{row[1].rsplit('/', 1)[-1]} {row[2]}" for row in details]
    extra = describe(xy, groups, years, texts, int(meta["built"][:4]))
    extra["region_of"].tofile(out / "region.bin")
    meta.update(since=extra["since"], recent=extra["recent"], years=extra["years"], regions=extra["regions"])
    for group, recent in zip(meta["groups"], extra["group_recent"]):
        group.update(recent)
    (out / "graph.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"refreshed {out}: " + ", ".join(r["label"] for r in extra["regions"]))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", default="public/graph")
    parser.add_argument(
        "--refresh", action="store_true",
        help="recompute regions and statistics for the files already in --out, without the database",
    )
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parent.parent
    load_env_file(root / ".env.local")
    if args.refresh:
        refresh((root / args.out).resolve())
        return

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
    years = np.array([row[5].year if row[5] else 0 for row in rows], dtype=np.int32)
    extra = describe(xy, groups, years, texts, date.today().year)
    extra["region_of"].tofile(out / "region.bin")
    log(f"{len(extra['regions'])} regions: " + ", ".join(r["label"] for r in extra["regions"]))
    sources = Counter(row[1] for row in rows)
    meta = {
        "count": count,
        "links": int(len(links)),
        "built": date.today().isoformat(),
        "sources": dict(sources),
        "chunk": CHUNK,
        "since": extra["since"],
        "recent": extra["recent"],
        "years": extra["years"],
        "regions": extra["regions"],
        "groups": [
            {
                "label": labels[index],
                "color": group_color(index),
                "size": int((groups == index).sum()),
                "x": int(np.median(xy[groups == index, 0])),
                "y": int(np.median(xy[groups == index, 1])),
                **extra["group_recent"][index],
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

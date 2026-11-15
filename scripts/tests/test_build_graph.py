import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_graph as bg  # noqa: E402


def two_clumps() -> np.ndarray:
    rng = np.random.default_rng(1)
    a = rng.normal([1, 0, 0], 0.05, (20, 3))
    b = rng.normal([0, 1, 0], 0.05, (20, 3))
    return bg.normalize(np.vstack([a, b]).astype(np.float32))


def test_nearest_neighbours_stay_inside_their_clump_and_skip_self():
    unit = two_clumps()
    near = bg.nearest_neighbours(unit, 4, step=7)  # small step exercises chunking
    assert near.shape == (40, 4)
    for node, row in enumerate(near):
        assert node not in row
        assert all((other < 20) == (node < 20) for other in row)
    # Most similar first.
    scores = unit[0] @ unit[near[0]].T
    assert list(scores) == sorted(scores, reverse=True)


def test_links_list_each_pair_once():
    near = np.array([[1, 2], [0, 2], [0, 1]], dtype=np.int32)
    links = bg.links_from(near, 1)
    assert links.tolist() == [[0, 1], [0, 2]]
    assert links.dtype == np.uint32


def test_weights_mark_the_hub():
    near = np.array([[1, 2], [0, 2], [0, 1], [0, 1]], dtype=np.int32)
    weights = bg.weights_from(near, 1)
    assert weights[0] == 255 and weights[3] == 0
    assert weights.dtype == np.uint8


def test_quantize_keeps_proportions_inside_the_range():
    points = np.array([[0.0, 0.0], [10.0, 0.0], [10.0, 5.0]])
    xy = bg.quantize(points, margin=0.0)
    assert xy.min() >= 0 and xy.max() <= 65535
    width = int(xy[1, 0]) - int(xy[0, 0])
    height = int(xy[2, 1]) - int(xy[1, 1])
    assert abs(width - 2 * height) <= 2  # 10 wide, 5 tall
    assert xy.dtype == np.uint16


def test_words_drop_filler_and_keep_korean():
    assert bg.words("A fast React framework for 터미널 검색") == ["react", "터미널", "검색"]


def test_group_labels_pick_what_sets_a_group_apart():
    texts = ["react component library", "react hooks state", "rust compiler tool", "rust parser crate"]
    groups = np.array([0, 0, 1, bg.NO_GROUP], dtype=np.uint16)
    labels = bg.group_labels(texts, groups, 2, terms=1)
    assert labels == ["react", "rust"] or labels[0] == "react"

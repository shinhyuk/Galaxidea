import re
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import collect_github as cg  # noqa: E402


def repo(repo_id: int, stars: int, created: str = "2020-01-01", **extra) -> dict:
    return {
        "id": repo_id,
        "full_name": f"owner/repo{repo_id}",
        "description": f"Description {repo_id}",
        "html_url": f"https://github.com/owner/repo{repo_id}",
        "created_at": f"{created}T00:00:00Z",
        "archived": False,
        "stargazers_count": stars,
        **extra,
    }


class FakeGitHub:
    """Answers search queries from an in-memory list, with the real cap."""

    def __init__(self, repos: list[dict]):
        self.repos = repos
        self.queries: list[str] = []

    def search(self, query: str) -> tuple[int, list[dict]]:
        self.queries.append(query)
        matches = self.repos
        if m := re.search(r"stars:>=(\d+)", query):
            matches = [r for r in matches if r["stargazers_count"] >= int(m[1])]
        if m := re.search(r"stars:(\d+)\.\.(\d+)", query):
            lo, hi = int(m[1]), int(m[2])
            matches = [r for r in matches if lo <= r["stargazers_count"] <= hi]
        if m := re.search(r"created:(\S+)\.\.(\S+)", query):
            matches = [r for r in matches if m[1] <= r["created_at"][:10] <= m[2]]
        matches = sorted(matches, key=lambda r: -r["stargazers_count"])
        return len(matches), matches[: cg.SEARCH_CAP]


def collected_ids(fake: FakeGitHub, min_stars: int = 50) -> list[int]:
    windows = cg.iter_repo_windows(fake.search, min_stars, today=date(2026, 1, 1))
    return [r["id"] for window in windows for r in window]


def test_build_query():
    assert cg.build_query(50) == "stars:>=50"
    assert cg.build_query(50, 900) == "stars:50..900"
    assert (
        cg.build_query(70, 70, (date(2020, 1, 1), date(2020, 6, 30)), date(2026, 11, 1))
        == "stars:70..70 created:2020-01-01..2020-06-30 pushed:>=2026-11-01"
    )


def test_small_result_needs_one_query():
    fake = FakeGitHub([repo(i, 50 + i) for i in range(10)] + [repo(99, 10)])
    assert sorted(collected_ids(fake)) == list(range(10))
    assert len(fake.queries) == 1


def test_walks_past_the_search_cap_highest_stars_first():
    fake = FakeGitHub([repo(i, 50 + i) for i in range(3500)])
    ids = collected_ids(fake)
    assert set(ids) == set(range(3500))
    assert ids[0] == 3499
    # Windows overlap only at their boundary star count.
    assert len(ids) - len(set(ids)) <= len(fake.queries)


def test_star_count_shared_by_more_than_the_cap_is_split_by_date():
    plateau = [
        repo(i, 70, created=f"20{10 + i % 10}-{1 + i % 12:02d}-{1 + i % 28:02d}")
        for i in range(2500)
    ]
    above = [repo(10_000 + i, 100 + i) for i in range(1200)]
    below = [repo(20_000 + i, 50 + i % 20) for i in range(300)]
    fake = FakeGitHub(plateau + above + below)
    assert set(collected_ids(fake)) == {r["id"] for r in plateau + above + below}
    assert any("created:" in q for q in fake.queries)


def test_repo_to_item():
    item = cg.repo_to_item(
        repo(7, 123, description="  A  tool\nfor   things ", archived=True)
    )
    assert item == {
        "source": "github",
        "source_id": "7",
        "name": "owner/repo7",
        "one_liner": "A tool for things",
        "url": "https://github.com/owner/repo7",
        "launched_at": "2020-01-01T00:00:00Z",
        "status": "archived",
    }


@pytest.mark.parametrize("description", [None, "", "   \n "])
def test_repo_without_description_is_skipped(description):
    assert cg.repo_to_item(repo(1, 60, description=description)) is None


def test_long_description_is_cut():
    item = cg.repo_to_item(repo(1, 60, description="x" * 2000))
    assert len(item["one_liner"]) == cg.ONE_LINER_MAX


def test_embedding_text_drops_owner_for_repositories_only():
    assert cg.embedding_text("github", "vercel/next.js", "The React Framework") == (
        "next.js: The React Framework"
    )
    assert cg.embedding_text("patent", "A/B test device", "Compares two variants") == (
        "A/B test device: Compares two variants"
    )


def test_take_batch_respects_item_and_token_limits():
    short = ["ab"] * 10
    assert cg.take_batch(short, 4, 1000) == 4
    assert cg.take_batch(short, 100, 1000) == 10
    long = ["x" * 200] * 10  # about 101 tokens each
    assert cg.take_batch(long, 100, 250) == 2
    assert cg.take_batch(["x" * 5000], 100, 250) == 1


def test_vector_literal():
    assert cg.vector_literal([1, -0.5, 2e-05]) == "[1.0,-0.5,2e-05]"


def test_parse_embeddings_restores_input_order():
    body = {
        "data": [
            {"index": 1, "embedding": [0.0, 1.0]},
            {"index": 0, "embedding": [1.0, 0.0]},
        ]
    }
    assert cg.parse_embeddings(body, 2, 2) == [[1.0, 0.0], [0.0, 1.0]]


def test_parse_embeddings_rejects_wrong_dimension():
    body = {"data": [{"index": 0, "embedding": [1.0, 0.0, 0.0]}]}
    with pytest.raises(RuntimeError, match="dimensions"):
        cg.parse_embeddings(body, 1, 1024)


def test_parse_embeddings_rejects_wrong_count():
    body = {"data": [{"index": 0, "embedding": [1.0]}]}
    with pytest.raises(RuntimeError, match="1 vectors for 2 inputs"):
        cg.parse_embeddings(body, 2, 1)


def test_load_env_file_does_not_override(tmp_path, monkeypatch):
    env_file = tmp_path / ".env.local"
    env_file.write_text('# comment\nGX_A=from_file\nGX_B="quoted value"\n\nnot a line\n')
    monkeypatch.setenv("GX_A", "from_env")
    monkeypatch.delenv("GX_B", raising=False)
    cg.load_env_file(env_file)
    import os

    assert os.environ["GX_A"] == "from_env"
    assert os.environ["GX_B"] == "quoted value"
    monkeypatch.delenv("GX_B")


def test_database_url_is_tidied():
    assert cg.database_url(' "postgresql://u:p@h:5432/db"\n') == "postgresql://u:p@h:5432/db"


@pytest.mark.parametrize(
    "value", ["just-a-password", "host: example.com", "postgresql://u:[YOUR-PASSWORD]@h/db"]
)
def test_database_url_rejects_non_urls(value):
    with pytest.raises(SystemExit):
        cg.database_url(value)

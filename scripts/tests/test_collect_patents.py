import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import collect_patents as cp  # noqa: E402
import migrate  # noqa: E402


def test_domain_for_uses_any_code_and_the_first_matching_domain():
    assert cp.domain_for(["G06N3/08"]) == "ai"
    assert cp.domain_for(["H04L9/32", "G06Q20/38"]) == "finance"
    assert cp.domain_for(["A61B5/00"]) == "health"
    # Narrow fields win over broad ones when a patent carries both.
    assert cp.domain_for(["A61B5/00", "G06N20/00"]) == "ai"
    assert cp.domain_for(["B60L53/00", "Y02T10/70"]) == "mobility"
    assert cp.domain_for(["H01L21/02"]) is None
    assert cp.domain_for([]) is None


def test_query_covers_every_domain_and_prefix():
    query = cp.build_query()
    for domain, prefixes in cp.DOMAIN_CPC.items():
        assert f"then '{domain}'" in query
        for prefix in prefixes:
            assert f"starts_with(c.code, '{prefix}')" in query
    assert "@since" in query and "@per_domain" in query and "@per_bucket" in query
    # Nothing that would stop BigQuery from answering a repeat from cache.
    assert "rand(" not in query.lower() and "current_" not in query.lower()


def test_domains_match_the_migration():
    seeded = (Path(cp.__file__).resolve().parent.parent / "db/migrations/004_domains.sql").read_text()
    for domain in cp.DOMAIN_CPC:
        assert f"('{domain}'," in seeded


def test_row_to_item():
    item = cp.row_to_item(
        {
            "publication_number": "US-2023012345-A1",
            "publication_date": 20230105,
            "title": "  Sleep  monitoring\ndevice ",
            "abstract": "A device that " + "x" * 600,
            "lang": "en",
            "domain": "health",
        }
    )
    assert item["source"] == "patent"
    assert item["source_id"] == "US-2023012345-A1"
    assert item["name"] == "Sleep monitoring device"
    assert len(item["one_liner"]) == cp.ONE_LINER_MAX
    assert item["url"] == "https://patents.google.com/patent/US2023012345A1"
    assert item["launched_at"] == "2023-01-05"
    assert item["lang"] == "en"
    assert item["domain_id"] == "health"


def test_row_without_text_is_skipped():
    assert cp.row_to_item({"publication_number": "X", "title": "", "abstract": "a"}) is None
    assert cp.row_to_item({"publication_number": "X", "title": "t", "abstract": None}) is None


def test_iso_date():
    assert cp.iso_date(20240229) == "2024-02-29"
    assert cp.iso_date(0) is None
    assert cp.iso_date(None) is None


def test_pending_migrations_are_ordered_and_skip_applied():
    available = ["003_c.sql", "001_a.sql", "002_b.sql"]
    assert migrate.pending(available, {"001_a.sql"}) == ["002_b.sql", "003_c.sql"]
    assert migrate.pending(available, set(available)) == []

"""Load a balanced sample of worldwide patents into `items`.

Source: the Google Patents Public Datasets table on BigQuery, which covers
patent offices around the world. One query picks recent publications, sorts
them into the nine domains by their CPC classification, keeps one
publication per patent family and takes the same number from each domain,
so no field crowds out the others.

Usage:
  python scripts/collect_patents.py --per-domain 10000
  python scripts/collect_patents.py --dry-run     # only report the query size

Needs DATABASE_URL and GCP_SA_KEY (the JSON of a Google Cloud service account
that may run BigQuery jobs). The query reads a few hundred gigabytes; the
free allowance is one terabyte a month, and `--max-gb` refuses anything
larger than expected before it runs. BigQuery answers an identical query
from its cache for a day, so a second run on the same day reads nothing.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from collect_github import clean_text, connect, load_env_file, log, required_env

SOURCE = "patent"
TABLE = "patents-public-data.patents.publications"
NAME_MAX = 200
ONE_LINER_MAX = 500
ABSTRACT_MIN = 80
BUCKETS = 64

# CPC prefixes for each domain. A patent goes to the first domain in this
# order that any of its codes matches, so the narrow fields come before the
# broad ones.
DOMAIN_CPC: dict[str, list[str]] = {
    "ai": ["G06N", "G06V", "G10L", "G06F40"],
    "finance": ["G06Q20", "G06Q40"],
    "edu": ["G09B"],
    "play": ["A63", "G10H", "H04N21"],
    "food": ["A23", "A21", "A01", "C12G"],
    "climate": ["Y02E", "Y02B", "Y02W", "Y02A", "Y02C", "H02S", "F03D", "F24S"],
    "mobility": ["B60", "B62", "B64", "B25J", "G05D"],
    "health": ["A61", "G16H"],
    "life": ["G06Q30", "G06Q50", "A47", "A45", "A41", "A43"],
}


def domain_for(codes: list[str]) -> str | None:
    """Python twin of the CASE expression in the query, used in tests."""
    for domain, prefixes in DOMAIN_CPC.items():
        if any(code.startswith(prefix) for code in codes for prefix in prefixes):
            return domain
    return None


def domain_case_sql() -> str:
    branches = []
    for domain, prefixes in DOMAIN_CPC.items():
        tests = " or ".join(f"starts_with(c.code, '{prefix}')" for prefix in prefixes)
        branches.append(
            f"      when exists (select 1 from unnest(cpc) as c where {tests}) then '{domain}'"
        )
    return "case\n" + "\n".join(branches) + "\n    end"


def localized_sql(column: str, field: str) -> str:
    """English text if there is one, otherwise whatever language is first."""
    return (
        f"coalesce((select t.{field} from unnest({column}) as t where t.language = 'en' limit 1), "
        f"(select t.{field} from unnest({column}) as t limit 1))"
    )


def build_query() -> str:
    # Sampling goes in three passes so no single sort is huge: a few per
    # (domain, bucket), then one per family, then the final cut per domain.
    return f"""
with tagged as (
  select
    publication_number,
    family_id,
    publication_date,
    {localized_sql("title_localized", "text")} as title,
    {localized_sql("abstract_localized", "text")} as abstract,
    {localized_sql("abstract_localized", "language")} as lang,
    {domain_case_sql()} as domain,
    farm_fingerprint(publication_number) as pick
  from `{TABLE}`
  where publication_date >= @since
),
usable as (
  select * from tagged
  where domain is not null and title is not null and length(abstract) >= {ABSTRACT_MIN}
),
thinned as (
  select * from usable
  qualify row_number() over (
    partition by domain, mod(abs(pick), {BUCKETS}) order by pick
  ) <= @per_bucket
),
families as (
  select * from thinned
  qualify row_number() over (
    partition by family_id order by if(lang = 'en', 0, 1), publication_date
  ) = 1
)
select publication_number, publication_date, title, abstract, lang, domain
from families
qualify row_number() over (partition by domain order by pick) <= @per_domain
"""


def patent_url(publication_number: str) -> str:
    return f"https://patents.google.com/patent/{publication_number.replace('-', '')}"


def iso_date(value: int | None) -> str | None:
    """20230105 → "2023-01-05"."""
    text = str(value or "")
    if len(text) != 8 or not text.isdigit():
        return None
    return f"{text[:4]}-{text[4:6]}-{text[6:]}"


def row_to_item(row: dict) -> dict | None:
    name = clean_text(row.get("title"))[:NAME_MAX].strip()
    one_liner = clean_text(row.get("abstract"))[:ONE_LINER_MAX].strip()
    if not name or not one_liner or not row.get("publication_number"):
        return None
    return {
        "source": SOURCE,
        "source_id": row["publication_number"],
        "name": name,
        "one_liner": one_liner,
        "url": patent_url(row["publication_number"]),
        "launched_at": iso_date(row.get("publication_date")),
        "status": "published",
        "lang": row.get("lang") or None,
        "domain_id": row.get("domain"),
    }


# A changed title or abstract clears the embedding so `embed` redoes it.
UPSERT_SQL = """
insert into items (source, source_id, name, one_liner, url, launched_at, status, lang, domain_id)
values (%(source)s, %(source_id)s, %(name)s, %(one_liner)s, %(url)s,
        %(launched_at)s, %(status)s, %(lang)s, %(domain_id)s)
on conflict (source, source_id) do update set
  name = excluded.name,
  one_liner = excluded.one_liner,
  url = excluded.url,
  launched_at = excluded.launched_at,
  status = excluded.status,
  lang = excluded.lang,
  domain_id = excluded.domain_id,
  embedding = case
    when items.name = excluded.name and items.one_liner = excluded.one_liner
      then items.embedding
    else null
  end
"""


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--per-domain", type=int, default=10000)
    parser.add_argument("--since", type=int, default=20220101, help="earliest publication date, YYYYMMDD")
    parser.add_argument("--max-gb", type=int, default=600, help="refuse a query that would read more than this")
    parser.add_argument("--dry-run", action="store_true", help="report the query size and stop")
    args = parser.parse_args(argv)
    load_env_file(Path(__file__).resolve().parent.parent / ".env.local")

    from google.cloud import bigquery

    try:
        key = json.loads(required_env("GCP_SA_KEY"))
    except json.JSONDecodeError:
        raise SystemExit("GCP_SA_KEY must be the whole JSON key file of a service account")
    client = bigquery.Client.from_service_account_info(key)
    parameters = [
        bigquery.ScalarQueryParameter("since", "INT64", args.since),
        bigquery.ScalarQueryParameter("per_domain", "INT64", args.per_domain),
        # Three times what is needed, spread over the buckets, to survive
        # the one-per-family pass.
        bigquery.ScalarQueryParameter("per_bucket", "INT64", args.per_domain * 3 // BUCKETS + 1),
    ]
    query = build_query()

    probe = client.query(
        query, job_config=bigquery.QueryJobConfig(query_parameters=parameters, dry_run=True, use_query_cache=False)
    )
    gigabytes = probe.total_bytes_processed / 1e9
    log(f"query would read {gigabytes:.0f} GB (free allowance: 1,000 GB a month)")
    if gigabytes > args.max_gb:
        raise SystemExit(f"that is more than --max-gb {args.max_gb}; not running it")
    if args.dry_run:
        return

    job = client.query(
        query,
        job_config=bigquery.QueryJobConfig(
            query_parameters=parameters, maximum_bytes_billed=int(args.max_gb * 1e9)
        ),
    )
    counts: dict[str, int] = {}
    skipped = 0
    batch: list[dict] = []
    with connect() as conn:

        def flush() -> None:
            with conn.cursor() as cur:
                cur.executemany(UPSERT_SQL, batch)
            conn.commit()
            batch.clear()

        for row in job.result(page_size=5000):
            item = row_to_item(dict(row))
            if item is None:
                skipped += 1
                continue
            counts[item["domain_id"]] = counts.get(item["domain_id"], 0) + 1
            batch.append(item)
            if len(batch) >= 1000:
                flush()
                log(f"collected {sum(counts.values())}")
        if batch:
            flush()

    read = "from cache" if job.cache_hit else f"{(job.total_bytes_billed or 0) / 1e9:.0f} GB billed"
    log(f"done: {sum(counts.values())} patents upserted, {skipped} skipped ({read})")
    for domain in DOMAIN_CPC:
        log(f"  {domain}: {counts.get(domain, 0)}")


if __name__ == "__main__":
    main()

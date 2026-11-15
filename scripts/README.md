# scripts

Python batch jobs. Use official APIs and public datasets only. Do not scrape search engine results or social sites.

```bash
pip install -r scripts/requirements.txt
python -m pytest scripts/tests
```

Scripts read `DATABASE_URL`, `GITHUB_TOKEN` and `EMBED_*` from the environment, falling back to `.env.local`.

## migrate.py

Applies the files in `db/migrations` that the database has not seen yet and records them in `schema_migrations`. Run it after `docker compose up -d` and whenever a migration is added. On a database whose tables were created by hand before this script existed, it marks `001` and `002` as already applied.

```bash
python scripts/migrate.py
```

## collect_github.py

```bash
python scripts/collect_github.py collect --limit 10000   # top 10,000 by stars
python scripts/collect_github.py collect --min-stars 2000
python scripts/collect_github.py collect --since 2026-11-12   # daily increment: pushed since that day
```

- Only repositories with 50+ stars (`--min-stars`) and a non-empty description are stored. Forks are excluded by GitHub search itself.
- The search API returns at most 1,000 results per query and allows 30 queries a minute, so the script walks down by star count and, where more than 1,000 repositories share one star count, by creation date. 10,000 repositories take about 7 minutes.
- Column mapping: `source_id` = repository id, `name` = `owner/repo`, `one_liner` = description (whitespace collapsed, cut at 500 characters), `launched_at` = repository creation time, `status` = `active` or `archived`. `lang` and `domain_id` are left empty.

## collect_patents.py

```bash
python scripts/collect_patents.py --dry-run          # report the query size only
python scripts/collect_patents.py --per-domain 10000
```

- Source: Google Patents Public Datasets on BigQuery (`patents-public-data.patents.publications`), worldwide. Needs `GCP_SA_KEY`, the JSON key of a service account that may run BigQuery jobs.
- Publications since `--since` (default 2022-01-01) are sorted into the nine domains by CPC code (`DOMAIN_CPC` in the script), reduced to one per patent family, and the same number is taken from each domain.
- The query reads a few hundred gigabytes of the one terabyte a month that BigQuery gives for free. The script checks the size first and refuses anything above `--max-gb` (default 600). An identical query on the same day is answered from cache and reads nothing.
- Column mapping: `source_id` = publication number, `name` = title, `one_liner` = abstract (cut at 500 characters, English when available), `launched_at` = publication date, `status` = `published`, `lang` = language of the abstract, `domain_id` = domain from the CPC code.
- Not yet run against BigQuery: the query and the row mapping are covered by unit tests only.

## Embedding

```bash
python scripts/collect_github.py embed                    # every item without an embedding
python scripts/collect_github.py embed --max-minutes 300   # stop cleanly after five hours
```

- Works on all sources. It sends `"<name>: <text>"` to `EMBED_BASE_URL/embeddings` (OpenAI-compatible) and stops with an error if the returned dimension differs from `EMBED_DIM` (512).
- With Voyage: `EMBED_BASE_URL=https://ai.mongodb.com/v1`, `EMBED_MODEL=voyage-4`, `EMBED_DIM_PARAM=output_dimension`, `EMBED_INPUT_TYPE=document`. Questions must later be embedded with `input_type` `query`.
- A changed name or text clears an item's embedding, so the next run redoes it.
- When the provider answers 429 the script waits and retries. A Voyage key without a payment method is limited to 3 requests and 10,000 tokens a minute; requests are kept under `--max-batch-tokens` (8,000 estimated) for that reason.

## build_graph.py

```bash
pip install -r scripts/requirements-graph.txt
python scripts/build_graph.py --out public/graph
```

- Lays out every embedded item as one graph for the home page. Nothing is sorted into categories by hand: UMAP places each item by its embedding, each item is linked to its two nearest neighbours, and groups are the dense clumps HDBSCAN finds in the layout. A group is named by the two words that are common in it and uncommon elsewhere.
- Writes static files to `public/graph` (positions, groups, links, names for search, details in chunks of 1,000). The site reads only these files, not the database.
- The "Build graph" workflow runs this against the hosted database and commits the result to `main`.
- The files in the repository now come from 2,000 repositories embedded on a development machine; running the workflow replaces them with the full set.

## weekly.py (M4)

Not implemented yet: recluster, compute 2D coordinates, growth scores and empty areas.

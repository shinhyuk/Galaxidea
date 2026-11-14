# scripts

Python batch jobs. Use official APIs and public datasets only. Do not scrape search engine results or social sites.

```bash
pip install -r scripts/requirements.txt
python -m pytest scripts/tests
```

Scripts read `DATABASE_URL`, `GITHUB_TOKEN` and `EMBED_*` from the environment, falling back to `.env.local`.

## collect_github.py (M2)

Two steps, both safe to re-run.

```bash
# 1. Search GitHub and upsert into items (embedding left empty)
python scripts/collect_github.py collect --limit 10000   # top 10,000 by stars
python scripts/collect_github.py collect                 # everything with 50+ stars
python scripts/collect_github.py collect --since 2026-11-12   # daily increment: pushed since that day

# 2. Embed every github item that has no embedding yet
python scripts/collect_github.py embed
```

- Only repositories with 50+ stars (`--min-stars`) and a non-empty description are stored. Forks are excluded by GitHub search itself.
- The search API returns at most 1,000 results per query and allows 30 queries a minute, so the script walks down by star count and, where more than 1,000 repositories share one star count, by creation date. 10,000 repositories take about 7 minutes. A full load (about 850,000 repositories as of 2026-11) takes many hours.
- Column mapping: `source_id` = repository id, `name` = `owner/repo`, `one_liner` = description (whitespace collapsed, cut at 500 characters), `launched_at` = repository creation time, `status` = `active` or `archived`. `lang` is left empty.
- When a repository's name or description changes, its embedding is cleared so the next `embed` run redoes it.
- `embed` sends `"<repo name>: <description>"` to `EMBED_BASE_URL/embeddings` (OpenAI-compatible) and stops with an error if the returned dimension differs from `EMBED_DIM`.
- With Voyage (`EMBED_BASE_URL=https://ai.mongodb.com/v1`, `EMBED_MODEL=voyage-4`) set `EMBED_INPUT_TYPE=document`. Questions must later be embedded with `input_type` `query`.
- When the provider answers 429 the script waits and retries. A Voyage key without a payment method is limited to 3 requests and 10,000 tokens a minute; use `--batch-size 100` there, which loads about 300 items a minute.

## weekly.py (M4)

Not implemented yet: recluster, compute 2D coordinates, growth scores and empty areas.

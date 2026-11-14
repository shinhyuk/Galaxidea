# scripts

Python batch jobs live here. Nothing is implemented yet.

- `collect_github.py` (M2): load repositories with 50+ stars and a description through the official GitHub API, embed them, and upsert into `items`.
- `weekly.py` (M4): recluster, compute 2D coordinates, growth scores and empty areas.

Use official APIs and public datasets only. Do not scrape search engine results or social sites.

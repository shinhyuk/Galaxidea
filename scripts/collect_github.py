"""Load GitHub repositories into `items` and embed them.

Two independent steps, both safe to re-run:

  collect  Search the official GitHub API for repositories with enough stars
           and a description, highest stars first, and upsert them into
           `items` with `embedding` left null.
  embed    Fill `embedding` for every item that has none, whatever its
           source.

Usage:
  python scripts/collect_github.py collect --limit 10000
  python scripts/collect_github.py embed
  python scripts/collect_github.py collect --since 2026-11-12   # daily increment

Configuration comes from the environment, falling back to `.env.local` in the
repository root: DATABASE_URL, GITHUB_TOKEN, EMBED_BASE_URL, EMBED_API_KEY,
EMBED_MODEL, EMBED_DIM, and optionally EMBED_INPUT_TYPE and EMBED_DIM_PARAM.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from collections.abc import Callable, Iterator
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

SOURCE = "github"
GITHUB_API = "https://api.github.com"
# The search API returns at most this many results for one query, so larger
# result sets have to be cut into windows.
SEARCH_CAP = 1000
PER_PAGE = 100
FIRST_REPO_DATE = date(2008, 1, 1)
ONE_LINER_MAX = 500

# (total_count, repositories). total_count is what GitHub reports for the whole
# query; the list holds at most SEARCH_CAP of them, highest stars first.
SearchFn = Callable[[str], tuple[int, list[dict]]]


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


# --- configuration ---------------------------------------------------------


def load_env_file(path: Path) -> None:
    """Read KEY=VALUE lines into os.environ without overriding what is set."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Missing environment variable: {name}")
    return value


# --- GitHub search ---------------------------------------------------------


class GitHubSearch:
    """Repository search with rate-limit handling and retries."""

    def __init__(self, token: str, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "galaxidea-collector",
            }
        )

    def _get_page(self, query: str, page: int) -> dict:
        params = {
            "q": query,
            "sort": "stars",
            "order": "desc",
            "per_page": PER_PAGE,
            "page": page,
        }
        for attempt in range(6):
            try:
                response = self.session.get(
                    f"{GITHUB_API}/search/repositories", params=params, timeout=30
                )
            except requests.RequestException as error:
                wait = 2**attempt
                log(f"  network error ({error}); retrying in {wait}s")
                time.sleep(wait)
                continue

            if response.status_code == 200:
                body = response.json()
                # A timed-out search returns a partial page. Retry a few times,
                # then accept it: the next run upserts whatever was missed.
                if body.get("incomplete_results") and attempt < 3:
                    time.sleep(2)
                    continue
                self._respect_rate_limit(response)
                return body

            if response.status_code in (403, 429):
                wait = self._rate_limit_wait(response)
                log(f"  rate limited; waiting {wait:.0f}s")
                time.sleep(wait)
                continue
            if response.status_code >= 500:
                time.sleep(2**attempt)
                continue
            raise RuntimeError(
                f"GitHub search failed: {response.status_code} {response.text[:300]}"
            )
        raise RuntimeError(f"GitHub search kept failing for query: {query}")

    @staticmethod
    def _rate_limit_wait(response: requests.Response) -> float:
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            return float(retry_after) + 1
        reset = response.headers.get("X-RateLimit-Reset")
        if reset and response.headers.get("X-RateLimit-Remaining") == "0":
            return max(float(reset) - time.time(), 0) + 1
        return 60

    def _respect_rate_limit(self, response: requests.Response) -> None:
        if response.headers.get("X-RateLimit-Remaining") == "0":
            wait = self._rate_limit_wait(response)
            log(f"  search quota used up; waiting {wait:.0f}s")
            time.sleep(wait)

    def search(self, query: str) -> tuple[int, list[dict]]:
        repos: list[dict] = []
        total = 0
        for page in range(1, SEARCH_CAP // PER_PAGE + 1):
            body = self._get_page(query, page)
            total = body["total_count"]
            repos.extend(body["items"])
            if len(body["items"]) < PER_PAGE or len(repos) >= total:
                break
        return total, repos


def build_query(
    min_stars: int,
    max_stars: int | None = None,
    created: tuple[date, date] | None = None,
    pushed_since: date | None = None,
) -> str:
    if max_stars is None:
        parts = [f"stars:>={min_stars}"]
    else:
        parts = [f"stars:{min_stars}..{max_stars}"]
    if created:
        parts.append(f"created:{created[0].isoformat()}..{created[1].isoformat()}")
    if pushed_since:
        parts.append(f"pushed:>={pushed_since.isoformat()}")
    return " ".join(parts)


def iter_by_created(
    search: SearchFn,
    stars: int,
    start: date,
    end: date,
    pushed_since: date | None,
) -> Iterator[list[dict]]:
    """Walk every repository with exactly `stars` stars by halving the
    creation-date range until each piece fits under the search cap."""
    query = build_query(stars, stars, created=(start, end), pushed_since=pushed_since)
    total, repos = search(query)
    if total > SEARCH_CAP and start < end:
        middle = start + (end - start) // 2
        yield from iter_by_created(search, stars, start, middle, pushed_since)
        yield from iter_by_created(
            search, stars, middle + timedelta(days=1), end, pushed_since
        )
        return
    if total > SEARCH_CAP:
        log(f"  {total} repositories match '{query}'; only {len(repos)} reachable")
    yield repos


def iter_repo_windows(
    search: SearchFn,
    min_stars: int,
    pushed_since: date | None = None,
    today: date | None = None,
) -> Iterator[list[dict]]:
    """Yield batches of repositories from the most starred downwards.

    Each query is capped at SEARCH_CAP results, so after a full batch the next
    query starts from the lowest star count just seen. Batches overlap at that
    boundary; callers upsert, so repeats are harmless. When more than
    SEARCH_CAP repositories share one star count, that count is walked by
    creation date instead.
    """
    today = today or datetime.now(timezone.utc).date()
    ceiling: int | None = None
    while ceiling is None or ceiling >= min_stars:
        total, repos = search(build_query(min_stars, ceiling, pushed_since=pushed_since))
        if total <= SEARCH_CAP or not repos:
            yield repos
            return
        lowest = min(repo["stargazers_count"] for repo in repos)
        if ceiling is not None and lowest >= ceiling:
            yield from iter_by_created(
                search, ceiling, FIRST_REPO_DATE, today, pushed_since
            )
            ceiling -= 1
        else:
            yield repos
            ceiling = lowest


# --- mapping ---------------------------------------------------------------


def clean_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def repo_to_item(repo: dict) -> dict | None:
    """Map a search result to an `items` row, or None when it has no usable
    description."""
    one_liner = clean_text(repo.get("description"))[:ONE_LINER_MAX].strip()
    if not one_liner:
        return None
    return {
        "source": SOURCE,
        "source_id": str(repo["id"]),
        "name": repo["full_name"],
        "one_liner": one_liner,
        "url": repo["html_url"],
        "launched_at": repo.get("created_at"),
        "status": "archived" if repo.get("archived") else "active",
    }


def embedding_text(source: str, name: str, one_liner: str) -> str:
    """Text sent to the embedding model. A repository's own name (without the
    owner) gives short descriptions like "A faster one" something to hold on
    to; other sources already carry a full title."""
    if source == SOURCE:
        name = name.rsplit("/", 1)[-1]
    return f"{name}: {one_liner}"


def estimate_tokens(text: str) -> int:
    """Rough upper bound, good enough to keep a request under a provider's
    tokens-per-minute limit."""
    return len(text) // 2 + 1


def take_batch(texts: list[str], max_items: int, max_tokens: int) -> int:
    """How many of the leading texts fit in one request. Always at least one."""
    total = 0
    for count, text in enumerate(texts[:max_items]):
        total += estimate_tokens(text)
        if total > max_tokens and count > 0:
            return count
    return min(len(texts), max_items)


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(repr(float(value)) for value in vector) + "]"


# --- embeddings ------------------------------------------------------------


class Embedder:
    """Client for an OpenAI-compatible `/embeddings` endpoint."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        dim: int,
        input_type: str | None = None,
        dim_param: str | None = None,
        session: requests.Session | None = None,
    ):
        self.url = base_url.rstrip("/") + "/embeddings"
        self.model = model
        self.dim = dim
        # Some providers (Voyage) embed stored documents and search queries
        # differently and take an `input_type` to tell them apart. It is not
        # part of the OpenAI format, so it is only sent when configured.
        self.input_type = input_type
        # Name of the request field that asks for `dim` dimensions when the
        # model can produce several sizes: "output_dimension" for Voyage,
        # "dimensions" for OpenAI. Not sent when empty.
        self.dim_param = dim_param
        self.tokens_used = 0
        self.session = session or requests.Session()
        self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def embed(self, texts: list[str]) -> list[list[float]]:
        payload: dict = {"model": self.model, "input": texts}
        if self.input_type:
            payload["input_type"] = self.input_type
        if self.dim_param:
            payload[self.dim_param] = self.dim
        failures = 0
        rate_limited = 0
        while failures < 6 and rate_limited < 60:
            try:
                response = self.session.post(self.url, json=payload, timeout=120)
            except requests.RequestException as error:
                wait = 2**failures
                failures += 1
                log(f"  network error ({error}); retrying in {wait}s")
                time.sleep(wait)
                continue
            if response.status_code == 200:
                body = response.json()
                self.tokens_used += (body.get("usage") or {}).get("total_tokens", 0)
                return parse_embeddings(body, len(texts), self.dim)
            if response.status_code == 429:
                # Low-rate plans allow only a few requests a minute, so being
                # told to slow down is routine here, not a failure.
                rate_limited += 1
                time.sleep(float(response.headers.get("Retry-After") or 20))
                continue
            if response.status_code >= 500:
                wait = 2**failures
                failures += 1
                log(f"  embedding endpoint returned {response.status_code}; waiting {wait}s")
                time.sleep(wait)
                continue
            raise RuntimeError(
                f"Embedding request failed: {response.status_code} {response.text[:300]}"
            )
        raise RuntimeError("Embedding request kept failing")


def parse_embeddings(body: dict, expected_count: int, dim: int) -> list[list[float]]:
    """Return vectors in input order, refusing a wrong count or dimension
    rather than writing vectors that do not match the column."""
    data = sorted(body["data"], key=lambda entry: entry["index"])
    if len(data) != expected_count:
        raise RuntimeError(
            f"Embedding endpoint returned {len(data)} vectors for {expected_count} inputs"
        )
    vectors = [entry["embedding"] for entry in data]
    for vector in vectors:
        if len(vector) != dim:
            raise RuntimeError(
                f"Embedding has {len(vector)} dimensions but EMBED_DIM is {dim}. "
                "The model and the embedding column in db/migrations must agree."
            )
    return vectors


# --- database --------------------------------------------------------------

# A changed name or description clears the embedding so `embed` redoes it.
UPSERT_SQL = """
insert into items (source, source_id, name, one_liner, url, launched_at, status)
values (%(source)s, %(source_id)s, %(name)s, %(one_liner)s, %(url)s,
        %(launched_at)s, %(status)s)
on conflict (source, source_id) do update set
  name = excluded.name,
  one_liner = excluded.one_liner,
  url = excluded.url,
  launched_at = excluded.launched_at,
  status = excluded.status,
  embedding = case
    when items.name = excluded.name and items.one_liner = excluded.one_liner
      then items.embedding
    else null
  end
"""


def connect():
    import psycopg

    return psycopg.connect(database_url(required_env("DATABASE_URL")))


def database_url(value: str) -> str:
    """Tidy a pasted connection string and refuse one that is not a URL, so
    the failure names the cause. The value itself is never printed."""
    value = value.strip().strip("\"'").strip()
    if not value.startswith(("postgresql://", "postgres://")):
        raise SystemExit(
            "DATABASE_URL must be a connection string starting with postgresql://"
        )
    if "[YOUR-PASSWORD]" in value:
        raise SystemExit(
            "DATABASE_URL still contains [YOUR-PASSWORD]; put the database password there"
        )
    return value


def run_collect(args: argparse.Namespace) -> None:
    github = GitHubSearch(required_env("GITHUB_TOKEN"))
    since = date.fromisoformat(args.since) if args.since else None
    seen: set[str] = set()
    skipped = 0

    with connect() as conn:
        for repos in iter_repo_windows(github.search, args.min_stars, since):
            rows = []
            for repo in repos:
                item = repo_to_item(repo)
                if item is None:
                    skipped += 1
                    continue
                if item["source_id"] in seen:
                    continue
                if args.limit and len(seen) >= args.limit:
                    break
                seen.add(item["source_id"])
                rows.append(item)
            if rows:
                with conn.cursor() as cur:
                    cur.executemany(UPSERT_SQL, rows)
                conn.commit()
            if repos:
                log(
                    f"collected {len(seen)} "
                    f"(stars down to {min(r['stargazers_count'] for r in repos)})"
                )
            if args.limit and len(seen) >= args.limit:
                break

    log(f"done: {len(seen)} repositories upserted, {skipped} without description skipped")


def run_embed(args: argparse.Namespace) -> None:
    embedder = Embedder(
        required_env("EMBED_BASE_URL"),
        required_env("EMBED_API_KEY"),
        required_env("EMBED_MODEL"),
        int(os.environ.get("EMBED_DIM") or "512"),
        os.environ.get("EMBED_INPUT_TYPE") or None,
        os.environ.get("EMBED_DIM_PARAM") or None,
    )
    deadline = time.monotonic() + args.max_minutes * 60 if args.max_minutes else None
    done = 0
    with connect() as conn:
        while not args.limit or done < args.limit:
            if deadline and time.monotonic() > deadline:
                log(f"stopping after {args.max_minutes} minutes; run again to continue")
                break
            size = min(args.batch_size, args.limit - done) if args.limit else args.batch_size
            with conn.cursor() as cur:
                cur.execute(
                    "select id, source, name, one_liner from items "
                    "where embedding is null order by id limit %s",
                    (size,),
                )
                rows = cur.fetchall()
            if not rows:
                break
            texts = [embedding_text(source, name, text) for _, source, name, text in rows]
            count = take_batch(texts, args.batch_size, args.max_batch_tokens)
            vectors = embedder.embed(texts[:count])
            with conn.cursor() as cur:
                cur.executemany(
                    "update items set embedding = %s::halfvec where id = %s",
                    [(vector_literal(v), row[0]) for v, row in zip(vectors, rows)],
                )
            conn.commit()
            done += count
            log(f"embedded {done} ({embedder.tokens_used} tokens)")
        with conn.cursor() as cur:
            cur.execute("select count(*) from items where embedding is null")
            left = cur.fetchone()[0]
    log(f"done: {done} items embedded, {embedder.tokens_used} tokens used, {left} still without an embedding")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)

    collect = commands.add_parser("collect", help="search GitHub and upsert into items")
    collect.add_argument("--limit", type=int, default=0, help="stop after this many repositories (0 = all)")
    collect.add_argument("--min-stars", type=int, default=50)
    collect.add_argument("--since", help="only repositories pushed on or after YYYY-MM-DD")
    collect.set_defaults(run=run_collect)

    embed = commands.add_parser("embed", help="embed items that have no embedding")
    embed.add_argument("--limit", type=int, default=0, help="stop after this many items (0 = all)")
    embed.add_argument("--batch-size", type=int, default=64)
    embed.add_argument("--max-batch-tokens", type=int, default=8000, help="keep one request under this many estimated tokens")
    embed.add_argument("--max-minutes", type=int, default=0, help="stop cleanly after this long (0 = no limit)")
    embed.set_defaults(run=run_embed)

    args = parser.parse_args(argv)
    load_env_file(Path(__file__).resolve().parent.parent / ".env.local")
    args.run(args)


if __name__ == "__main__":
    main()

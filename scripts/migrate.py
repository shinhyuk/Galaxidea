"""Apply the SQL files in db/migrations that the database has not seen yet.

Usage:
  python scripts/migrate.py

Each file runs in its own transaction and is recorded in the
`schema_migrations` table, so running this again does nothing.
"""

from __future__ import annotations

from pathlib import Path

from collect_github import connect, load_env_file, log

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "db" / "migrations"
# Applied by hand, before this script existed, on databases that already
# have the tables.
BY_HAND = ["001_init.sql", "002_enable_rls.sql"]


def pending(available: list[str], applied: set[str]) -> list[str]:
    return [name for name in sorted(available) if name not in applied]


def main() -> None:
    load_env_file(ROOT / ".env.local")
    with connect() as conn:
        conn.execute(
            "create table if not exists schema_migrations ("
            "name text primary key, applied_at timestamptz not null default now())"
        )
        conn.execute("alter table schema_migrations enable row level security")
        applied = {row[0] for row in conn.execute("select name from schema_migrations")}
        has_tables = conn.execute("select to_regclass('public.items')").fetchone()[0]
        if not applied and has_tables:
            for name in BY_HAND:
                conn.execute("insert into schema_migrations (name) values (%s)", (name,))
            applied = set(BY_HAND)
            log(f"existing database: marked {', '.join(BY_HAND)} as applied")
        conn.commit()

        names = pending([path.name for path in MIGRATIONS.glob("*.sql")], applied)
        for name in names:
            log(f"applying {name}")
            # psycopg runs a parameterless string of several statements as one batch.
            conn.execute((MIGRATIONS / name).read_text(encoding="utf-8"))
            conn.execute("insert into schema_migrations (name) values (%s)", (name,))
            conn.commit()
        log(f"done: {len(names)} migration(s) applied")


if __name__ == "__main__":
    main()

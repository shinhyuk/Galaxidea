-- Galaxidea initial schema.
-- vector(1024) must match EMBED_DIM. Changing the embedding model to another
-- dimension means a new migration and re-embedding.

create extension if not exists vector;

-- A galaxy: a group of similar ideas.
create table clusters (
  id bigserial primary key,
  label text not null,
  centroid vector(1024),
  x double precision,
  y double precision,
  item_count integer not null default 0,
  query_count integer not null default 0,
  weekly_new_items integer not null default 0,
  growth_score double precision not null default 0,
  state text not null default 'steady'
    check (state in ('steady', 'growing', 'saturated', 'fading')),
  updated_at timestamptz not null default now()
);

-- A star that came from the outside world: a shipped product, a repository, a patent.
create table items (
  id bigserial primary key,
  source text not null,
  source_id text not null,
  name text not null,
  one_liner text not null,
  url text,
  launched_at timestamptz,
  status text,
  lang text,
  embedding vector(1024),
  cluster_id bigint references clusters (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

-- A star that came from a person asking. raw_text is private and must never
-- be returned by any API or page; only one_liner is public.
create table queries (
  id bigserial primary key,
  raw_text text not null,
  one_liner text not null,
  lang text,
  country text,
  is_public boolean not null default true,
  stage text not null default 'thought'
    check (stage in ('thought', 'researching', 'building', 'launched', 'dropped')),
  embedding vector(1024),
  cluster_id bigint references clusters (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A trending word observed on a given day.
create table trends (
  id bigserial primary key,
  word text not null,
  source text not null,
  score double precision not null,
  observed_on date not null,
  cluster_id bigint references clusters (id) on delete set null,
  unique (word, source, observed_on)
);

create index items_embedding_idx on items using hnsw (embedding vector_cosine_ops);
create index queries_embedding_idx on queries using hnsw (embedding vector_cosine_ops);
create index items_cluster_idx on items (cluster_id);
create index queries_cluster_idx on queries (cluster_id);
create index items_launched_idx on items (launched_at);
create index trends_observed_idx on trends (observed_on);

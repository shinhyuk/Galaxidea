-- Store embeddings as 512-dimension half-precision vectors: about a quarter
-- of the space of vector(1024), so far more ideas fit in a small database.
-- EMBED_DIM must be 512 from here on. Existing embeddings are dropped and
-- have to be computed again.

drop index if exists items_embedding_idx;
drop index if exists queries_embedding_idx;

alter table items drop column if exists embedding;
alter table items add column embedding halfvec(512);

alter table queries drop column if exists embedding;
alter table queries add column embedding halfvec(512);

alter table clusters drop column if exists centroid;
alter table clusters add column centroid halfvec(512);

create index items_embedding_idx on items using hnsw (embedding halfvec_cosine_ops);
create index queries_embedding_idx on queries using hnsw (embedding halfvec_cosine_ops);

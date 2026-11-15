-- What a question needs: where each item sits on the graph (written by
-- scripts/build_graph.py), and the finished report kept with the question so
-- its page can be shown again without redoing the search.

alter table items add column if not exists gx integer;
alter table items add column if not exists gy integer;
alter table items add column if not exists graph_group text;

alter table queries add column if not exists verdict text;
alter table queries add column if not exists top_similarity double precision;
alter table queries add column if not exists report jsonb;
alter table queries add column if not exists gx integer;
alter table queries add column if not exists gy integer;

-- Top level of the universe: a domain is a whole field (a galaxy), holding
-- areas (clusters), which hold ideas (items and queries).

create table if not exists domains (
  id text primary key,
  label text not null,
  position integer not null default 0
);

alter table domains enable row level security;

insert into domains (id, label, position) values
  ('ai', 'AI·생성형 AI', 1),
  ('health', '헬스케어·바이오', 2),
  ('climate', '기후·에너지', 3),
  ('mobility', '로봇·모빌리티', 4),
  ('edu', '교육·학습', 5),
  ('finance', '금융·경제', 6),
  ('life', '소비·생활', 7),
  ('play', '콘텐츠·게임', 8),
  ('food', '식품·농업', 9)
on conflict (id) do nothing;

-- Known at collection time for sources that carry a classification
-- (patents). Left empty otherwise and filled in by the weekly batch.
alter table items add column if not exists domain_id text references domains (id) on delete set null;
alter table clusters add column if not exists domain_id text references domains (id) on delete set null;

create index if not exists items_domain_idx on items (domain_id);
create index if not exists clusters_domain_idx on clusters (domain_id);

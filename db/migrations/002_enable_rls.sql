-- Hosted Postgres services such as Supabase expose every table in `public`
-- through an auto-generated web API. Row level security with no policies
-- shuts that door, so queries.raw_text cannot leak that way. The app and the
-- scripts connect as the table owner, which is not subject to these rules.

alter table clusters enable row level security;
alter table items enable row level security;
alter table queries enable row level security;
alter table trends enable row level security;

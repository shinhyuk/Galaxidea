import postgres from "postgres";
import { env } from "./env";

// One small pool per server instance. `prepare: false` keeps it working
// behind a connection pooler such as Supabase's.
let client: ReturnType<typeof postgres> | null = null;

export function sql() {
  client ??= postgres(env.databaseUrl, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return client;
}

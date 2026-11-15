import { sql } from "../db";
import { embedQuery } from "../embed";
import { VERDICT_THRESHOLDS } from "../env";
import { chat } from "../llm";
import {
  buildReport,
  parseRefine,
  parseReport,
  refinePrompt,
  reportPrompt,
  sanitize,
  verdictFor,
  INPUT_MAX,
  type Match,
  type Report,
} from "./logic";

type ItemRow = {
  id: string;
  source: string;
  name: string;
  one_liner: string;
  url: string | null;
  year: number | null;
  status: string | null;
  similarity: number;
  gx: number | null;
  gy: number | null;
  graph_group: string | null;
};

// Answers one question end to end and stores it. Returns the id of the
// stored question. `raw` is kept in the database but never read back out.
export async function ask(raw: string, country: string | null): Promise<string> {
  const input = raw.trim().slice(0, INPUT_MAX);

  // 1. One public sentence, with personal details removed.
  const prompt = refinePrompt(input);
  const refined = parseRefine(await chat(prompt.system, prompt.user, 400), input);
  if (!refined.oneLiner) throw new Error("empty question");

  // 2-3. Embed it and find the closest items and earlier questions.
  const vector = await embedQuery(refined.oneLiner);
  const db = sql();
  const rows = await db<ItemRow[]>`
    select id, source, name, one_liner, url, extract(year from launched_at)::int as year, status,
           1 - (embedding <=> ${vector}::halfvec) as similarity, gx, gy, graph_group
    from items
    where embedding is not null
    order by embedding <=> ${vector}::halfvec
    limit 20`;
  const matches: Match[] = rows.map((row) => ({
    id: Number(row.id),
    source: row.source,
    name: row.name,
    oneLiner: row.one_liner,
    url: row.url,
    year: row.year,
    status: row.status,
    similarity: Number(row.similarity),
    gx: row.gx,
    gy: row.gy,
    group: row.graph_group,
  }));
  const alike = await db<{ lang: string | null; created_at: Date; similarity: number }[]>`
    select lang, created_at, 1 - (embedding <=> ${vector}::halfvec) as similarity
    from queries
    where embedding is not null and is_public
    order by embedding <=> ${vector}::halfvec
    limit 20`;
  const close = alike.filter((row) => Number(row.similarity) >= VERDICT_THRESHOLDS.similar);
  const langs = new Map<string, number>();
  for (const row of close) langs.set(row.lang ?? "?", (langs.get(row.lang ?? "?") ?? 0) + 1);
  const same: Report["same"] = {
    count: close.length,
    firstAt: close.length
      ? new Date(Math.min(...close.map((row) => row.created_at.getTime()))).toISOString()
      : null,
    langs: [...langs].map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count),
  };

  // 4. Verdict from the best similarity.
  const verdict = verdictFor(matches[0]?.similarity ?? 0, VERDICT_THRESHOLDS);

  // 5. The model writes from the search results only; anything it names
  // that is not among them is dropped. Without a usable answer the report
  // is the plain search results.
  const writing = reportPrompt(refined.oneLiner, verdict, matches.slice(0, 12));
  const written = parseReport(await chat(writing.system, writing.user), matches);
  const report = buildReport({
    oneLiner: refined.oneLiner,
    verdict,
    matches,
    written,
    same,
    similarThreshold: VERDICT_THRESHOLDS.similar,
  });

  // 6. Store the question as a new star.
  const [stored] = await db<{ id: string }[]>`
    insert into queries (raw_text, one_liner, lang, country, embedding, verdict, top_similarity, report, gx, gy)
    values (${input}, ${refined.oneLiner}, ${refined.lang}, ${country}, ${vector}::halfvec, ${verdict},
            ${report.topSimilarity}, ${db.json(report)}, ${report.star?.x ?? null}, ${report.star?.y ?? null})
    returning id`;
  return stored.id;
}

// The stored report of a question. Only public fields: never `raw_text`.
export async function loadReport(id: string): Promise<{ report: Report; createdAt: Date } | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const [row] = await sql()<{ report: Report | null; created_at: Date }[]>`
    select report, created_at from queries where id = ${id} and is_public`;
  return row?.report ? { report: row.report, createdAt: row.created_at } : null;
}

export function validInput(text: unknown): text is string {
  return typeof text === "string" && sanitize(text, INPUT_MAX).length >= 4;
}

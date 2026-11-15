import { env } from "./env";

// Embeds a question through an OpenAI-compatible `/embeddings` endpoint and
// returns it as a pgvector literal.
export async function embedQuery(text: string): Promise<string> {
  const config = env.embed;
  const body: Record<string, unknown> = { model: config.model, input: [text] };
  if (config.queryInputType) body.input_type = config.queryInputType;
  if (config.dimParam) body[config.dimParam] = config.dim;

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }
  const vector = (await response.json())?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== config.dim) {
    throw new Error(`Embedding has ${Array.isArray(vector) ? vector.length : 0} dimensions, expected ${config.dim}`);
  }
  return `[${vector.join(",")}]`;
}

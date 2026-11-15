import { env } from "./env";

// One chat turn through an OpenAI-compatible `/chat/completions` endpoint.
// Returns null when no model is configured or the call fails, so callers
// can fall back instead of failing the whole request.
export async function chat(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  const config = env.llm;
  if (!config) return null;
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!response.ok) {
      console.error(`chat request failed: ${response.status}`);
      return null;
    }
    const content = (await response.json())?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (error) {
    console.error("chat request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

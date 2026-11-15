// Server-side configuration. Read values through this module so a missing
// variable fails loudly at the call site instead of deep inside a request.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get databaseUrl() {
    // Pasted connection strings often carry a trailing line break.
    return required("DATABASE_URL").trim();
  },
  // The chat model is optional: without it a report is built from the search
  // results alone.
  get llm() {
    const baseUrl = process.env.LLM_BASE_URL?.trim();
    const apiKey = process.env.LLM_API_KEY?.trim();
    const model = process.env.LLM_MODEL?.trim();
    return baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null;
  },
  get embed() {
    return {
      baseUrl: required("EMBED_BASE_URL").trim(),
      apiKey: required("EMBED_API_KEY").trim(),
      model: required("EMBED_MODEL").trim(),
      dim: Number(process.env.EMBED_DIM ?? "512"),
      // Request field that sets the output size ("output_dimension" for
      // Voyage, "dimensions" for OpenAI). Not sent when empty.
      dimParam: process.env.EMBED_DIM_PARAM?.trim() || null,
      // Value of `input_type` for a question, for providers that embed
      // questions and stored documents differently (Voyage: "query").
      queryInputType: process.env.EMBED_QUERY_INPUT_TYPE?.trim() || null,
    };
  },
};

// Similarity cut-offs for the report verdict, for voyage-4 at 512
// dimensions. Set from a handful of hand-checked questions (2026-11): an
// idea that plainly exists scored 0.61 to 0.75 against its match, a loosely
// related one 0.49, an unrelated one 0.42. Revisit with more samples.
export const VERDICT_THRESHOLDS = {
  exists: 0.6,
  similar: 0.47,
} as const;

// Questions allowed per client address.
export const ASK_LIMIT = { count: 5, windowMs: 60_000 } as const;

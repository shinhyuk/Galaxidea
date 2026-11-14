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
    return required("DATABASE_URL");
  },
  get llm() {
    return {
      baseUrl: required("LLM_BASE_URL"),
      apiKey: required("LLM_API_KEY"),
      model: required("LLM_MODEL"),
    };
  },
  get embed() {
    return {
      baseUrl: required("EMBED_BASE_URL"),
      apiKey: required("EMBED_API_KEY"),
      model: required("EMBED_MODEL"),
      dim: Number(process.env.EMBED_DIM ?? "1024"),
    };
  },
};

// Similarity cut-offs for the report verdict. Starting values only:
// tune them against real data once items are loaded.
export const VERDICT_THRESHOLDS = {
  exists: 0.8,
  similar: 0.65,
} as const;

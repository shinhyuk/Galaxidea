import { ASK_LIMIT } from "@/lib/env";
import { allowRequest } from "@/lib/ask/logic";
import { ask, validInput } from "@/lib/ask/pipeline";

// Two model calls, an embedding and a search can take a while together.
export const maxDuration = 60;

// Per server instance, so it bounds a burst from one address rather than
// enforcing an exact global limit.
const recent = new Map<string, number[]>();

export async function POST(request: Request) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!allowRequest(recent, client, Date.now(), ASK_LIMIT.count, ASK_LIMIT.windowMs)) {
    return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let idea: unknown;
  try {
    idea = (await request.json())?.idea;
  } catch {
    idea = null;
  }
  if (!validInput(idea)) {
    return Response.json({ error: "아이디어를 한 줄로 적어 주세요." }, { status: 400 });
  }

  try {
    const id = await ask(idea, request.headers.get("x-vercel-ip-country"));
    return Response.json({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ask failed:", message);
    const setup = message.startsWith("Missing environment variable");
    return Response.json(
      { error: setup ? "아직 검색이 연결되지 않았습니다." : "지금은 답을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: setup ? 503 : 500 },
    );
  }
}

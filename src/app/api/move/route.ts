import { createGateway } from "ai";
import { chooseMove } from "@/lib/ai-move";
import { moveRequestSchema } from "@/lib/game";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON board." }, { status: 400 });
  }

  const parsed = moveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Expected a valid board where it is O’s turn." }, { status: 400 });
  }

  const apiKey = process.env.AI_GATEWAY_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI_GATEWAY_KEY is not configured on the server." }, { status: 503 });
  }

  const gateway = createGateway({ apiKey });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);

  try {
    const decision = await chooseMove(parsed.data.board, gateway.evaluationModel("typesafe-ai/jev"), signal);
    return Response.json(decision);
  } catch {
    const timedOut = signal.aborted;
    return Response.json(
      { error: timedOut ? "Jev took too long. Try again." : "Jev couldn’t choose a move. Try again." },
      { status: timedOut ? 504 : 502 },
    );
  }
}

import { createGateway } from "ai";
import { Experimental_EvaluationLanguageModel } from "@ai-sdk/provider-utils/experimental-evaluation";
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
    return Response.json({ error: "Expected a supported model and a valid board where it is O’s turn." }, { status: 400 });
  }

  const apiKey = process.env.AI_GATEWAY_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI_GATEWAY_KEY is not configured on the server." }, { status: 503 });
  }

  const gateway = createGateway({ apiKey });
  const modelId = parsed.data.model;
  // Use the SDK's standard evaluation adapter for Gateway language models.
  const model = modelId === "typesafe-ai/jev"
    ? gateway.evaluationModel(modelId)
    : new Experimental_EvaluationLanguageModel({ model: gateway.languageModel(modelId) });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);

  try {
    const decision = await chooseMove(parsed.data.board, model, signal);
    return Response.json(decision);
  } catch {
    const timedOut = signal.aborted;
    return Response.json(
      { error: timedOut ? "The model took too long. Try again." : "The model couldn’t choose a move. Try again." },
      { status: timedOut ? 504 : 502 },
    );
  }
}

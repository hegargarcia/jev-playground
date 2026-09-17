import { createGateway } from "ai";
import { Experimental_EvaluationLanguageModel } from "@ai-sdk/provider-utils/experimental-evaluation";
import { chooseMove, chooseStructuredMove } from "@/lib/connect-four-ai";
import { moveRequestSchema } from "@/lib/connect-four";

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
  // Reasoning models can need longer on midgame Connect Four positions.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]);

  try {
    const decision = modelId === "openai/gpt-6-astra"
      ? await chooseStructuredMove(parsed.data.board, gateway.languageModel(modelId), signal)
      : await chooseMove(
        parsed.data.board,
        modelId === "typesafe-ai/jev"
          ? gateway.evaluationModel(modelId)
          : new Experimental_EvaluationLanguageModel({ model: gateway.languageModel(modelId) }),
        signal,
      );
    return Response.json(decision);
  } catch {
    const timedOut = signal.aborted;
    return Response.json(
      { error: timedOut ? "The model took too long. Try again." : "The model couldn’t choose a move. Try again." },
      { status: timedOut ? 504 : 502 },
    );
  }
}

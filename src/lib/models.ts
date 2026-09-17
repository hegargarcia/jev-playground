import { z } from "zod";

export const models = [
  { id: "typesafe-ai/jev", name: "Jev", provider: "TypeSafe AI" },
  { id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna", provider: "OpenAI" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic" },
  { id: "google/gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", provider: "Google" },
] as const;

export type Model = (typeof models)[number];
export const modelIdSchema = z.enum(models.map(({ id }) => id));

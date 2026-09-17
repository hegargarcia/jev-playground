import { experimental_evaluate, generateText, Output, type Experimental_EvaluationModel, type LanguageModel } from "ai";
import { z } from "zod";
import { COLUMNS, ROWS, columns, dropDisc, getGameState, landingSquare, type Board } from "./connect-four";

function boardRows(board: Board) {
  return Array.from({ length: ROWS }, (_, row) => board.slice(row * COLUMNS, (row + 1) * COLUMNS));
}

function createMoveEvaluation(board: Board) {
  if (!getGameState(board).isValidOTurn) throw new Error("Cannot request an O move for this board.");
  const options = columns.filter((column) => landingSquare(board, column) >= 0).map((column) => ({
    column,
    name: `column_${column + 1}`,
    description: {
      action: `Drop O into column ${column + 1}.`,
      column: column + 1,
      landing_row: Math.floor(landingSquare(board, column) / COLUMNS) + 1,
      resulting_board: boardRows(dropDisc(board, column, "O")),
    },
  }));
  return {
    options,
    state: {
      game: "Connect Four",
      player_to_move: "O",
      opponent: "X",
      board: boardRows(board),
      coordinates: "6 rows, top to bottom, and 7 columns, left to right, numbered from 1. Null means empty. X is the human; O is you.",
    },
    questions: {
      move: {
        type: "choice" as const,
        instructions: {
          question: "Which legal column should O play to achieve the best outcome against an optimal X player?",
          rules: "Players alternate dropping one disc into a non-full column. Gravity puts it in the lowest empty row. Four or more matching discs consecutively horizontally, vertically, or diagonally wins immediately. A full board with no winner is a draw.",
          focus: "Compare every supplied resulting board. Unless O has won, X moves next. Only supported empty cells are playable now; floating threats require future support. Consider the strongest legal reply by X.",
          priorities: [
            "Take an immediate O win.",
            "Otherwise block an immediate X win if possible. Check every legal X reply, including diagonals.",
            "Avoid moves that provide support for an immediate X winning drop above your disc.",
            "Create two distinct playable winning threats that X cannot block together, and prevent X from doing so.",
            "Seek a forced win; preserve a draw rather than rely on an opponent mistake.",
          ],
          tie_break: "Among equally strong outcomes, prefer central columns, which participate in more winning lines. This preference must never override a win or defense.",
        },
        criteria: Object.fromEntries(options.map(({ name, description }) => [name, description])),
      },
    },
  };
}

export async function chooseMove(
  board: Board,
  model: Experimental_EvaluationModel,
  abortSignal?: AbortSignal,
) {
  abortSignal?.throwIfAborted();
  const { options, state, questions } = createMoveEvaluation(board);
  const result = await experimental_evaluate({ model, state, questions, maxRetries: 1, abortSignal });

  abortSignal?.throwIfAborted();
  const selected = options.find(({ name }) => name === result.answers.move.choice);
  if (!selected) {
    throw new Error("The model returned an illegal move.");
  }
  const confidence = z.object({ move: z.number().min(0).max(1) })
    .safeParse(result.providerMetadata?.typesafe?.confidence);

  return {
    move: selected.column,
    confidence: confidence.success ? confidence.data.move : null,
    options: options.map(({ column, name }) => ({
      column,
      weight: result.answers.move.probabilities?.[name] ?? null,
    })),
  };
}

export async function chooseStructuredMove(
  board: Board,
  model: LanguageModel,
  abortSignal?: AbortSignal,
) {
  abortSignal?.throwIfAborted();
  const { options, state, questions } = createMoveEvaluation(board);
  const { output } = await generateText({
    model,
    output: Output.object({
      name: "ConnectFourMove",
      schema: z.object({
        choice: z.enum(options.map(({ name }) => name)).describe("The legal column to drop O into."),
      }),
    }),
    system: "Choose O’s move using the supplied game rules, instructions, and legal options. Return the chosen option name in the requested JSON structure.",
    prompt: JSON.stringify({ state, questions }),
    maxRetries: 1,
    abortSignal,
  });
  abortSignal?.throwIfAborted();
  const selected = options.find(({ name }) => name === output.choice);
  if (!selected) throw new Error("The model returned an illegal move.");

  return {
    move: selected.column,
    confidence: null,
    options: options.map(({ column }) => ({ column, weight: null })),
  };
}

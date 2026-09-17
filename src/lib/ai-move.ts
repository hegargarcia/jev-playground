import { experimental_evaluate, generateText, Output, type Experimental_EvaluationModel, type LanguageModel } from "ai";
import { z } from "zod";
import { getGameState, type Board } from "./game";

const squareNames = [
  "top_left", "top_middle", "top_right",
  "middle_left", "center", "middle_right",
  "bottom_left", "bottom_middle", "bottom_right",
] as const;

function boardRows(board: Board) {
  return [board.slice(0, 3), board.slice(3, 6), board.slice(6, 9)];
}

function createMoveEvaluation(board: Board) {
  if (!getGameState(board).isValidOTurn) {
    throw new Error("Cannot request an O move for this board.");
  }

  // Meaningful names and the resulting boards distinguish every legal option.
  const options = board.flatMap((mark, square) => mark === null
    ? [{
      square,
      name: squareNames[square],
      description: {
        action: `Place O in the ${squareNames[square].replaceAll("_", " ")} square.`,
        row: Math.floor(square / 3) + 1,
        column: square % 3 + 1,
        resulting_board: boardRows(board.map((cell, index) => index === square ? "O" : cell)),
      },
    }]
    : []);
  const criteria = Object.fromEntries(options.map(({ name, description }) => [name, description]));
  return {
    options,
    state: {
      game: "Tic tac toe",
      player_to_move: "O",
      opponent: "X",
      board: boardRows(board),
      coordinates: "Rows run top to bottom and columns left to right, numbered 1 to 3. Null is an empty square.",
    },
    questions: {
      move: {
        type: "choice" as const,
        instructions: {
          question: "Which legal square should O play now to achieve the best outcome against an optimal X player?",
          rules: "Players alternate placing one mark in an empty square. Three matching marks in a row, column, or diagonal wins immediately. A full board without a winner is a draw.",
          focus: "Compare the resulting board supplied for each option. Unless O has already won, X moves next. Evaluate X’s strongest reply rather than assuming X will make a mistake.",
          priorities: [
            "Take an immediate O win before considering defense.",
            "Otherwise prevent any immediate X win on the next move.",
            "Prefer a forced win. A fork creates two distinct winning squares for the following turn, so the opponent cannot block both.",
            "Prevent X from forcing a win, including forks. When X occupies opposite corners and O holds the center, an edge prevents X’s fork; another corner loses.",
            "Secure a draw when no win can be forced. A guaranteed draw is better than a possible win that relies on an X mistake.",
          ],
          tie_break: "Only among moves with equally good outcomes, prefer center, then corners, then edges. Position preference must never override winning or preventing a loss.",
        },
        criteria,
      },
    },
  };
}

export async function chooseMove(
  board: Board,
  model: Experimental_EvaluationModel,
  abortSignal?: AbortSignal,
) {
  const { options, state, questions } = createMoveEvaluation(board);
  const result = await experimental_evaluate({ model, state, questions, maxRetries: 1, abortSignal });

  const selected = options.find(({ name }) => name === result.answers.move.choice);
  if (!selected) {
    throw new Error("The model returned an illegal move.");
  }
  const confidence = z.object({ move: z.number().min(0).max(1) })
    .safeParse(result.providerMetadata?.typesafe?.confidence);

  return {
    move: selected.square,
    confidence: confidence.success ? confidence.data.move : null,
    options: options.map(({ square, name }) => ({
      square,
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
      name: "TicTacToeMove",
      schema: z.object({
        choice: z.enum(options.map(({ name }) => name)).describe("The legal square to place O in."),
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
    move: selected.square,
    confidence: null,
    options: options.map(({ square }) => ({ square, weight: null })),
  };
}

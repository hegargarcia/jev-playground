import { experimental_evaluate, type Experimental_EvaluationModel } from "ai";
import { z } from "zod";
import { getGameState, type Board } from "./game";

export async function chooseMove(
  board: Board,
  model: Experimental_EvaluationModel,
  abortSignal?: AbortSignal,
) {
  if (!getGameState(board).isValidOTurn) {
    throw new Error("Cannot request an O move for this board.");
  }

  // Only empty squares are offered as choices to the evaluation model.
  const criteria = Object.fromEntries(
    board.flatMap((mark, index) => mark === null
      ? [[String(index), `Place O in row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}.`]]
      : []),
  );
  const result = await experimental_evaluate({
    model,
    state: {
      game: "Tic tac toe",
      player: "O",
      opponent: "X",
      rows: [board.slice(0, 3), board.slice(3, 6), board.slice(6, 9)],
      emptySquare: null,
    },
    questions: {
      move: {
        type: "choice",
        instructions: "Choose the strongest legal move for O. Three marks in a row, column, or diagonal wins. Win immediately if possible; otherwise block an immediate X win. Look ahead to create or prevent forks and avoid losing. Choose exactly one of the available squares.",
        criteria,
      },
    },
    maxRetries: 1,
    abortSignal,
  });

  const move = Number(result.answers.move.choice);
  if (!Number.isInteger(move) || board[move] !== null) {
    throw new Error("The model returned an illegal move.");
  }
  const confidence = z.object({ move: z.number().min(0).max(1) })
    .safeParse(result.providerMetadata?.typesafe?.confidence);

  return {
    move,
    confidence: confidence.success ? confidence.data.move : null,
    options: board.flatMap((mark, square) => mark === null
      ? [{ square, weight: result.answers.move.probabilities?.[String(square)] ?? null }]
      : []),
  };
}

import { z } from "zod";

export const boardSchema = z.array(z.enum(["X", "O"]).nullable()).length(9);
export type Board = z.infer<typeof boardSchema>;
const squareSchema = z.number().int().min(0).max(8);
export const moveResponseSchema = z.object({
  move: squareSchema,
  confidence: z.number().min(0).max(1).nullable(),
  options: z.array(z.object({
    square: squareSchema,
    weight: z.number().min(0).max(1).nullable(),
  })).min(1).max(9),
});
export type MoveDecision = z.infer<typeof moveResponseSchema>;

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function emptyBoard(): Board {
  return Array(9).fill(null);
}

export function getGameState(board: Board) {
  const winningLine = winningLines.find(([a, b, c]) =>
    board[a] && board[a] === board[b] && board[a] === board[c],
  );
  const winner = winningLine ? board[winningLine[0]] : null;
  const isDraw = !winner && board.every(Boolean);
  const xCount = board.filter((mark) => mark === "X").length;
  const oCount = board.filter((mark) => mark === "O").length;

  return {
    winningLine,
    winner,
    isDraw,
    finished: Boolean(winner) || isDraw,
    turn: xCount === oCount ? "X" : "O",
    isValidOTurn: xCount === oCount + 1 && !winner && !isDraw,
  };
}

export const moveRequestSchema = z.object({
  board: boardSchema.refine((board) => getGameState(board).isValidOTurn, {
    message: "Expected an unfinished board where it is O’s turn.",
  }),
});

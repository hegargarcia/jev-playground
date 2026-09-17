import { z } from "zod";
import { modelIdSchema, models } from "./models";

export const ROWS = 6;
export const COLUMNS = 7;
export const columns = Array.from({ length: COLUMNS }, (_, column) => column);
const boardSchema = z.array(z.enum(["X", "O"]).nullable()).length(ROWS * COLUMNS);
export type Board = z.infer<typeof boardSchema>;
const columnSchema = z.number().int().min(0).max(COLUMNS - 1);
export const moveResponseSchema = z.object({
  move: columnSchema,
  confidence: z.number().min(0).max(1).nullable(),
  options: z.array(z.object({ column: columnSchema, weight: z.number().min(0).max(1).nullable() })).min(1).max(COLUMNS),
});
export type MoveDecision = z.infer<typeof moveResponseSchema>;

export function emptyBoard(): Board {
  return Array.from({ length: ROWS * COLUMNS }, () => null);
}

export function landingSquare(board: Board, column: number) {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) return -1;
  for (let row = ROWS - 1; row >= 0; row--) {
    const square = row * COLUMNS + column;
    if (board[square] === null) return square;
  }
  return -1;
}

export function getGameState(board: Board) {
  const winningSquares = new Set<number>();
  for (let row = 0; row < ROWS; row++) {
    for (const column of columns) {
      const start = row * COLUMNS + column;
      if (!board[start]) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const endRow = row + dr * 3;
        const endColumn = column + dc * 3;
        if (endRow >= ROWS || endColumn < 0 || endColumn >= COLUMNS) continue;
        const line = Array.from({ length: 4 }, (_, offset) => (row + dr * offset) * COLUMNS + column + dc * offset);
        if (line.every((square) => board[square] === board[start])) line.forEach((square) => winningSquares.add(square));
      }
    }
  }
  const winningLine = [...winningSquares];
  const winner = winningLine.length ? board[winningLine[0]] : null;
  const isDraw = !winner && board.every((cell) => cell !== null);
  const xCount = board.filter((cell) => cell === "X").length;
  const oCount = board.filter((cell) => cell === "O").length;
  const hasGravity = board.every((cell, square) => cell === null || square >= (ROWS - 1) * COLUMNS || board[square + COLUMNS] !== null);
  return {
    winningLine, winner, isDraw,
    finished: Boolean(winner) || isDraw,
    turn: xCount === oCount ? "X" as const : "O" as const,
    isValidOTurn: board.length === ROWS * COLUMNS && hasGravity && xCount === oCount + 1 && !winner && !isDraw,
  };
}

export function dropDisc(board: Board, column: number, player: "X" | "O"): Board {
  const square = landingSquare(board, column);
  const state = getGameState(board);
  if (square < 0 || state.finished || state.turn !== player) throw new Error("Illegal drop.");
  return board.map((cell, index) => index === square ? player : cell);
}

export const moveRequestSchema = z.object({
  model: modelIdSchema.default(models[0].id),
  board: boardSchema.refine((board) => getGameState(board).isValidOTurn, {
    message: "Expected an unfinished board with supported discs where it is O’s turn.",
  }),
});

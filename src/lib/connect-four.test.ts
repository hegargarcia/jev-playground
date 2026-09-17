import { test } from "node:test";
import assert from "node:assert/strict";
import { Experimental_EvaluationMockModelV4, MockLanguageModelV4 } from "ai/test";
import { columns, dropDisc, emptyBoard, getGameState, landingSquare, moveRequestSchema, type Board } from "./connect-four";
import { chooseMove, chooseStructuredMove } from "./connect-four-ai";
import { POST } from "../app/api/connect-four/move/route";

function play(moves: number[]) {
  return moves.reduce((board, column, index) => dropDisc(board, column, index % 2 ? "O" : "X"), emptyBoard());
}

test("discs stack from the bottom; full columns, wrong turns and finished games reject drops", () => {
  const board = play([0, 0, 0, 0, 0, 0]);
  assert.deepEqual([0, 7, 14, 21, 28, 35].map((square) => board[square]), ["O", "X", "O", "X", "O", "X"]);
  assert.equal(landingSquare(board, 0), -1);
  for (const column of [0, -1, 7, 0.5]) assert.throws(() => dropDisc(board, column, "X"));
  assert.throws(() => dropDisc(emptyBoard(), 2, "O"));
  assert.equal(landingSquare(board, 1), 36);
  assert.deepEqual(emptyBoard(), Array(42).fill(null));
  assert.throws(() => dropDisc(play([0, 1, 0, 1, 0, 1, 0]), 2, "O"));
});

test("detects horizontal, vertical and both diagonal wins without wrapping rows", () => {
  for (const line of [[35, 36, 37, 38], [14, 21, 28, 35], [14, 22, 30, 38], [20, 26, 32, 38]]) {
    for (const mark of ["X", "O"] as const) {
      const board = emptyBoard();
      line.forEach((square) => { board[square] = mark; });
      assert.equal(getGameState(board).winner, mark);
      assert.deepEqual(getGameState(board).winningLine.sort((a, b) => a - b), line);
    }
  }
  const wrapped = emptyBoard();
  [33, 34, 35, 36].forEach((square) => { wrapped[square] = "X"; });
  assert.equal(getGameState(wrapped).winner, null);
});

test("a full board without four in a row is a draw", () => {
  const board: Board = [
    "X", "X", "O", "O", "X", "X", "O",
    "O", "O", "X", "X", "O", "O", "X",
    "X", "X", "O", "O", "X", "X", "O",
    "O", "O", "X", "X", "O", "O", "X",
    "X", "X", "O", "O", "X", "X", "O",
    "O", "O", "X", "X", "O", "O", "X",
  ];
  assert.equal(getGameState(board).isDraw, true);
  assert.equal(getGameState(board).finished, true);
  assert.equal(moveRequestSchema.safeParse({ board }).success, false);
});

test("requests reject floating discs, bad counts, board shape and terminal positions", async () => {
  const floating = emptyBoard(); floating[0] = "X";
  for (const board of [floating, emptyBoard(), Array(41).fill(null), ["Z", ...Array(41).fill(null)], play([0, 1, 0, 1, 0, 1, 0])]) {
    assert.equal(moveRequestSchema.safeParse({ board }).success, false);
  }
  const opening = play([3]);
  assert.equal(moveRequestSchema.safeParse({ board: opening }).success, true);
  for (const body of ["{", "null", JSON.stringify({ board: floating }), JSON.stringify({ board: opening, model: "nope" })]) {
    assert.equal((await POST(new Request("http://localhost/api/connect-four/move", { method: "POST", body }))).status, 400);
  }
});

test("evaluations offer only legal columns with gravity-correct resulting boards and retain weights", async () => {
  const board = play([0, 0, 0, 0, 0, 0, 3]);
  const probabilities = { column_2: 0, column_3: 0.1, column_4: 0.6, column_5: 0.1, column_6: 0.1, column_7: 0.1 };
  const model = new Experimental_EvaluationMockModelV4({
    doEvaluate: async ({ questions }) => {
      assert.ok(questions.move.type === "choice");
      assert.deepEqual(Object.keys(questions.move.criteria ?? {}), Object.keys(probabilities));
      assert.deepEqual(questions.move.criteria?.column_4, {
        action: "Drop O into column 4.", column: 4, landing_row: 5,
        resulting_board: Array.from({ length: 6 }, (_, row) => dropDisc(board, 3, "O").slice(row * 7, row * 7 + 7)),
      });
      return { answers: { move: { type: "choice", choice: "column_4", probabilities } }, providerMetadata: { typesafe: { confidence: { move: 0 } } }, warnings: [] };
    },
  });
  assert.deepEqual(await chooseMove(board, model), {
    move: 3, confidence: 0,
    options: Object.values(probabilities).map((weight, index) => ({ column: index + 1, weight })),
  });
  const illegal = new Experimental_EvaluationMockModelV4({ doEvaluate: async () => ({ answers: { move: { type: "choice", choice: "column_1" } }, warnings: [] }) });
  await assert.rejects(chooseMove(board, illegal));
  await assert.rejects(chooseMove(emptyBoard(), illegal), /Cannot request/);
});

function structuredModel(choice: string) {
  return new MockLanguageModelV4({ doGenerate: async () => ({
    content: [{ type: "text", text: JSON.stringify({ choice }) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 5, text: 5, reasoning: undefined },
    }, warnings: [],
  }) });
}

test("Astra structured choices enforce legal columns without inventing confidence or weights", async () => {
  assert.deepEqual(await chooseStructuredMove(play([3]), structuredModel("column_4")), {
    move: 3, confidence: null, options: columns.map((column) => ({ column, weight: null })),
  });
  const fullColumn = play([0, 0, 0, 0, 0, 0, 3]);
  for (const choice of ["column_1", "column_8", "center"]) {
    await assert.rejects(chooseStructuredMove(fullColumn, structuredModel(choice)));
  }
  const cancelled = structuredModel("column_4");
  await assert.rejects(chooseStructuredMove(play([3]), cancelled, AbortSignal.abort()), { name: "AbortError" });
  assert.equal(cancelled.doGenerateCalls.length, 0);
});

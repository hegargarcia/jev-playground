import { test } from "node:test";
import assert from "node:assert/strict";
import { Experimental_EvaluationMockModelV4 } from "ai/test";
import { chooseMove } from "./ai-move";
import { emptyBoard, getGameState, moveRequestSchema, type Board } from "./game";
import { POST } from "../app/api/move/route";

const opening: Board = ["X", null, null, null, null, null, null, null, null];

function modelChoosing(choice: string) {
  return new Experimental_EvaluationMockModelV4({
    doEvaluate: async () => ({
      answers: { move: { type: "choice", choice } },
      warnings: [],
    }),
  });
}

test("offers only empty squares and preserves every returned weight, including zero", async () => {
  const probabilities = { "1": 0.01, "2": 0.005, "3": 0.015, "4": 0.9, "5": 0.02, "6": 0.03, "7": 0.02, "8": 0 };
  const model = new Experimental_EvaluationMockModelV4({
    doEvaluate: async ({ state, questions }) => {
      assert.deepEqual(Object.keys(questions.move.criteria ?? {}), ["1", "2", "3", "4", "5", "6", "7", "8"]);
      assert.deepEqual(state, {
        game: "Tic tac toe",
        player: "O",
        opponent: "X",
        rows: [["X", null, null], [null, null, null], [null, null, null]],
        emptySquare: null,
      });
      return {
        answers: { move: { type: "choice", choice: "4", probabilities } },
        providerMetadata: { typesafe: { confidence: { move: 0.73 } } },
        warnings: [],
      };
    },
  });
  assert.deepEqual(await chooseMove(opening, model), {
    move: 4,
    confidence: 0.73,
    options: Object.entries(probabilities).map(([square, weight]) => ({ square: Number(square), weight })),
  });
  assert.equal(opening[4], null);
});

test("keeps all legal options when the provider omits weights without inventing values", async () => {
  const decision = await chooseMove(opening, modelChoosing("4"));
  assert.equal(decision.move, 4);
  assert.equal(decision.confidence, null);
  assert.deepEqual(decision.options, [1, 2, 3, 4, 5, 6, 7, 8].map((square) => ({ square, weight: null })));
});

test("preserves zero confidence and treats invalid confidence as unavailable", async () => {
  for (const confidence of [0, 1, "unknown", -1, 2]) {
    const model = new Experimental_EvaluationMockModelV4({
      doEvaluate: async () => ({
        answers: { move: { type: "choice", choice: "4" } },
        providerMetadata: { typesafe: { confidence: { move: confidence } } },
        warnings: [],
      }),
    });
    const decision = await chooseMove(opening, model);
    assert.equal(decision.confidence, confidence === 0 || confidence === 1 ? confidence : null);
  }
});

test("rejects occupied, out-of-range, and malformed model choices", async () => {
  for (const choice of ["0", "9", "center"]) {
    await assert.rejects(chooseMove(opening, modelChoosing(choice)));
  }
});

test("does not call the model on X’s turn or after a win", async () => {
  const model = new Experimental_EvaluationMockModelV4({
    doEvaluate: async () => { assert.fail("Model must not be called"); },
  });
  for (const board of [emptyBoard(), ["X", "X", "X", "O", "O", null, null, null, null] satisfies Board]) {
    await assert.rejects(chooseMove(board, model), /Cannot request/);
  }
});

test("validates turn counts, board shape, and terminal positions", () => {
  assert.equal(moveRequestSchema.safeParse({ board: opening }).success, true);
  for (const board of [
    [], Array(10).fill(null), ["Z", ...Array(8).fill(null)], emptyBoard(),
    ["O", null, null, null, null, null, null, null, null],
    ["X", "X", null, null, null, null, null, null, null],
    ["X", "X", "X", "O", "O", null, null, null, null],
    ["O", "O", "O", "X", "X", null, "X", null, "X"],
    ["X", "O", "X", "X", "O", "O", "O", "X", "X"],
  ]) {
    assert.equal(moveRequestSchema.safeParse({ board }).success, false);
  }
  assert.equal(getGameState(["X", "O", "X", "X", "O", "O", "O", "X", "X"]).isDraw, true);
  assert.equal(getGameState(["O", "X", "X", null, "O", null, "X", null, "O"]).winner, "O");
});

test("API rejects malformed JSON and invalid turns before using Gateway", async () => {
  for (const body of ["{", "null", JSON.stringify({ board: emptyBoard() })]) {
    const response = await POST(new Request("http://localhost/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }));
    assert.equal(response.status, 400);
  }
});

test("propagates provider failures and cancellation without inventing a move", async () => {
  const model = new Experimental_EvaluationMockModelV4({
    doEvaluate: async () => { throw new Error("Provider unavailable"); },
  });
  await assert.rejects(chooseMove(opening, model), /Provider unavailable/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(chooseMove(opening, modelChoosing("4"), controller.signal), { name: "AbortError" });
});

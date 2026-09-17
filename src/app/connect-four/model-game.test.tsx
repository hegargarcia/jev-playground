import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { models } from "@/lib/models";
import { columns, landingSquare, moveRequestSchema } from "@/lib/connect-four";
import { ModelGame } from "./model-game";

test("Connect Four boards handle concurrent replies and resets without affecting another game", async () => {
  const window = new Window();
  const globals = {
    window,
    document: window.document,
    navigator: window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const originalGlobals = Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalFetch = globalThis.fetch;
  const requests: { model: string; signal: AbortSignal | null | undefined; complete: (move: number) => void }[] = [];
  globalThis.fetch = async (_input, init) => {
    assert.equal(typeof init?.body, "string");
    const { board, model } = moveRequestSchema.parse(JSON.parse(String(init?.body)));
    return new Promise<Response>((resolve) => {
      requests.push({
        model,
        signal: init?.signal,
        complete: (move) => resolve(Response.json({
          move,
          confidence: null,
          options: columns.filter((column) => landingSquare(board, column) >= 0).map((column) => ({ column, weight: null })),
        })),
      });
    });
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<>{models.map((model) => <ModelGame key={model.id} model={model} />)}</>));
    const games = [...container.querySelectorAll("section")];
    assert.equal(games.length, models.length);
    function square(game: number, index: number) {
      const button = games[game].querySelectorAll<HTMLButtonElement>('[role="group"] button')[index];
      assert.ok(button);
      return button;
    }
    const titleIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
    assert.equal(new Set(titleIds).size, titleIds.length);

    await act(async () => { square(0, 0).click(); square(1, 2).click(); });
    assert.deepEqual(requests.map(({ model }) => model), models.slice(0, 2).map(({ id }) => id));
    assert.equal(square(0, 1).disabled, true);
    assert.equal(square(1, 1).disabled, true);
    assert.equal(square(2, 1).disabled, false);
    assert.equal(square(3, 1).disabled, false);

    // Resolve the second board first while the first is still thinking.
    await act(async () => requests[1].complete(4));
    assert.match(square(1, 4).textContent ?? "", /O/);
    assert.doesNotMatch(square(0, 4).textContent ?? "", /[XO]/);
    assert.equal(square(0, 4).disabled, true);
    assert.equal(square(1, 0).disabled, false);

    const reset = games[0].querySelector<HTMLButtonElement>('[aria-label="Restart Jev game"]');
    assert.ok(reset);
    await act(async () => { reset.click(); square(2, 6).click(); });
    assert.equal(requests[0].signal?.aborted, true);
    assert.equal(requests[2].model, models[2].id);

    // Simulate a response arriving after reset despite cancellation.
    await act(async () => { requests[0].complete(4); requests[2].complete(4); });
    assert.doesNotMatch(square(0, 0).textContent ?? "", /[XO]/);
    assert.doesNotMatch(square(0, 4).textContent ?? "", /[XO]/);
    assert.match(games[0].textContent ?? "", /0 moves/);
    assert.match(games[1].textContent ?? "", /1 move/);
    assert.match(games[2].textContent ?? "", /1 move/);
    assert.match(games[3].textContent ?? "", /0 moves/);
    assert.match(square(1, 2).textContent ?? "", /X/);
    assert.match(square(2, 6).textContent ?? "", /X/);
    assert.equal(square(3, 0).disabled, false);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    await window.happyDOM.close();
  }
});

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { COLUMNS, ROWS, columns, dropDisc, landingSquare, emptyBoard, getGameState, moveResponseSchema, type Board } from "@/lib/connect-four";
import type { Model } from "@/lib/models";
import { DecisionLog, type DecisionLogEntry } from "./decision-log";
import styles from "../games.module.css";
import boardStyles from "./page.module.css";

export function ModelGame({ model }: { model: Model }) {
  const titleId = useId();
  const [board, setBoard] = useState(emptyBoard);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<DecisionLogEntry[]>([]);
  const pendingRequest = useRef<AbortController | null>(null);
  const { turn, winningLine, winner, isDraw, finished } = getGameState(board);

  useEffect(() => () => pendingRequest.current?.abort(), []);

  async function requestMove(currentBoard: Board) {
    if (pendingRequest.current) return;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setError(null);

    try {
      const response = await fetch("/api/connect-four/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: currentBoard, model: model.id }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(125_000)]),
      });
      if (!response.ok) throw new Error("Move request failed.");
      const decision = moveResponseSchema.parse(await response.json());
      const { move } = decision;
      if (landingSquare(currentBoard, move) < 0) throw new Error("Illegal move.");
      // A restarted game must never receive a response from the previous round.
      if (!controller.signal.aborted) {
        setBoard(dropDisc(currentBoard, move, "O"));
        setDecisions((previous) => [...previous, { ...decision, board: currentBoard, modelName: model.name }]);
      }
    } catch {
      if (!controller.signal.aborted) setError(`${model.name} couldn’t make a move. Try again.`);
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  }

  function play(column: number) {
    if (landingSquare(board, column) < 0 || finished || turn !== "X" || pendingRequest.current) return;
    const nextBoard = dropDisc(board, column, "X");
    setBoard(nextBoard);
    if (!getGameState(nextBoard).finished) void requestMove(nextBoard);
  }

  function restart() {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setError(null);
    setBoard(emptyBoard());
    setDecisions([]);
  }

  return (
    <section className={styles.game} aria-labelledby={titleId}>
      <div className={styles.modelHeading}>
        <p className={styles.eyebrow}>{model.provider}</p>
        <h2 id={titleId}>{model.name}</h2>
      </div>

      <div className={styles.players}>
        <div className={`${styles.player} ${!finished && turn === "X" ? styles.active : ""}`}>
          <span className={styles.x}>●</span><span>You · X</span>
          {!finished && turn === "X" && <span className={styles.dot} />}
        </div>
        <span className={styles.versus}>vs</span>
        <div className={`${styles.player} ${!finished && turn === "O" ? styles.active : ""}`}>
          <span className={styles.o}>●</span><span>AI · O</span>
          {!finished && turn === "O" && <span className={styles.dot} />}
        </div>
      </div>

      <div className={boardStyles.board} role="group" aria-label={`${model.name} Connect Four board`}>
        {columns.map((column) => (
          <button
            key={column}
            type="button"
            className={boardStyles.column}
            onClick={() => play(column)}
            disabled={landingSquare(board, column) < 0 || finished || turn === "O"}
            aria-label={`Drop in column ${column + 1}`}
          >
            <span className={boardStyles.columnLabel} aria-hidden="true">{column + 1} ↓</span>
            {Array.from({ length: ROWS }, (_, row) => {
              const square = row * COLUMNS + column;
              const mark = board[square];
              return (
                <span key={row} className={`${boardStyles.disc} ${mark === "X" ? boardStyles.human : mark === "O" ? boardStyles.ai : ""} ${winningLine.includes(square) ? boardStyles.winning : ""}`} aria-hidden="true">
                  {mark}
                </span>
              );
            })}
          </button>
        ))}
      </div>
      <p className={boardStyles.srOnly}>Board, rows top to bottom: {board.map((cell, index) => `${cell ?? "empty"}${(index + 1) % COLUMNS === 0 ? ";" : ","}`).join(" ")}</p>

      <p className={styles.status} role="status" aria-live="polite">
        {winner ? winner === "X" ? "You win. Nicely played!" : `${model.name} wins. Another round?` : isDraw ? "A draw. Great minds think alike." : error ?? (turn === "O" ? `${model.name} is thinking…` : "Your turn")}
      </p>
      <div className={styles.gameActions}>
        {error && <button className={styles.reset} type="button" onClick={() => void requestMove(board)}>Retry move</button>}
        <button className={styles.reset} type="button" onClick={restart} aria-label={`Restart ${model.name} game`}>
          <span aria-hidden="true">↻</span> {finished ? "Play again" : "Start over"}
        </button>
      </div>
      <DecisionLog entries={decisions} />
    </section>
  );
}

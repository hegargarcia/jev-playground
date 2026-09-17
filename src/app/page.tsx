"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { emptyBoard, getGameState, moveResponseSchema, type Board } from "@/lib/game";
import styles from "./page.module.css";
import { DecisionLog, type DecisionLogEntry } from "./decision-log";

export default function Home() {
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
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: currentBoard }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]),
      });
      if (!response.ok) throw new Error("Move request failed.");
      const decision = moveResponseSchema.parse(await response.json());
      const { move } = decision;
      if (currentBoard[move] !== null) throw new Error("Illegal move.");
      // A restarted game must never receive a response from the previous round.
      if (!controller.signal.aborted) {
        setBoard(currentBoard.map((mark, index) => index === move ? "O" : mark));
        setDecisions((previous) => [...previous, { ...decision, board: currentBoard }]);
      }
    } catch {
      if (!controller.signal.aborted) setError("Jev couldn’t make a move. Try again.");
    } finally {
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  }

  function play(index: number) {
    if (board[index] || finished || turn !== "X" || pendingRequest.current) return;
    const nextBoard = board.map((square, position) => position === index ? "X" as const : square);
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
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Tic tac toe home">
          <span aria-hidden="true" className={styles.brandMark}>×○</span>
          little games
        </Link>
        <span className={styles.edition}>NO. 001 / THE CLASSICS</span>
      </header>

      <div className={styles.playArea}>
      <section className={styles.game} aria-labelledby="game-title">
        <p className={styles.eyebrow}>YOU VS JEV. NINE SQUARES.</p>
        <h1 id="game-title">Your move.</h1>
        <p className={styles.description}>You’re X. Jev plays O. Get three in a row.</p>

        <div className={styles.players}>
          <div className={`${styles.player} ${!finished && turn === "X" ? styles.active : ""}`}>
            <span className={styles.x}>×</span><span>You</span>
            {!finished && turn === "X" && <span className={styles.dot} />}
          </div>
          <span className={styles.versus}>vs</span>
          <div className={`${styles.player} ${!finished && turn === "O" ? styles.active : ""}`}>
            <span className={styles.o}>○</span><span>Jev</span>
            {!finished && turn === "O" && <span className={styles.dot} />}
          </div>
        </div>

        <div className={styles.board} role="group" aria-label="Tic tac toe board">
          {board.map((mark, index) => (
            <button
              key={index}
              type="button"
              className={`${styles.square} ${mark === "X" ? styles.x : styles.o} ${winningLine?.includes(index) ? styles.winning : ""}`}
              onClick={() => play(index)}
              disabled={Boolean(mark) || finished || turn === "O"}
              aria-label={`Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${mark ?? "empty"}`}
            >
              {mark && <span aria-hidden="true">{mark === "X" ? "×" : "○"}</span>}
            </button>
          ))}
        </div>

        <p className={styles.status} role="status" aria-live="polite">
          {winner ? winner === "X" ? "You win. Nicely played!" : "Jev wins. Another round?" : isDraw ? "A draw. Great minds think alike." : error ?? (turn === "O" ? "Jev is thinking…" : "Your turn")}
        </p>
        {error && <button className={styles.reset} type="button" onClick={() => void requestMove(board)}>Retry Jev’s move</button>}
        {" "}
        <button className={styles.reset} type="button" onClick={restart}>
          <span aria-hidden="true">↻</span> {finished ? "Play again" : "Start over"}
        </button>
      </section>
      <DecisionLog entries={decisions} />
      </div>

      <footer className={styles.footer}>
        <span>TIC / TAC / TOE</span>
        <span>Less scrolling, more playing.</span>
      </footer>
    </main>
  );
}

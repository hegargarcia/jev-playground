import type { Board, MoveDecision } from "@/lib/game";
import { useId } from "react";
import styles from "./page.module.css";

export type DecisionLogEntry = MoveDecision & { board: Board; modelName: string };

function squareLabel(square: number) {
  return `R${Math.floor(square / 3) + 1} · C${square % 3 + 1}`;
}

function formatPercentage(weight: number | null) {
  if (weight === null) return "N/A";
  if (weight > 0 && weight < 0.0001) return "<0.01%";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 }).format(weight);
}

export function DecisionLog({ entries }: { entries: DecisionLogEntry[] }) {
  const titleId = useId();
  return (
    <aside className={styles.decisionLog} aria-labelledby={titleId}>
      <div className={styles.logHeading}>
        <div>
          <p className={styles.eyebrow}>INSIDE THE MOVE</p>
          <h3 id={titleId}>Decision log</h3>
        </div>
        <span className={styles.logCount}>{entries.length} {entries.length === 1 ? "move" : "moves"}</span>
      </div>
      <p className={styles.logDescription}>Model weights for each legal square. Rows and columns start at 1.</p>
      {entries.length === 0 ? (
        <div className={styles.logEmpty}>
          <span aria-hidden="true">○</span>
          <p>A little window into your opponent’s choices.</p>
          <p>Make your move to see the first decision.</p>
        </div>
      ) : (
        <ol className={styles.logEntries} aria-label="AI move history, newest first">
          {entries.map((entry, index) => ({ entry, number: index + 1 })).reverse().map(({ entry, number }) => (
            <li key={number} className={styles.decisionCard}>
              <div className={styles.decisionHeader}>
                <div>
                  <p className={styles.eyebrow}>O MOVE {String(number).padStart(2, "0")} · {entry.modelName}</p>
                  <h4>Chose {squareLabel(entry.move)}</h4>
                  <p className={styles.confidence} title="The provider’s reported confidence in this evaluation.">
                    Response confidence <strong>{entry.confidence == null ? "Not provided" : formatPercentage(entry.confidence)}</strong>
                  </p>
                </div>
                <div className={styles.miniBoard} role="img" aria-label={`Board after AI move ${number}; chosen row ${Math.floor(entry.move / 3) + 1}, column ${entry.move % 3 + 1}`}>
                  {entry.board.map((mark, square) => (
                    <span key={square} className={square === entry.move ? styles.miniChosen : undefined}>
                      {square === entry.move ? "○" : mark === "X" ? "×" : mark === "O" ? "○" : "·"}
                    </span>
                  ))}
                </div>
              </div>
              <ul className={styles.optionList} aria-label={`Option weights for O move ${number}`}>
                {entry.options.map(({ square, weight }) => (
                  <li key={square} className={`${styles.optionRow} ${square === entry.move ? styles.chosenOption : ""}`}>
                    <span className={styles.optionLabel}>
                      {squareLabel(square)}
                      {square === entry.move && <span className={styles.chosenLabel}>Chosen</span>}
                    </span>
                    <span className={styles.weightTrack} aria-hidden="true">
                      <span className={styles.weightFill} style={{ width: `${(weight ?? 0) * 100}%` }} />
                    </span>
                    <span className={styles.weightValue} title={weight === null ? "Weight not supplied" : String(weight)}>{formatPercentage(weight)}</span>
                  </li>
                ))}
              </ul>
              {entry.options.some(({ weight }) => weight === null) && (
                <p className={styles.missingWeights}>{entry.modelName} does not supply option weights through this evaluation API.</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

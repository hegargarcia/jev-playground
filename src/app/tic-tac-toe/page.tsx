import Link from "next/link";
import { models } from "@/lib/models";
import { ModelGame } from "./model-game";
import styles from "../games.module.css";

export default function TicTacToe() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tic-tac-toe" className={styles.brand} aria-label="Tic tac toe home">
          <span aria-hidden="true" className={styles.brandMark}>×○</span>
          little games
        </Link>
        <Link href="/connect-four" className={styles.reset}>Play Connect Four →</Link>
      </header>

      <div className={styles.intro}>
        <p className={styles.eyebrow}>{models.length} OPPONENTS. YOUR MOVE.</p>
        <h1>A little friendly competition.</h1>
        <p className={styles.description}>You’re X on every board. Play each model independently—even while another is thinking.</p>
      </div>
      <div className={styles.games}>
        {models.map((model) => <ModelGame key={model.id} model={model} />)}
      </div>

      <footer className={styles.footer}>
        <span>TIC / TAC / TOE</span>
        <span>Less scrolling, more playing.</span>
      </footer>
    </main>
  );
}

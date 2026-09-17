import Link from "next/link";
import { models } from "@/lib/models";
import { ModelGame } from "./model-game";
import styles from "../games.module.css";

export const metadata = {
  title: "Connect Four | Little Games",
  description: "Play Connect Four against five AI models, with independent boards and move decision logs.",
};

export default function ConnectFour() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/tic-tac-toe" className={styles.brand} aria-label="Tic tac toe home">
          <span aria-hidden="true" className={styles.brandMark}>×○</span>
          little games
        </Link>
        <Link href="/tic-tac-toe" className={styles.reset}>Play tic-tac-toe →</Link>
      </header>

      <div className={styles.intro}>
        <p className={styles.eyebrow}>{models.length} OPPONENTS. YOUR MOVE.</p>
        <h1>Four in a row. Five rivals.</h1>
        <p className={styles.description}>Drop a disc into any column. You’re terracotta (X); AI is olive (O). Connect four horizontally, vertically, or diagonally. Each board plays independently.</p>
      </div>
      <div className={styles.games}>
        {models.map((model) => <ModelGame key={model.id} model={model} />)}
      </div>

      <footer className={styles.footer}>
        <span>CONNECT / FOUR</span>
        <span>Less scrolling, more playing.</span>
      </footer>
    </main>
  );
}

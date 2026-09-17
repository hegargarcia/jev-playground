import Link from "next/link";
import { models } from "@/lib/models";
import { ModelGame } from "./model-game";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Tic tac toe home">
          <span aria-hidden="true" className={styles.brandMark}>×○</span>
          little games
        </Link>
        <span className={styles.edition}>NO. 001 / THE CLASSICS</span>
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

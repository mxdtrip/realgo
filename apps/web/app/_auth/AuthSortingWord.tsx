"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type Props = {
  word: "login" | "register";
  label: string;
};

const COMPARE_MS = 90;
const SWAP_MS = 430;
const SWAP_PAUSE_MS = 45;
const START_DELAY_MS = 220;

// Visual slot order, rather than alphabetical order: every token finds its
// own index in the final word. These are deliberately non-alphabetical.
const INITIAL_ORDERS = {
  login: [2, 4, 0, 3, 1],
  register: [5, 1, 7, 3, 0, 6, 2, 4],
} as const;

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/** One-line auth sibling of the landing hero's adjacent-swap sort. */
export function AuthSortingWord({ word, label }: Props) {
  const [order, setOrder] = useState<number[]>(() => [...INITIAL_ORDERS[word]]);
  const [active, setActive] = useState<number[]>([]);
  const runId = useRef(0);

  useEffect(() => {
    const initial: number[] = [...INITIAL_ORDERS[word]];
    const currentRun = runId.current + 1;
    runId.current = currentRun;
    setOrder(initial);
    setActive([]);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOrder(Array.from({ length: word.length }, (_, index) => index));
      return;
    }

    async function sort() {
      await sleep(START_DELAY_MS);
      if (runId.current !== currentRun) return;

      const slotOrder = [...initial];

      // Bubble-sort the token positions. Unlike the CSS-only entrance, every
      // move is one adjacent, highlighted pair — the same rhythm as the hero.
      for (let target = 0; target < slotOrder.length; target += 1) {
        let index = slotOrder.indexOf(target);

        while (index > target) {
          const left = slotOrder[index - 1];
          const right = slotOrder[index];
          setActive([left, right]);
          await sleep(COMPARE_MS);
          if (runId.current !== currentRun) return;

          [slotOrder[index - 1], slotOrder[index]] = [slotOrder[index], slotOrder[index - 1]];
          setOrder([...slotOrder]);
          await sleep(SWAP_MS);
          if (runId.current !== currentRun) return;

          setActive([]);
          await sleep(SWAP_PAUSE_MS);
          if (runId.current !== currentRun) return;
          index -= 1;
        }
      }

      setActive([]);
    }

    void sort();

    return () => {
      runId.current += 1;
    };
  }, [word]);

  return (
    <h1 aria-label={label} className="auth-sorting-word" style={{ "--letter-count": word.length } as CSSProperties}>
      {Array.from(word).map((letter, index) => (
        <span
          aria-hidden="true"
          className={active.includes(index) ? "auth-sorting-word__letter is-active" : "auth-sorting-word__letter"}
          key={index}
          style={{ "--letter-position": order.indexOf(index) } as CSSProperties}
        >
          {letter}
        </span>
      ))}
    </h1>
  );
}

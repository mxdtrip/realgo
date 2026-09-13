import type { CSSProperties } from "react";

type Props = {
  word: "login" | "register";
  label: string;
};

// Deliberately non-alphabetical permutations. Each index is a letter's starting
// slot; the CSS animation then brings it to its actual index in the word.
const STARTING_SLOTS = {
  login: [2, 4, 0, 3, 1],
  register: [4, 1, 6, 3, 7, 0, 5, 2],
} as const;

/**
 * A one-line auth adaptation of the landing's sorting word. CSS owns the
 * entrance so it runs reliably on first paint without a click or a scatter.
 */
export function AuthSortingWord({ word, label }: Props) {
  const startingSlots = STARTING_SLOTS[word];

  return (
    <h1 aria-label={label} className="auth-sorting-word" style={{ "--letter-count": word.length } as CSSProperties}>
      {Array.from(word).map((letter, index) => (
        <span
          aria-hidden="true"
          className="auth-sorting-word__letter"
          key={index}
          style={
            {
              "--letter-index": index,
              "--letter-position": startingSlots[index],
              "--sort-delay": `${160 + ((index * 97) % 5) * 55}ms`,
            } as CSSProperties
          }
        >
          {letter}
        </span>
      ))}
    </h1>
  );
}

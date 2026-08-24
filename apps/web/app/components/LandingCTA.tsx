import { keepShortWords } from "../_content/i18n";

type LandingCTAProps = {
  label: string;
  intent: string;
  align?: "start" | "center";
};

export function LandingCTA({ label, intent, align = "start" }: LandingCTAProps) {
  return (
    <div className={`landing-cta landing-cta--${align}`}>
      <a className="landing-cta__button" href={`/register?intent=${intent}`}>
        {intent === "memory-agent" ? (
          <svg
            aria-hidden="true"
            className="landing-cta__icon"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 1.5V10M8 10L4.75 6.75M8 10L11.25 6.75M2 10.75V14.5H14V10.75" />
          </svg>
        ) : null}
        {keepShortWords(label)}
      </a>
    </div>
  );
}

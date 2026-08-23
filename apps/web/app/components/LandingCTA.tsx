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
        {keepShortWords(label)}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { getDictionary, keepShortWords } from "../_content/i18n";
import { FlipReviewCard } from "../components/FlipReviewCard";
import { LandingCTA } from "../components/LandingCTA";
import { MemoryJourney } from "../components/MemoryJourney";
import { RoadmapDemo } from "../components/RoadmapDemo";
import { ScrollReveal } from "../components/ScrollReveal";
import { ScrollVideoBackground } from "../components/ScrollVideoBackground";
import { SiteFooter } from "../components/SiteFooter";
import { SortingMemoryHero } from "../components/SortingMemoryHero";
import { LandingFAQ } from "./LandingFAQ";

const metadataCopy = getDictionary().common.metadata;

function renderGradientPhrases(value: string, phrases: string[]): ReactNode {
  const text = keepShortWords(value);
  const ranges = phrases
    .map((phrase) => {
      const target = keepShortWords(phrase);
      return { start: text.indexOf(target), target };
    })
    .filter((range) => range.start >= 0)
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) {
    return text;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(({ start, target }) => {
    if (start < cursor) {
      return;
    }

    nodes.push(text.slice(cursor, start));
    nodes.push(
      <span className="landing-gradient-text" key={`${target}-${start}`}>
        {target}
      </span>,
    );
    cursor = start + target.length;
  });

  nodes.push(text.slice(cursor));
  return nodes;
}

export const metadata: Metadata = {
  title: {
    absolute: metadataCopy.title,
  },
  description: metadataCopy.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: metadataCopy.title,
    description: metadataCopy.description,
    url: "/",
    siteName: metadataCopy.applicationName,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: metadataCopy.ogImageAlt,
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataCopy.title,
    description: metadataCopy.description,
    images: ["/opengraph-image"],
  },
};

export default function Home() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.sections.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  const applicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: dictionary.common.brand,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, Chrome",
    url: dictionary.common.metadata.siteUrl,
    description: dictionary.common.metadata.description,
    inLanguage: "ru",
    offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "RUB" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(applicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <ScrollVideoBackground />
      <ScrollReveal />
      <SortingMemoryHero />

      <aside className="landing-proof" aria-label="ReAlgo в цифрах">
        {copy.proof.map((item, index) => (
          <div key={item.label}>
            <span className="landing-proof__icon" aria-hidden="true">
              {index === 0 ? (
                <svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><circle cx="8" cy="16" r="3" /><circle cx="16" cy="16" r="3" /></svg>
              ) : index === 1 ? (
                <svg viewBox="0 0 24 24"><path d="M7 7h11M7 12h11M7 17h11" /><circle cx="4" cy="7" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="17" r="1" /></svg>
              ) : (
                <svg viewBox="0 0 24 24"><path d="M4 20V7l8-4 8 4v13M2 20h20M8 20v-5h8v5" /><path d="M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01" /></svg>
              )}
            </span>
            <div className="landing-proof__copy">
              <strong>{item.value}</strong>
              <span>{keepShortWords(item.label)}</span>
            </div>
          </div>
        ))}
      </aside>

      <div className="landing-platforms landing-awards" aria-label="Награды ReAlgo на хакатоне Kodik Launchpad">
        <span
          className="landing-awards__title"
          aria-label={`${copy.awards.title} ${copy.awards.event}`}
        >
          <svg className="landing-awards__branch" viewBox="0 0 64 128" aria-hidden="true">
            <defs>
              <linearGradient id="landingLaurelGoldLeft" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0" stopColor="#fbf1c7" />
                <stop offset="0.36" stopColor="#e6c86a" />
                <stop offset="0.72" stopColor="#c99a2e" />
                <stop offset="1" stopColor="#8d6d21" />
              </linearGradient>
            </defs>
            <path d="M52 124 C14 104 4 52 38 4" fill="none" stroke="url(#landingLaurelGoldLeft)" strokeWidth="2.6" strokeLinecap="round" />
            <g fill="url(#landingLaurelGoldLeft)">
              <ellipse cx="34.24" cy="118.75" rx="8.61" ry="3.49" transform="rotate(166.93 34.24 118.75)" />
              <ellipse cx="23.11" cy="106.48" rx="9.36" ry="3.8" transform="rotate(-179.6 23.11 106.48)" />
              <ellipse cx="15.13" cy="91.88" rx="10.1" ry="4.1" transform="rotate(-166.47 15.13 91.88)" />
              <ellipse cx="10.89" cy="75.68" rx="10.35" ry="4.2" transform="rotate(-153.95 10.89 75.68)" />
              <ellipse cx="10.73" cy="58.86" rx="9.61" ry="3.9" transform="rotate(-142.18 10.73 58.86)" />
              <ellipse cx="13.83" cy="41.57" rx="8.86" ry="3.59" transform="rotate(-131.15 13.83 41.57)" />
              <ellipse cx="20.25" cy="24.11" rx="8.11" ry="3.29" transform="rotate(-120.85 20.25 24.11)" />
              <ellipse cx="30.06" cy="6.77" rx="7.37" ry="2.99" transform="rotate(-111.24 30.06 6.77)" />
            </g>
          </svg>
          <span className="landing-awards__copy">
            <span>{copy.awards.title}</span>
            <span>
              «<strong>{copy.awards.eventName}</strong> {copy.awards.eventYear}»
            </span>
          </span>
          <svg className="landing-awards__branch landing-awards__branch--mirrored" viewBox="0 0 64 128" aria-hidden="true">
            <defs>
              <linearGradient id="landingLaurelGoldRight" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0" stopColor="#fbf1c7" />
                <stop offset="0.36" stopColor="#e6c86a" />
                <stop offset="0.72" stopColor="#c99a2e" />
                <stop offset="1" stopColor="#8d6d21" />
              </linearGradient>
            </defs>
            <path d="M52 124 C14 104 4 52 38 4" fill="none" stroke="url(#landingLaurelGoldRight)" strokeWidth="2.6" strokeLinecap="round" />
            <g fill="url(#landingLaurelGoldRight)">
              <ellipse cx="34.24" cy="118.75" rx="8.61" ry="3.49" transform="rotate(166.93 34.24 118.75)" />
              <ellipse cx="23.11" cy="106.48" rx="9.36" ry="3.8" transform="rotate(-179.6 23.11 106.48)" />
              <ellipse cx="15.13" cy="91.88" rx="10.1" ry="4.1" transform="rotate(-166.47 15.13 91.88)" />
              <ellipse cx="10.89" cy="75.68" rx="10.35" ry="4.2" transform="rotate(-153.95 10.89 75.68)" />
              <ellipse cx="10.73" cy="58.86" rx="9.61" ry="3.9" transform="rotate(-142.18 10.73 58.86)" />
              <ellipse cx="13.83" cy="41.57" rx="8.86" ry="3.59" transform="rotate(-131.15 13.83 41.57)" />
              <ellipse cx="20.25" cy="24.11" rx="8.11" ry="3.29" transform="rotate(-120.85 20.25 24.11)" />
              <ellipse cx="30.06" cy="6.77" rx="7.37" ry="2.99" transform="rotate(-111.24 30.06 6.77)" />
            </g>
          </svg>
        </span>
      </div>

      <div className="landing-hero-transition" aria-hidden="true" />

      <MemoryJourney section={copy.sections.memory} />

      <section className="landing-section" id="roadmap">
        <div className="section-kicker" data-reveal="blur">
          {keepShortWords(copy.sections.roadmap.kicker)}
        </div>
        <div className="section-grid reverse">
          <RoadmapDemo>
            {copy.roadmapWeeks.map((week, index) => (
              <article
                className="roadmap-row"
                key={week.label}
                style={{ "--week-index": index, "--progress": `${week.progress}%` } as CSSProperties}
              >
                <div className="roadmap-row__meta">
                  <span>{keepShortWords(week.label)}</span>
                  <span className={`roadmap-row__state roadmap-row__state--${week.tone}`}>
                    {keepShortWords(week.state)}
                  </span>
                </div>
                <strong>{keepShortWords(week.title)}</strong>
                <p>{keepShortWords(week.focus)}</p>
                <div className="roadmap-progress" aria-hidden="true">
                  <span className="roadmap-progress__track">
                    <i className="roadmap-progress__fill" />
                  </span>
                  <em className="roadmap-progress__value">{week.progress}%</em>
                </div>
              </article>
            ))}
          </RoadmapDemo>
          <div className="section-copy" data-reveal="right">
            <h2>{keepShortWords(copy.sections.roadmap.title)}</h2>
            <p>{keepShortWords(copy.sections.roadmap.description)}</p>
            <LandingCTA
              label={copy.sections.roadmap.cta}
              intent="roadmap"
            />
          </div>
        </div>
      </section>

      <section className="landing-section" id="reviews">
        <div className="section-kicker" data-reveal="blur">
          {keepShortWords(copy.sections.reviews.kicker)}
        </div>
        <div className="section-copy wide" data-reveal="up">
          <h2>{keepShortWords(copy.sections.reviews.title)}</h2>
          <p>{keepShortWords(copy.sections.reviews.description)}</p>
        </div>
        <div className="review-grid">
          {copy.reviewCards.map(([type, front, back], index) => (
            <div className="review-card" data-reveal="tilt" data-reveal-delay={index * 100} key={type}>
              <FlipReviewCard
                type={type}
                front={front}
                back={back}
                flipAria={{
                  showAnswer: copy.sections.reviews.flipToAnswer,
                  showQuestion: copy.sections.reviews.flipToQuestion,
                }}
              />
            </div>
          ))}
        </div>
        <LandingCTA
          label={copy.sections.reviews.cta}
          intent="reviews"
          align="center"
        />
      </section>

      <section className="landing-section" id="pricing">
        <div className="section-kicker" data-reveal="blur">
          {keepShortWords(copy.sections.pricing.kicker)}
        </div>
        <div className="section-grid">
          <div className="section-copy" data-reveal="left">
            <h2>{renderGradientPhrases(copy.sections.pricing.title, ["Free", "Pro"])}</h2>
            <p>{keepShortWords(copy.sections.pricing.description)}</p>
          </div>
          <div className="pricing-grid">
            {copy.pricing.map(([name, price, features, cta, period], index) => (
              <article
                className="price-card"
                data-reveal="zoom"
                data-reveal-delay={index * 110}
                key={name}
              >
                <span className="price-card__name">{keepShortWords(name)}</span>
                <strong>
                  {keepShortWords(price)}
                  {/* Pro — разовая бессрочная лицензия. Без этой подписи цена
                      рядом с бесплатным планом читается как ежемесячная: это
                      то, чего посетитель ждёт от таблицы тарифов по умолчанию. */}
                  {period ? <span className="price-period">{keepShortWords(period)}</span> : null}
                </strong>
                <ul className="price-features">
                  {features.map((feature) => (
                    <li key={feature}>{keepShortWords(feature)}</li>
                  ))}
                </ul>
                <a
                  className="price-cta"
                  href={`/register?intent=pricing-${name.toLowerCase()}`}
                >
                  {cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <LandingFAQ section={copy.sections.faq} />

      <SiteFooter />

    </>
  );
}

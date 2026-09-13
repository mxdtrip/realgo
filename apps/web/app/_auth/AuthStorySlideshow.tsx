"use client";

import { useEffect, useState } from "react";

const SLIDES = [
  {
    author: "Линус Торвальдс",
    image: "/auth-cows-laptop.png",
    quote: <>Плохие программисты беспокоятся о коде.<br />Хорошие — о структурах данных и их взаимосвязях.</>,
  },
  {
    author: "C. A. R. Hoare",
    image: "/auth-boat-laptop.png",
    quote: <>Сделайте систему настолько простой,<br />чтобы в ней очевидно не было недостатков.</>,
  },
] as const;

export function AuthStorySlideshow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setActive((current) => (current + 1) % SLIDES.length), 8500);
    return () => window.clearInterval(interval);
  }, []);

  const slide = SLIDES[active];

  return (
    <>
      <div aria-hidden="true" className="auth-story-slides">
        {SLIDES.map((item, index) => (
          <div
            className={index === active ? "auth-story-slide is-active" : "auth-story-slide"}
            key={item.image}
            style={{ backgroundImage: `url("${item.image}")` }}
          />
        ))}
      </div>
      <div className="auth-page__story-content" key={slide.image}>
        <span aria-hidden="true" className="auth-page__quote-line" />
        <blockquote>{slide.quote}</blockquote>
        <p>{slide.author}</p>
      </div>
    </>
  );
}

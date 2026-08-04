"use client";

import { useEffect, useState } from "react";

import { getDictionary } from "../_content/i18n";

/** Delay before the notice slides in, so it never covers the hero on first paint. */
const APPEAR_DELAY_MS = 1500;

/**
 * Dismissible "we won Kodik Launchpad" notice, pinned bottom-right on the
 * landing page and rendered in Kodik's brand colours (#46BF4C on a near-black
 * green-tinted surface, with the pixel-cat mascot in a framed tile).
 *
 * Layout note: the card is a plain region, not a link. Wrapping it in an <a>
 * would nest the dismiss button inside an anchor, which is invalid HTML and
 * makes the close target unreliable for keyboard and screen-reader users.
 * Instead the CTA anchor is stretched over the whole card with ::after, and
 * the dismiss button sits above it in the stacking order — one link, one
 * button, both independently focusable.
 *
 * Dismissal deliberately lasts only for the current page view: it is not
 * written to storage, so the notice comes back on the next visit to the
 * landing page. To make it stick instead, persist a flag in localStorage under
 * a versioned key (e.g. `realgo:kodik-win-notice:v1`) in `dismiss()` and read
 * it in the mount effect below — bumping the version is then how the notice is
 * brought back for everyone.
 */
export function KodikWinNotice() {
  const copy = getDictionary().marketing.hackathonNotice;
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <aside aria-label={copy.regionLabel} className={`kodik-notice${visible ? " is-visible" : ""}`}>
      <span aria-hidden="true" className="kodik-notice__mascot">
        {/* Decorative: the accessible name of the whole region already says
            what this is, so the mascot is hidden rather than announced. */}
        <img alt="" decoding="async" height="100" loading="lazy" src="/icons/kodik-cat.svg" width="108" />
      </span>

      <div className="kodik-notice__body">
        <p className="kodik-notice__eyebrow">{copy.eyebrow}</p>
        <p className="kodik-notice__title">{copy.title}</p>
        <p className="kodik-notice__text">{copy.description}</p>
        {/*
          Served by the `presentation` nginx container, not by Next: Caddy
          strips the /presentation prefix and proxies there. Left without a
          trailing slash on purpose — Caddy 308s to the slash form, which is
          what the deck's relative asset paths need.
        */}
        <a className="kodik-notice__cta" href={copy.href}>
          {copy.cta}
          <svg aria-hidden="true" height="12" viewBox="0 0 16 16" width="12">
            <path
              d="M4.5 2.5h9v9"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M13 3 3 13"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </a>
      </div>

      <button
        aria-label={copy.dismiss}
        className="kodik-notice__dismiss"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <svg aria-hidden="true" height="12" viewBox="0 0 16 16" width="12">
          <path
            d="M3 3l10 10M13 3L3 13"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </aside>
  );
}

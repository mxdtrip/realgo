"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CabinetIcon } from "../(cabinet)/_icons";
import { CabinetInterviewCountdown } from "../(cabinet)/CabinetInterviewCountdown";
import { CabinetNav, type CabinetNavGroup } from "../(cabinet)/CabinetNav";
import { openReportProblemDialog } from "../(cabinet)/ReportProblemDialog";
import { useAuth } from "../_api/AuthProvider";
import type { AccountMenuCopy } from "../components/AccountUserMenu";

type InterviewCopy = {
  missing: string;
  past: string;
  prefix: string;
  today: string;
};

type CabinetMobileNavProps = {
  accountCopy?: AccountMenuCopy;
  ariaLabel: string;
  backHref?: string;
  backLabel?: string;
  brand: string;
  groups: readonly CabinetNavGroup[];
  interviewCopy: InterviewCopy;
};

const DESKTOP_NAV_QUERY = "(min-width: 921px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Fallback in case `animationend` never fires (e.g. animations disabled by the
// browser); must be >= the longest exit animation in globals.css.
const EXIT_FALLBACK_MS = 360;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => node.getClientRects().length > 0 && node.getAttribute("aria-hidden") !== "true",
  );
}

// Short glyph captions for the horizontal action row. The full wording from the
// dictionary stays on `aria-label`/`title`, so screen readers and tooltips keep
// the descriptive text while the visible label stays one word wide.
const ACTION_LABELS = {
  settings: "настройки",
  site: "на сайт",
  report: "ошибка",
  logout: "выход",
} as const;

/**
 * Account section inside the full-screen menu. On mobile the sidebar (and with
 * it the user popup menu) is hidden, so settings / site / report / logout must
 * be reachable from here. Laid out as one horizontal row of icon buttons: four
 * stacked list rows used to eat ~200px of vertical space, which pushed the nav
 * itself off screen on short devices.
 */
function CabinetMobileAccount({
  backHref,
  backLabel,
  copy,
  onClose,
  onNavigate,
}: Readonly<{
  backHref: string;
  backLabel?: string;
  copy: AccountMenuCopy;
  onClose: () => void;
  onNavigate: () => void;
}>) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const displayName = user ? user.email.split("@")[0] : copy.name;
  const displayPlan = user?.plan ?? "free";
  const initials = user ? user.email.slice(0, 2).toLowerCase() : copy.initials;

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    await logout();
    router.push("/");
  }

  return (
    <div className="cabinet-mobile-nav__account">
      <div className="cabinet-mobile-nav__identity">
        <span className="user-avatar" aria-hidden="true">
          {initials}
          <i className="user-avatar__dot" />
        </span>
        <span className="cabinet-mobile-nav__identity-id">
          <strong>{displayName}</strong>
          <span>{displayPlan}</span>
        </span>
      </div>

      <div className="cabinet-mobile-nav__actions">
        <Link
          className="cabinet-mobile-nav__action"
          href="/settings"
          onClick={onNavigate}
          aria-label={copy.menuSettings}
          title={copy.menuSettings}
        >
          <CabinetIcon name="settings" />
          <span>{ACTION_LABELS.settings}</span>
        </Link>

        {backLabel ? (
          <Link
            className="cabinet-mobile-nav__action"
            href={backHref}
            onClick={onNavigate}
            aria-label={backLabel}
            title={backLabel}
          >
            <CabinetIcon name="arrow" />
            <span>{ACTION_LABELS.site}</span>
          </Link>
        ) : null}

        <button
          className="cabinet-mobile-nav__action"
          type="button"
          aria-label={copy.menuReport}
          title={copy.menuReport}
          onClick={() => {
            onClose();
            openReportProblemDialog();
          }}
        >
          <CabinetIcon name="megaphone" />
          <span>{ACTION_LABELS.report}</span>
        </button>

        <button
          className="cabinet-mobile-nav__action cabinet-mobile-nav__action--danger"
          type="button"
          aria-label={copy.menuLogout}
          title={copy.menuLogout}
          onClick={handleLogout}
          disabled={pending}
        >
          <CabinetIcon name="logout" />
          <span>{pending ? "…" : ACTION_LABELS.logout}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Full-screen mobile navigation for the cabinet. Opens on top of the page as a
 * modal dialog: locks body scroll, traps focus, closes on Escape / navigation /
 * resize to desktop, restores focus to the trigger, and honours
 * prefers-reduced-motion (exit animation is skipped entirely).
 */
export function CabinetMobileNav({
  accountCopy,
  ariaLabel,
  backHref = "/",
  backLabel,
  brand,
  groups,
  interviewCopy,
}: Readonly<CabinetMobileNavProps>) {
  // "closed" -> unmounted, "open" -> entrance animation, "closing" -> exit
  // animation still playing (unmounts on animationend or fallback timer).
  const [phase, setPhase] = useState<"closed" | "open" | "closing">("closed");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const exitTimerRef = useRef(0);

  const open = phase === "open";
  const mounted = phase !== "closed";

  const closeMenu = useCallback(() => {
    setPhase((current) => {
      if (current !== "open") return current;
      // Under reduced motion there is no exit animation to wait for.
      return window.matchMedia(REDUCED_MOTION_QUERY).matches ? "closed" : "closing";
    });
  }, []);

  const closeAfterNavigation = useCallback(() => {
    window.setTimeout(closeMenu, 0);
  }, [closeMenu]);

  // Safety net for the exit phase: unmount even if animationend never fires.
  useEffect(() => {
    if (phase !== "closing") return;
    exitTimerRef.current = window.setTimeout(() => setPhase("closed"), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(exitTimerRef.current);
  }, [phase]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_NAV_QUERY);
    const closeOnDesktop = () => {
      if (media.matches) setPhase("closed");
    };

    closeOnDesktop();
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = focusableElements(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const activeElement = document.activeElement;
      const first = items[0];
      const last = items[items.length - 1];

      if (!panel.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, closeMenu]);

  return (
    <div className="cabinet-mobile-nav">
      <button
        ref={triggerRef}
        className="cabinet-mobile-nav__trigger"
        type="button"
        aria-label={open ? "Закрыть навигацию" : "Открыть навигацию"}
        aria-expanded={open}
        aria-controls="cabinet-mobile-nav-panel"
        aria-haspopup="dialog"
        onClick={() => (open ? closeMenu() : setPhase("open"))}
      >
        <span className="cabinet-mobile-nav__burger" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

      {mounted ? (
        <div
          className="cabinet-mobile-nav__overlay"
          data-state={phase === "closing" ? "closing" : "open"}
          onAnimationEnd={(event) => {
            // Only the overlay's own exit animation unmounts the menu; item
            // animations bubble up from children and must be ignored.
            if (phase === "closing" && event.target === event.currentTarget) {
              window.clearTimeout(exitTimerRef.current);
              setPhase("closed");
            }
          }}
        >
          <div
            ref={panelRef}
            id="cabinet-mobile-nav-panel"
            className="cabinet-mobile-nav__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cabinet-mobile-nav-title"
            tabIndex={-1}
          >
            <div className="cabinet-mobile-nav__head">
              <div className="cabinet-brand-block">
                <Link className="site-brand" href="/dashboard" onClick={closeAfterNavigation}>
                  {brand}
                </Link>
                <CabinetInterviewCountdown copy={interviewCopy} />
              </div>
              <button
                ref={closeButtonRef}
                className="cabinet-mobile-nav__close"
                type="button"
                onClick={closeMenu}
                aria-label="Закрыть навигацию"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <h2 className="cabinet-mobile-nav__title" id="cabinet-mobile-nav-title">
              Навигация
            </h2>

            <div className="cabinet-mobile-nav__scroll">
              <CabinetNav groups={groups} ariaLabel={ariaLabel} onNavigate={closeAfterNavigation} />
            </div>

            {accountCopy ? (
              <div className="cabinet-mobile-nav__footer">
                <CabinetMobileAccount
                  backHref={backHref}
                  backLabel={backLabel}
                  copy={accountCopy}
                  onClose={closeMenu}
                  onNavigate={closeAfterNavigation}
                />
              </div>
            ) : backLabel ? (
              <div className="cabinet-mobile-nav__footer">
                <Link
                  className="cabinet-mobile-nav__back"
                  href={backHref}
                  onClick={closeAfterNavigation}
                >
                  {backLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

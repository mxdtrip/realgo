"use client";

import { useEffect, useRef, useState } from "react";

import { CabinetIcon } from "./_icons";
import { ApiError } from "../_api/types";
import { submitProblemReport, type ProblemReportResult } from "../_api/reports";
import { captureScreenshot, supportsScreenshotCapture } from "../_diagnostics/captureScreenshot";
import {
  createDiagnosticReport,
  type DiagnosticReport,
  type ReportScreenshot,
} from "../_diagnostics/reportDiagnostics";

export type ReportCopy = Readonly<{
  triggerAria: string;
  title: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  privacyNote: string;
  send: string;
  sending: string;
  sentTitle: string;
  sentNote: string;
  reportIdLabel: string;
  sendFailed: string;
  retry: string;
  screenshotAdd: string;
  screenshotCapturing: string;
  screenshotRemove: string;
  screenshotAlt: string;
  screenshotHint: string;
  screenshotFailed: string;
  copy: string;
  copied: string;
  copyFailed: string;
  close: string;
}>;

/** Пункт user-menu живёт в другом компоненте — открывает диалог этим событием. */
export const REPORT_PROBLEM_EVENT = "realgo:report-problem";

export function openReportProblemDialog() {
  window.dispatchEvent(new Event(REPORT_PROBLEM_EVENT));
}

export function ReportProblemLauncher({
  copy,
  showTrigger = true,
}: Readonly<{ copy: ReportCopy; showTrigger?: boolean }>) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"edit" | "success">("edit");
  const [sendState, setSendState] = useState<"idle" | "sending" | "failed">("idle");
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const [result, setResult] = useState<ProblemReportResult | null>(null);
  const [lastReport, setLastReport] = useState<DiagnosticReport | null>(null);
  const [screenshot, setScreenshot] = useState<ReportScreenshot | null>(null);
  const [screenshotState, setScreenshotState] = useState<"idle" | "capturing" | "failed">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener(REPORT_PROBLEM_EVENT, onOpenEvent);
    return () => window.removeEventListener(REPORT_PROBLEM_EVENT, onOpenEvent);
  }, []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    // Текст намеренно сохраняем при закрытии в фазе edit: случайный Escape
    // не должен стирать описание в процессе написания. После подтверждённой
    // сервером отправки черновик и снимок уже отслужили.
    if (phase === "success") {
      setText("");
      setScreenshot(null);
    }
    setOpen(false);
    setPhase("edit");
    setSendState("idle");
    setCopyState("idle");
    setResult(null);
    setLastReport(null);
    setScreenshotState("idle");
  }

  function currentReport(): DiagnosticReport {
    return createDiagnosticReport(text, screenshot);
  }

  async function send() {
    if (sendState === "sending" || text.trim().length < 4) return;
    const report = currentReport();
    setLastReport(report);
    setSendState("sending");
    try {
      const submitted = await submitProblemReport(report);
      setResult(submitted);
      setPhase("success");
      setSendState("idle");
    } catch (error) {
      setSendState("failed");
      if (error instanceof ApiError && error.status === 401) return;
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastReport ?? currentReport(), null, 2));
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }

  async function addScreenshot() {
    setScreenshotState("capturing");
    try {
      setScreenshot(await captureScreenshot());
      setScreenshotState("idle");
    } catch {
      setScreenshotState("failed");
    }
  }

  const copyLabel =
    copyState === "done" ? copy.copied : copyState === "failed" ? copy.copyFailed : copy.copy;

  return (
    <>
      {showTrigger ? (
        <button
          className="cabinet-topbar__iconbtn"
          type="button"
          aria-label={copy.triggerAria}
          title={copy.triggerAria}
          onClick={() => setOpen(true)}
        >
          <CabinetIcon name="megaphone" width="16" height="16" />
        </button>
      ) : null}

      {open ? (
        <div className="shell-overlay" data-shell-overlay role="presentation" onClick={close}>
          <div
            className="shell-dialog shell-dialog--report"
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            ref={dialogRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="shell-dialog__head">
              <strong>{phase === "success" ? copy.sentTitle : copy.title}</strong>
              <button
                className="shell-dialog__close"
                type="button"
                aria-label={copy.close}
                onClick={close}
              >
                ×
              </button>
            </header>

            {phase === "edit" ? (
              <>
                <p className="shell-dialog__note">{copy.description}</p>
                <label className="report-field">
                  <span>{copy.fieldLabel}</span>
                  <textarea
                    className="report-textarea"
                    value={text}
                    placeholder={copy.placeholder}
                    rows={5}
                    maxLength={2_000}
                    aria-describedby="report-privacy-note"
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <p className="report-privacy" id="report-privacy-note">
                  <span aria-hidden="true">✓</span>
                  {copy.privacyNote}
                </p>
                {screenshot ? (
                  <div className="report-screenshot">
                    <img src={screenshot.dataUrl} alt={copy.screenshotAlt} />
                    <button type="button" onClick={() => setScreenshot(null)}>
                      {copy.screenshotRemove}
                    </button>
                  </div>
                ) : supportsScreenshotCapture() ? (
                  <div className="report-screenshot-add">
                    <button
                      className="shell-btn shell-btn--ghost"
                      type="button"
                      disabled={screenshotState === "capturing"}
                      onClick={addScreenshot}
                    >
                      {screenshotState === "capturing" ? copy.screenshotCapturing : copy.screenshotAdd}
                    </button>
                    <small>{copy.screenshotHint}</small>
                  </div>
                ) : null}
                {screenshotState === "failed" ? (
                  <p className="report-error" role="alert">{copy.screenshotFailed}</p>
                ) : null}
                {sendState === "failed" ? (
                  <p className="report-error" role="alert">{copy.sendFailed}</p>
                ) : null}
                <div className="shell-dialog__actions">
                  <button
                    className="shell-btn shell-btn--primary"
                    type="button"
                    disabled={text.trim().length < 4 || sendState === "sending"}
                    onClick={send}
                  >
                    {sendState === "sending" ? copy.sending : sendState === "failed" ? copy.retry : copy.send}
                  </button>
                  <button className="shell-btn shell-btn--ghost" type="button" onClick={copyReport}>
                    {copyLabel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="shell-dialog__note">{copy.sentNote}</p>
                <div className="report-ticket" aria-label={copy.reportIdLabel}>
                  <span>{copy.reportIdLabel}</span>
                  <code>{result?.reportId}</code>
                </div>
                <div className="shell-dialog__actions">
                  <button className="shell-btn shell-btn--primary" type="button" onClick={copyReport}>
                    {copyLabel}
                  </button>
                  <button className="shell-btn shell-btn--ghost" type="button" onClick={close}>
                    {copy.close}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

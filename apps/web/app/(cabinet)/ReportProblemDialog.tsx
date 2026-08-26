"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";

import { CabinetIcon } from "./_icons";
import { ApiError } from "../_api/types";
import { submitProblemReport, type ProblemReportResult } from "../_api/reports";
import { createDiagnosticReport, type DiagnosticReport } from "../_diagnostics/reportDiagnostics";

const PHOTO_OR_TEXT_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_ACCEPT = [
  "image/*",
  "text/*",
  "video/*",
  ".csv",
  ".heic",
  ".heif",
  ".json",
  ".log",
  ".md",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".txt",
  ".webm",
  ".xml",
].join(",");

const PHOTO_EXTENSIONS = new Set([".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".webp"]);
const TEXT_EXTENSIONS = new Set([".csv", ".json", ".log", ".md", ".txt", ".xml"]);
const VIDEO_EXTENSIONS = new Set([".m4v", ".mkv", ".mov", ".mp4", ".mpeg", ".mpg", ".webm"]);

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
  attachmentAdd: string;
  attachmentRemove: string;
  attachmentHint: string;
  attachmentFailed: string;
  attachmentSelected: string;
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

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function attachmentLimit(file: File): number | null {
  const type = file.type.toLowerCase();
  const extension = extensionOf(file.name);
  if (type.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return VIDEO_MAX_BYTES;
  if (type.startsWith("image/") || PHOTO_EXTENSIONS.has(extension)) return PHOTO_OR_TEXT_MAX_BYTES;
  if (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/xml" ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    return PHOTO_OR_TEXT_MAX_BYTES;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ["КБ", "МБ"];
  let value = bytes / 1024;
  let unit = units[0];
  if (value >= 1024) {
    value /= 1024;
    unit = units[1];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function attachmentMeta(file: File, fallbackType: string): string {
  return `${formatBytes(file.size)} · ${file.type || fallbackType}`;
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentState, setAttachmentState] = useState<"idle" | "failed">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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
    // сервером отправки черновик и вложение уже отслужили.
    if (phase === "success") {
      setText("");
      removeAttachment();
    }
    setOpen(false);
    setPhase("edit");
    setSendState("idle");
    setCopyState("idle");
    setResult(null);
    setLastReport(null);
    setAttachmentState("idle");
  }

  function currentReport(): DiagnosticReport {
    return createDiagnosticReport(text);
  }

  async function send() {
    if (sendState === "sending" || text.trim().length < 4) return;
    const report = currentReport();
    setLastReport(report);
    setSendState("sending");
    try {
      const submitted = await submitProblemReport(report, attachment);
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

  function chooseAttachment() {
    attachmentInputRef.current?.click();
  }

  function removeAttachment() {
    setAttachment(null);
    setAttachmentState("idle");
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  }

  function onAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const limit = attachmentLimit(file);
    if (limit === null || file.size > limit) {
      setAttachment(null);
      setAttachmentState("failed");
      event.target.value = "";
      return;
    }
    setAttachment(file);
    setAttachmentState("idle");
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
                <input
                  ref={attachmentInputRef}
                  className="report-attachment-input"
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  onChange={onAttachmentChange}
                />
                {attachment ? (
                  <div className="report-attachment">
                    <CabinetIcon name="attachment" width="17" height="17" />
                    <span>
                      <strong title={attachment.name}>{attachment.name}</strong>
                      <small>{attachmentMeta(attachment, copy.attachmentSelected)}</small>
                    </span>
                    <button type="button" onClick={removeAttachment}>
                      {copy.attachmentRemove}
                    </button>
                  </div>
                ) : (
                  <div className="report-attachment-add">
                    <button
                      className="shell-btn shell-btn--ghost"
                      type="button"
                      onClick={chooseAttachment}
                    >
                      <CabinetIcon name="attachment" width="15" height="15" />
                      <span>{copy.attachmentAdd}</span>
                    </button>
                    <small>{copy.attachmentHint}</small>
                  </div>
                )}
                {attachmentState === "failed" ? (
                  <p className="report-error" role="alert">{copy.attachmentFailed}</p>
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

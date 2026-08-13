"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { captureError, recordClick, recordNavigation } from "./reportDiagnostics";

export function DiagnosticsCollector() {
  const pathname = usePathname();

  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => recordClick(event.target);
    const onError = (event: ErrorEvent) => {
      captureError("error", event.message || "Unknown JavaScript error", {
        stack: event.error instanceof Error ? event.error.stack : undefined,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      captureError(
        "unhandledrejection",
        reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"),
        { stack: reason instanceof Error ? reason.stack : undefined },
      );
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

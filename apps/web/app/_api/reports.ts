import { apiFetch } from "./client";
import type { DiagnosticReport } from "../_diagnostics/reportDiagnostics";

export type ProblemReportResult = {
  reportId: string;
  fingerprint: string;
  receivedAt: string;
};

export function submitProblemReport(
  report: DiagnosticReport,
  attachment?: File | null,
): Promise<ProblemReportResult> {
  if (attachment) {
    const body = new FormData();
    body.append("report", JSON.stringify(report));
    body.append("attachment", attachment, attachment.name);
    return apiFetch<ProblemReportResult>("/me/problem-reports", {
      method: "POST",
      body,
    });
  }

  return apiFetch<ProblemReportResult>("/me/problem-reports", {
    method: "POST",
    body: report,
  });
}

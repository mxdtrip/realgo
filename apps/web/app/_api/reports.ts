import { apiFetch } from "./client";
import type { DiagnosticReport } from "../_diagnostics/reportDiagnostics";

export type ProblemReportResult = {
  reportId: string;
  fingerprint: string;
  receivedAt: string;
};

export function submitProblemReport(report: DiagnosticReport): Promise<ProblemReportResult> {
  return apiFetch<ProblemReportResult>("/me/problem-reports", {
    method: "POST",
    body: report,
  });
}

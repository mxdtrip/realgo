import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { DashboardClient } from "./_components/DashboardClient";

export const metadata: Metadata = { title: "Сегодня" };

export default function DashboardPage() {
  const copy = getDictionary().cabinet;
  const page = copy.pages.dashboard;

  return (
    <DashboardClient
      copy={{
        eyebrow: page.eyebrow,
        title: page.title,
        description: page.description,
        queueTitle: page.queueTitle,
        queueEmpty: page.queueEmpty,
        patternsTitle: page.patternsTitle,
        patternsEmpty: page.patternsEmpty,
        loading: page.loading,
        errorTitle: page.errorTitle,
        retry: page.retry,
        nextActionEyebrow: page.nextActionEyebrow,
        nextActionOpen: page.nextActionOpen,
        nextActionPlan: page.nextActionPlan,
        nextActionQueue: page.nextActionQueue,
        nextReviewScheduled: page.nextReviewScheduled,
        viewAll: copy.common.viewAll,
        dayToday: page.dayToday,
        dayTomorrow: page.dayTomorrow,
        dayOverdue: page.dayOverdue,
        dayUnits: page.dayUnits,
        difficultyLabels: page.difficultyLabels,
        statLabels: page.statLabels,
        statTooltips: page.statTooltips,
        statActions: page.statActions,
        launcher: page.launcher,
        heatmap: page.heatmap,
        reviewTypes: copy.pages.reviews.types,
      }}
    />
  );
}

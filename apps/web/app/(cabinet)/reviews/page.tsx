import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { ReviewsJournalClient } from "./_components/ReviewsJournalClient";

export const metadata: Metadata = { title: "Решённые задачи" };

export default function ReviewsPage() {
  const page = getDictionary().cabinet.pages.reviews;

  return <ReviewsJournalClient copy={page.journal} />;
}

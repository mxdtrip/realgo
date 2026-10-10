import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { ReviewQueueClient } from "./_components/ReviewQueueClient";

export const metadata: Metadata = { title: "Повторения на сегодня" };

export default function ReviewQueuePage() {
  return <ReviewQueueClient copy={getDictionary().cabinet.pages.reviews.queue} />;
}

import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { RoadmapClient } from "./_components/RoadmapClient";

export const metadata: Metadata = { title: "План подготовки" };

export default function RoadmapPage() {
  const page = getDictionary().cabinet.pages.roadmap;

  return <RoadmapClient copy={page} />;
}

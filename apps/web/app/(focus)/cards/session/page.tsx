import type { Metadata } from "next";

import { getDictionary } from "../../../_content/i18n";
import { CardSessionClient } from "./_components/CardSessionClient";

export const metadata: Metadata = { title: "Сессия повторения" };

export default async function CardSessionPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ scope?: string; restart?: string }> }>) {
  const dictionary = getDictionary();
  const session = dictionary.cabinet.pages.cards.session;
  const { scope, restart } = await searchParams;

  return (
    <CardSessionClient
      brand={dictionary.cabinet.layout.brand}
      copy={session}
      errorFallback={session.sessionError}
      retryLabel={session.retry}
      scope={scope === "practice" ? "practice" : "due"}
      startFresh={restart === "1"}
    />
  );
}

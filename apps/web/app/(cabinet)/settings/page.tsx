import type { Metadata } from "next";

import { getDictionary } from "../../_content/i18n";
import { SettingsContent } from "./_components/SettingsContent";

export const metadata: Metadata = { title: "Настройки" };

export default function SettingsPage() {
  const page = getDictionary().cabinet.pages.settings;

  return (
    <main className="cabinet-page">
      <section className="cabinet-page-head">
        <div>
          <span className="cabinet-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </div>
      </section>

      <SettingsContent />
    </main>
  );
}

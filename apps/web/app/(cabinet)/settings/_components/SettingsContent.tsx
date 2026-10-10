"use client";

import { useState } from "react";

import { accountSecurityCopy, getDictionary } from "../../../_content/i18n";
import { CabinetPanel } from "../../_components";
import { InstallAppPanel } from "./InstallAppPanel";
import { NotificationSettingsPanel } from "./NotificationSettingsPanel";
import { PrivacyActions } from "./PrivacyActions";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";
import { SecurityPanel } from "./SecurityPanel";

type SectionId = "profile" | "security" | "notifications" | "application";

export function SettingsContent() {
  const page = getDictionary().cabinet.pages.settings;
  const [active, setActive] = useState<SectionId>("profile");
  const tabs = (Object.keys(page.tabs) as SectionId[]).map((id) => ({ id, label: page.tabs[id] }));

  return (
    <>
      <div className="settings-tabs" role="tablist" aria-label="Разделы настроек">
        {tabs.map((tab) => (
          <button
            aria-controls={`settings-panel-${tab.id}`}
            aria-selected={active === tab.id}
            className={active === tab.id ? "is-active" : undefined}
            id={`settings-tab-${tab.id}`}
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby="settings-tab-profile"
        hidden={active !== "profile"}
        id="settings-panel-profile"
        role="tabpanel"
      >
        <CabinetPanel eyebrow={page.profileEyebrow} title={page.profileTitle}>
          <ProfileSettingsPanel copy={page.profile} />
        </CabinetPanel>
      </section>

      <section
        aria-labelledby="settings-tab-security"
        hidden={active !== "security"}
        id="settings-panel-security"
        role="tabpanel"
      >
        <CabinetPanel eyebrow={accountSecurityCopy.panelEyebrow} title={accountSecurityCopy.panelTitle}>
          <SecurityPanel />
        </CabinetPanel>
      </section>

      <section
        aria-labelledby="settings-tab-notifications"
        hidden={active !== "notifications"}
        id="settings-panel-notifications"
        role="tabpanel"
      >
        <CabinetPanel eyebrow={page.notificationsEyebrow} title={page.notificationsTitle}>
          <NotificationSettingsPanel copy={page.notifications} />
        </CabinetPanel>
      </section>

      <section
        aria-labelledby="settings-tab-application"
        className="settings-application-grid"
        hidden={active !== "application"}
        id="settings-panel-application"
        role="tabpanel"
      >
        <CabinetPanel eyebrow={page.installEyebrow} title={page.installTitle}>
          <InstallAppPanel copy={page.install} />
        </CabinetPanel>
        <CabinetPanel eyebrow={page.privacyEyebrow} title={page.privacyTitle} padded>
          <PrivacyActions copy={page} />
        </CabinetPanel>
      </section>
    </>
  );
}

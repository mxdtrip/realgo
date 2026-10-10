import type { PlasmoCSConfig } from "plasmo";

// Web refresh credentials are now HttpOnly and cannot be imported by a content
// script. The extension uses its own login and its own rotating device session.
// Visiting the website must never clear an independently authenticated extension.
export const config: PlasmoCSConfig = {
  matches: ["https://realgo.dev/*"],
  run_at: "document_idle",
};

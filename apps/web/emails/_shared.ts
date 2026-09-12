// Shared skeleton for transactional HTML emails: the same dark-panel shell as
// .auth-panel across all magic-link messages (inline styles only — email
// clients don't load app/globals.css).

export const COLORS = {
  bg: "#0d1117",
  panel: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  textDim: "#7d8590",
  button: "#238636",
  buttonText: "#ffffff",
} as const;

export function formatValidity(expiresInMinutes: number): string {
  const hours = Math.round(expiresInMinutes / 60);
  return hours >= 1 && expiresInMinutes % 60 === 0 ? `${hours} ч` : `${expiresInMinutes} мин`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps pre-built inner HTML (paragraphs + button table) in the shared shell. */
export function renderEmailShell(title: string, innerHtml: string): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0; padding:24px 12px; background:${COLORS.bg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;">
            <tr>
              <td style="padding-bottom:20px; text-align:center; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; font-weight:700; letter-spacing:0.02em; color:${COLORS.text};">
                ReAlgo
              </td>
            </tr>
            <tr>
              <td style="background:${COLORS.panel}; border:1px solid ${COLORS.border}; border-radius:16px; padding:28px 26px;">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px; text-align:center; font-size:12px; color:${COLORS.textDim};">
                ReAlgo · realgo.dev
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** A button + "copy this link" fallback, styled like .auth-form button[type="submit"]. */
export function renderLinkButton(url: string, label: string): string {
  const escapedURL = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
                  <tr>
                    <td style="border-radius:10px; background:${COLORS.button};">
                      <a href="${escapedURL}"
                         style="display:inline-block; padding:12px 22px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-weight:600; font-size:13.5px; color:${COLORS.buttonText}; text-decoration:none; border-radius:10px;">
                        ${escapeHtml(label)}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${COLORS.textDim};">
                  Если кнопка не открывается, скопируйте ссылку в браузер:
                </p>
                <p style="margin:0 0 20px; font-size:12.5px; line-height:1.5; word-break:break-all; color:${COLORS.textDim};">
                  <a href="${escapedURL}" style="color:${COLORS.textDim};">${escapedURL}</a>
                </p>`;
}

export function paragraph(text: string, dim = false): string {
  return `<p style="margin:0 0 16px; font-size:15px; line-height:1.55; color:${dim ? COLORS.textDim : COLORS.text};">
                  ${text}
                </p>`;
}

export function footNote(text: string): string {
  return `<p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${COLORS.textDim};">
                  ${text}
                </p>`;
}

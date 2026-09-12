// HTML + plain-text templates for the "reset your password" message.

import { footNote, formatValidity, paragraph, renderEmailShell, renderLinkButton } from "./_shared";

export type ResetPasswordEmailInput = {
  resetURL: string;
  expiresInMinutes: number;
};

export type ResetPasswordEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildResetPasswordEmail({
  resetURL,
  expiresInMinutes,
}: ResetPasswordEmailInput): ResetPasswordEmailContent {
  const validity = formatValidity(expiresInMinutes);
  const subject = "Восстановление пароля ReAlgo";

  const inner = [
    paragraph("Здравствуйте!"),
    paragraph(
      `Мы получили запрос на смену пароля для вашего аккаунта на realgo.dev.
                  Чтобы установить новый пароль, перейдите по ссылке — она действует ${validity}.`,
    ),
    renderLinkButton(resetURL, "Восстановить пароль"),
    footNote(
      "Не запрашивали смену пароля? Просто игнорируйте это письмо — пароль останется прежним, ничего менять не нужно.",
    ),
    `<p style="margin:0; font-size:13px; line-height:1.5; color:#7d8590;">
                  Пожалуйста, не пересылайте это письмо: ссылка внутри даёт доступ к вашему аккаунту.
                </p>`,
  ].join("\n");

  return {
    subject,
    html: renderEmailShell(subject, inner),
    text: buildText(resetURL, validity),
  };
}

function buildText(resetURL: string, validity: string): string {
  return `Здравствуйте!

Мы получили запрос на смену пароля для вашего аккаунта на realgo.dev. Чтобы установить новый пароль, перейдите по ссылке — она действует ${validity}:

${resetURL}

Не запрашивали смену пароля? Просто игнорируйте это письмо — пароль останется прежним, ничего менять не нужно.

Пожалуйста, не пересылайте это письмо: ссылка внутри даёт доступ к вашему аккаунту.

— ReAlgo, realgo.dev
`;
}

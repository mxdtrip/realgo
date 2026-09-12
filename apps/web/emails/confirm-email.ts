// HTML + plain-text templates for the "confirm your email" message.

import { footNote, formatValidity, paragraph, renderEmailShell, renderLinkButton } from "./_shared";

export type ConfirmEmailInput = {
  confirmURL: string;
  expiresInMinutes: number;
};

export type ConfirmEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export function buildConfirmEmail({ confirmURL, expiresInMinutes }: ConfirmEmailInput): ConfirmEmailContent {
  const validity = formatValidity(expiresInMinutes);
  const subject = "Подтвердите почту для ReAlgo";

  const inner = [
    paragraph("Здравствуйте!"),
    paragraph(
      `Вы указали этот адрес при регистрации на realgo.dev. Чтобы завершить
                  создание аккаунта, подтвердите почту — ссылка действует ${validity}.`,
    ),
    renderLinkButton(confirmURL, "Подтвердить почту"),
    footNote("Не создавали аккаунт на ReAlgo? Просто игнорируйте это письмо — без перехода по ссылке ничего не произойдёт."),
    `<p style="margin:0; font-size:13px; line-height:1.5; color:#7d8590;">
                  Пожалуйста, не пересылайте это письмо: ссылка внутри привязана к вашему аккаунту.
                </p>`,
  ].join("\n");

  return {
    subject,
    html: renderEmailShell(subject, inner),
    text: buildText(confirmURL, validity),
  };
}

function buildText(confirmURL: string, validity: string): string {
  return `Здравствуйте!

Вы указали этот адрес при регистрации на realgo.dev. Чтобы завершить создание аккаунта, подтвердите почту — ссылка действует ${validity}:

${confirmURL}

Не создавали аккаунт на ReAlgo? Просто игнорируйте это письмо — без перехода по ссылке ничего не произойдёт.

Пожалуйста, не пересылайте это письмо: ссылка внутри привязана к вашему аккаунту.

— ReAlgo, realgo.dev
`;
}

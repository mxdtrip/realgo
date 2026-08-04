import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "../_content/i18n";
import { CheckoutAction } from "./CheckoutAction";

export const metadata: Metadata = { title: "Оформление лицензии" };

/**
 * Минимальный платёжный экран. Открывается из карточек тарифов на лендинге
 * (`/checkout?plan=free|pro`). Показывает выбранный план и его состав.
 *
 * Pro — разовая бессрочная лицензия, не подписка: ни периода, ни автопродления
 * здесь быть не должно. Раньше на этом экране был захардкожен суффикс «/ мес»;
 * теперь характер платежа приходит из словаря вместе с ценой, чтобы карточка
 * на лендинге и этот экран не могли разъехаться.
 *
 * TODO: подключить реального платёжного провайдера (ЮKassa/CloudPayments).
 * Сейчас это заглушка экрана оплаты — реальное списание не выполняется.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planParam } = await searchParams;
  const copy = getDictionary().marketing;

  const requested = (planParam ?? "pro").toLowerCase();
  // notFound() из main вместо прежнего «неизвестный план -> молча показать
  // последний»: подставлять Pro в ответ на опечатку в query — это показывать
  // цену, которую пользователь не выбирал. Пятый элемент кортежа (характер
  // платежа) при этом сохраняется — он и заменил захардкоженное «/ мес».
  const plan = copy.pricing.find(([name]) => name.toLowerCase() === requested);
  if (!plan) notFound();
  const [name, price, features, , period] = plan;
  const isFree = price.replace(/[^0-9]/g, "") === "0";

  return (
    <main className="landing-section checkout-screen">
      <div className="section-kicker">Checkout</div>
      <div className="checkout-grid">
        <div className="section-copy">
          <h2>Оформление лицензии</h2>
          <p>
            {/* Честная формулировка из main (кнопка оплаты отключена, обещать
                «перейдите к оплате» нельзя) плюс факт разовости платежа. */}
            Вы выбрали план <strong>{name}</strong>. {isFree
              ? "Проверьте состав и создайте аккаунт."
              : "Проверьте состав. Это разовый платёж без регулярных списаний; оплата временно недоступна, пока биллинг в разработке."}
          </p>
          <Link className="checkout-back" href="/#pricing">
            ← Назад к тарифам
          </Link>
        </div>

        <article className="price-card checkout-summary">
          <span>{name}</span>
          <strong>
            {price}
            {period ? <span className="checkout-period">{period}</span> : null}
          </strong>
          <ul className="price-features">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>

          <CheckoutAction isFree={isFree} />
        </article>
      </div>
    </main>
  );
}

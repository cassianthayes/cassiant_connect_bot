// All user-facing strings and keyboards. Messages are sent with parse_mode HTML.

export const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt" }[c]};`);

const plural = (n: number, forms: [string, string, string]) => {
  const [d, h] = [n % 10, n % 100];
  return `${n} ${forms[d === 1 && h !== 11 ? 0 : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2]}`;
};

export function period(days: number) {
  const months =
    days % 365 === 0 ? (days / 365) * 12 : days % 30 === 0 ? days / 30 : 0;
  return months
    ? plural(months, ["месяц", "месяца", "месяцев"])
    : plural(days, ["день", "дня", "дней"]);
}

const hours = (h: number) =>
  h % 24 === 0 ? period(h / 24) : plural(h, ["час", "часа", "часов"]);

const date = (d: Date) =>
  d.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " МСК";

export const buttons = {
  pay: "оплатить звёздами",
  promo: "промокод",
  connect: "как подключиться",
  back: "назад",
  easyConnect: "подключиться",
  plan: (days: number, stars: number) =>
    `${period(days)} — ${plural(stars, ["звезда", "звезды", "звёзд"])}`,
};

export const keyboard = (rows: string[][]) => ({
  keyboard: rows.map((row) => row.map((text) => ({ text }))),
  resize_keyboard: true,
  is_persistent: true,
});

export const mainMenu = keyboard([
  [buttons.pay, buttons.promo],
  [buttons.connect],
]);

/** the subscription page has its own per-device setup guide */
export const connectMenu = (url: string) => ({
  inline_keyboard: [[{ text: buttons.easyConnect, url }]],
});

export const texts = {
  welcome: (name: string) =>
    `привет, <b>${esc(name)}</b>. оплати звёздами или введи промокод.\nограничений по количеству устрйоств - нет. страна - германия, потом будет больше.`,
  menu: "меню:",
  unknown: "не понял. используй кнопки.",
  error: "что-то сломалось, попробуй позже.",

  choosePlan: "выбери срок:",
  invoiceTitle: (days: number) => `VPN на ${period(days)}`,
  invoiceDescription: (days: number) => `+${period(days)} к подписке.`,
  planUnavailable: "этого тарифа больше нет, выбери другой.",
  paymentError:
    "оплата прошла, но не применилась. админ уже в курсе, скоро поправит.",

  askPromo: "отправь промокод, например <code>1234-5678</code>.",
  promo: {
    invalid: "такого промокода нет.",
    used: "промокод уже использован.",
    limited: "слишком много попыток, попробуй через час.",
  },

  extended: (days: number, until: Date) =>
    `готово, +${period(days)}. подписка до <b>${date(until)}</b>.\n\nжми «${buttons.connect}».`,

  connect: (activeUntil: Date | null) =>
    activeUntil
      ? `подписка до <b>${date(activeUntil)}</b>.`
      : "подписки нет. оплати звёздами или введи промокод.",

  expiresSoon: (hoursLeft: number, until: Date) =>
    `подписка закончится через <b>${hours(hoursLeft)}</b>, ${date(until)}. продли, чтобы не остаться без vpn.`,
  expired: "подписка закончилась. продли, чтобы снова пользоваться vpn.",

  genUsage:
    "формат: <code>/gen &lt;дни&gt; [кол-во]</code>, например <code>/gen 30 5</code>.",
  genResult: (days: number, codes: string[], bot: string) =>
    `промокоды на ${period(days)}:\n\n` +
    codes
      .map((c) => `<code>${c}</code>\nhttps://t.me/${bot}?start=${c}`)
      .join("\n\n"),
};

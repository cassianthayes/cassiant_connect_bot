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
  routing: "маршрутизация для incy",
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

export const INCY_ROUTING = "incy_routing";

/** roscomvpn whitelist routing profile; too long for a copy_text button and Telegram URL buttons reject incy://, so it's sent as text */
const INCY_ROUTING_LINK =
  "incy://routing/onadd/eyJOYW1lIjoiUm9zY29tVlBOIFdoaXRlbGlzdCIsIkdsb2JhbFByb3h5IjoidHJ1ZSIsIlVzZUNodW5rRmlsZXMiOiJ0cnVlIiwiUmVtb3RlRG5zIjoiOC44LjguOCIsIkRvbWVzdGljRG5zIjoiNzcuODguOC44IiwiUmVtb3RlRE5TVHlwZSI6IkRvSCIsIlJlbW90ZUROU0RvbWFpbiI6Imh0dHBzOi8vOC44LjguOC9kbnMtcXVlcnkiLCJSZW1vdGVETlNJUCI6IjguOC44LjgiLCJEb21lc3RpY0ROU1R5cGUiOiJEb0giLCJEb21lc3RpY0ROU0RvbWFpbiI6Imh0dHBzOi8vNzcuODguOC44L2Rucy1xdWVyeSIsIkRvbWVzdGljRE5TSVAiOiI3Ny44OC44LjgiLCJHZW9pcHVybCI6Imh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9naC9oeWRyYXBvbmlxdWUvcm9zY29tdnBuLWdlb2lwL3JlbGVhc2UvZ2VvaXAuZGF0IiwiR2Vvc2l0ZXVybCI6Imh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9naC9oeWRyYXBvbmlxdWUvcm9zY29tdnBuLWdlb3NpdGUvcmVsZWFzZS9nZW9zaXRlLmRhdCIsIkxhc3RVcGRhdGVkIjoiMTc5MjMxMDM2MiIsIkRuc0hvc3RzIjp7ImxrZmwyLm5hbG9nLnJ1IjoiMjEzLjI0LjY0LjE3NSIsImxrbnBkLm5hbG9nLnJ1IjoiMjEzLjI0LjY0LjE4MSJ9LCJSb3V0ZU9yZGVyIjoiYmxvY2stcHJveHktZGlyZWN0IiwiRGlyZWN0U2l0ZXMiOlsiZ2Vvc2l0ZTpwcml2YXRlIiwiZ2Vvc2l0ZTp3aGl0ZWxpc3QiXSwiRGlyZWN0SXAiOlsiZ2VvaXA6cHJpdmF0ZSIsImdlb2lwOndoaXRlbGlzdCJdLCJQcm94eVNpdGVzIjpbXSwiUHJveHlJcCI6W10sIkJsb2NrU2l0ZXMiOlsiZ2Vvc2l0ZTp3aW4tc3B5IiwiZ2Vvc2l0ZTp0b3JyZW50IiwiZ2Vvc2l0ZTpjYXRlZ29yeS1hZHMiXSwiQmxvY2tJcCI6W10sIkRvbWFpblN0cmF0ZWd5IjoiSVBJZk5vbk1hdGNoIiwiRmFrZUROUyI6ImZhbHNlIn0K";

/** the subscription page has its own per-device setup guide */
export const connectMenu = (url: string) => ({
  inline_keyboard: [
    [{ text: buttons.easyConnect, url }],
    [{ text: buttons.routing, callback_data: INCY_ROUTING }],
  ],
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
    (activeUntil
      ? `подписка до <b>${date(activeUntil)}</b>.`
      : "подписки нет. оплати звёздами или введи промокод.") +
    `\n\nжми «${buttons.easyConnect}», там инструкция.`,
  incyRouting:
    "российские сайты и приложения пойдут напрямую, остальное через vpn.\n\n" +
    "1. нажми на ссылку ниже, она скопируется.\n" +
    "2. открой incy → настройки → маршрутизация.\n" +
    "3. нажми «+» и выбери импорт из буфера обмена.\n" +
    "4. выбери профиль «RoscomVPN Whitelist».\n\n" +
    `<code>${INCY_ROUTING_LINK}</code>`,

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

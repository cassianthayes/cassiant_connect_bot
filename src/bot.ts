import { Bot, type Context, type SendMessageParams } from "node-telegram-bot-api";
import { getDb, payments } from "./db";
import type { Env } from "./env";
import { CODE_RE, createCodes, normalizeCode, redeemCode, releaseCode } from "./promo";
import { isActive, Remnawave, type RemnawaveUser } from "./remnawave";
import { createLogger, describe, telegramOptions, who } from "./telegram";
import { buttons, connectMenu, esc, INCY_ROUTING, keyboard, mainMenu, period, texts } from "./texts";

// D1 allows at most 100 bound parameters per query; each code row binds 2
const MAX_CODES = 30;

export function createBot(env: Env, ctx: ExecutionContext) {
  const bot = new Bot(env.BOT_TOKEN, telegramOptions(env));
  const db = getDb(env.DB);
  const rw = new Remnawave(env);
  const log = createLogger(bot.api, env, ctx);

  // integer-like keys keep ascending order in Object.entries
  const plans = Object.entries(env.PLANS).map(([d, stars]) => ({ days: +d, stars, label: buttons.plan(+d, stars) }));
  const labels = plans.map((p) => p.label);
  const plansMenu = keyboard([
    ...Array.from({ length: Math.ceil(labels.length / 2) }, (_, i) => labels.slice(i * 2, i * 2 + 2)),
    [buttons.back],
  ]);

  const reply = (c: Context, text: string, reply_markup: SendMessageParams["reply_markup"] = mainMenu) =>
    c.reply(text, { parse_mode: "HTML", reply_markup });
  const event = (c: Context, text: string) => log(`${text}\n${who(c.from!.id, c.from!.first_name, c.from!.username)}`);
  const user = async (c: Context) => (await rw.ensureUser(c.from!.id)).user;

  async function applyPromo(c: Context, u: RemnawaveUser, code: string) {
    const result = await redeemCode(db, code, c.from!.id);
    if (!result.ok) {
      event(c, `🎟 <code>${code}</code>: ${texts.promo[result.reason]}`);
      return reply(c, texts.promo[result.reason]);
    }
    try {
      const expiresAt = await rw.addDays(u, result.days);
      event(c, `🎟 Активирован промокод <code>${code}</code>: +${period(result.days)}`);
      return reply(c, texts.extended(result.days, expiresAt));
    } catch (err) {
      await releaseCode(db, code);
      throw err;
    }
  }

  bot.catch(async (err, c) => {
    console.error(err);
    log(`❗️ Ошибка: <code>${esc(describe(err))}</code>` + (c.from ? `\n${who(c.from.id, c.from.first_name, c.from.username)}` : ""));
    if (c.chatId) await reply(c, texts.error).catch(() => {});
  });

  // private chats only (the bot also sits in the log group)
  bot.use((c, next) => (c.chat && c.chat.type !== "private" ? undefined : next()));

  bot.on("pre_checkout_query", async (c) => {
    if (!("pre_checkout_query" in c.update)) return;
    const q = c.update.pre_checkout_query;
    const plan = plans.find((p) => `plan:${p.days}` === q.invoice_payload);
    const ok = q.currency === "XTR" && plan?.stars === q.total_amount;
    if (!ok) event(c, `⚠️ Отклонён платёж: ${esc(q.invoice_payload)}, ${q.total_amount} ⭐`);
    await c.api.answerPreCheckoutQuery({ pre_checkout_query_id: q.id, ok, error_message: ok ? undefined : texts.planUnavailable });
  });

  bot.use(async (c, next) => {
    const p = c.message?.successful_payment;
    if (!p) return next();
    const days = Number(p.invoice_payload.replace("plan:", ""));
    const [fresh] = await db
      .insert(payments)
      .values({ chargeId: p.telegram_payment_charge_id, telegramId: c.from!.id, days, stars: p.total_amount })
      .onConflictDoNothing()
      .returning();
    if (!fresh) return; // redelivered update
    const paid = `${period(days)} за ${p.total_amount} ⭐\n<code>${esc(p.telegram_payment_charge_id)}</code>`;
    try {
      const expiresAt = await rw.addDays(await user(c), days);
      event(c, `💰 Оплата: ${paid}`);
      await reply(c, texts.extended(days, expiresAt));
    } catch (err) {
      event(c, `❗️ Оплата не применена: ${paid}\n<code>${esc(describe(err))}</code>`);
      await reply(c, texts.paymentError);
    }
  });

  bot.command("start", async (c) => {
    const { user: u, created } = await rw.ensureUser(c.from!.id);
    const payload = String(c.match ?? "");
    event(c, (created ? "🆕 Новый пользователь" : "▶️ /start") + (payload ? ` <code>${esc(payload)}</code>` : ""));
    await reply(c, texts.welcome(c.from!.first_name));
    const code = normalizeCode(payload);
    if (code) await applyPromo(c, u, code);
  });

  bot.command("gen", async (c) => {
    if (c.from!.id !== Number(env.ADMIN_ID)) return reply(c, texts.unknown);
    const [days = 0, count = 1] = String(c.match ?? "").split(/\s+/).filter(Boolean).map(Number);
    const valid = (n: number, max = Infinity) => Number.isInteger(n) && n > 0 && n <= max;
    if (!valid(days) || !valid(count, MAX_CODES)) return reply(c, texts.genUsage);
    const codes = await createCodes(db, days, count);
    const { username } = await c.api.getMe();
    event(c, `🎟 Создано промокодов: ${count} × ${period(days)}`);
    await c.reply(texts.genResult(days, codes, username!), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  });

  bot.hears(buttons.pay, (c) => {
    event(c, "⭐ Открыл тарифы");
    return reply(c, texts.choosePlan, plansMenu);
  });

  bot.hears(labels, async (c) => {
    const plan = plans.find((p) => p.label === c.match)!;
    event(c, `🧾 Счёт: ${plan.label}`);
    await c.api.sendInvoice({
      chat_id: c.chatId!,
      title: texts.invoiceTitle(plan.days),
      description: texts.invoiceDescription(plan.days),
      payload: `plan:${plan.days}`,
      currency: "XTR",
      prices: [{ label: texts.invoiceTitle(plan.days), amount: plan.stars }],
    });
  });

  bot.hears(buttons.promo, (c) => {
    event(c, "🎟 Открыл ввод промокода");
    return reply(c, texts.askPromo, keyboard([[buttons.back]]));
  });

  bot.hears(buttons.connect, async (c) => {
    const u = await user(c);
    event(c, "📲 Как подключиться");
    await reply(c, texts.connect(isActive(u) ? new Date(u.expireAt) : null), connectMenu(u.subscriptionUrl));
  });

  bot.on("callback_query", async (c) => {
    await c.answerCallbackQuery();
    if (c.callbackQuery?.data !== INCY_ROUTING) return;
    event(c, "🧭 Маршрутизация для Incy");
    await c.reply(texts.incyRouting, { parse_mode: "HTML" });
  });

  bot.hears(buttons.back, (c) => reply(c, texts.menu));

  bot.hears(CODE_RE, async (c) => applyPromo(c, await user(c), normalizeCode(c.message!.text!)!));

  bot.on("message", (c) => {
    event(c, `💬 ${esc(c.message?.text ?? "[не текст]")}`);
    return reply(c, texts.unknown);
  });

  return bot;
}

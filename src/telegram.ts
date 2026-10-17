import type { Api, BotOptions } from "node-telegram-bot-api";
import type { Env } from "./env";
import { esc } from "./texts";

export const telegramOptions = (env: Env): BotOptions => ({
  apiRoot: env.TELEGRAM_API_ROOT,
  // the library calls a stored fetch reference, which throws "Illegal invocation" on Workers
  fetch: ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)) as typeof fetch,
});

/** Error text including its cause (drizzle hides the D1 message there). */
export const describe = (err: unknown): string =>
  err instanceof Error && err.cause ? `${err}\n↳ ${describe(err.cause)}` : String(err);

export const who = (id: number, name: string, username?: string | null) =>
  `<a href="tg://user?id=${id}">${esc(name)}</a>${username ? ` @${username}` : ""} <code>${id}</code>`;

/** Posts an event to the log group without delaying the response. */
export const createLogger = (api: Api, env: Env, ctx: ExecutionContext) => (text: string) => {
  console.log(text);
  ctx.waitUntil(
    api
      .sendMessage({
        chat_id: env.LOG_CHAT_ID,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        disable_notification: true,
      })
      .catch((err) => console.error(`log to ${env.LOG_CHAT_ID} failed: ${err}`)),
  );
};

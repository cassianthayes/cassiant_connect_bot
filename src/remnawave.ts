import { Api } from "node-telegram-bot-api";
import type { Env } from "./env";
import { createLogger, telegramOptions, who } from "./telegram";
import { esc, mainMenu, texts } from "./texts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RemnawaveUser {
  username: string;
  status: string;
  expireAt: string;
  subscriptionUrl: string;
  telegramId: number | null;
}

export const isActive = (u: RemnawaveUser) => u.status === "ACTIVE" && Date.parse(u.expireAt) > Date.now();

export class Remnawave {
  constructor(private readonly env: Env) {}

  /** Returns null on 404. */
  private async call<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    const res = await fetch(`${this.env.REMNAWAVE_URL.replace(/\/+$/, "")}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.env.REMNAWAVE_TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Remnawave ${method} ${path}: ${res.status} ${await res.text()}`);
    return ((await res.json()) as { response: T }).response;
  }

  /** Each Telegram account maps to the Remnawave user `tg_<id>`, created on first contact. */
  async ensureUser(telegramId: number): Promise<{ user: RemnawaveUser; created: boolean }> {
    const username = `tg_${telegramId}`;
    const user = await this.call<RemnawaveUser>("GET", `/users/by-username/${username}`);
    if (user) return { user, created: false };
    const created = await this.call<RemnawaveUser>("POST", "/users", {
      username,
      telegramId,
      // DISABLED, not ACTIVE with a past expiry: otherwise Remnawave immediately fires user.expired.
      // addDays() activates the user on the first payment or promocode.
      status: "DISABLED",
      expireAt: new Date().toISOString(),
      trafficLimitStrategy: "NO_RESET",
      activeInternalSquads: this.env.REMNAWAVE_SQUADS,
    });
    return { user: created!, created: true };
  }

  /** Adds days to max(now, current expiry). */
  async addDays(user: RemnawaveUser, days: number): Promise<Date> {
    const expireAt = new Date(Math.max(Date.now(), Date.parse(user.expireAt)) + days * DAY_MS);
    await this.call("PATCH", "/users", { username: user.username, expireAt: expireAt.toISOString(), status: "ACTIVE" });
    return expireAt;
  }
}

interface WebhookPayload {
  scope: string;
  event: string;
  data: Partial<RemnawaveUser>;
  meta?: { expiration?: number } | null;
}

async function verifySignature(body: string, signature: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "verify",
  ]);
  const sig = Uint8Array.from(signature.match(/[0-9a-f]{2}/gi) ?? [], (h) => parseInt(h, 16));
  return crypto.subtle.verify("HMAC", key, sig, enc.encode(body));
}

/** Remnawave panel webhooks: logs every event, notifies users about expiration. */
export async function handleRemnawaveWebhook(req: Request, env: Env, ctx: ExecutionContext) {
  const body = await req.text();
  const signature = req.headers.get("x-remnawave-signature") ?? "";
  if (!(await verifySignature(body, signature, env.REMNAWAVE_WEBHOOK_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { event, data, meta } = JSON.parse(body) as WebhookPayload;
  const api = new Api(env.BOT_TOKEN, telegramOptions(env));
  const user = data.telegramId ? `\n${who(data.telegramId, data.username ?? "", null)}` : "";
  const offset = meta?.expiration ? ` (${meta.expiration > 0 ? "+" : ""}${meta.expiration} ч)` : "";
  createLogger(api, env, ctx)(`🛰 <code>${esc(event)}</code>${offset}${user}`);

  // EXPIRATION_NOTIFICATIONS in Remnawave decides when these fire; negative = hours before expiry
  const text =
    event === "user.expired"
      ? texts.expired
      : event === "user.expiration" && meta?.expiration && meta.expiration < 0 && data.expireAt
        ? texts.expiresSoon(-meta.expiration, new Date(data.expireAt))
        : null;
  if (text && data.telegramId) {
    ctx.waitUntil(
      api
        .sendMessage({ chat_id: data.telegramId, text, parse_mode: "HTML", reply_markup: mainMenu })
        .catch((err) => console.error(`notify ${data.telegramId} failed: ${err}`)),
    );
  }
  return new Response("ok");
}

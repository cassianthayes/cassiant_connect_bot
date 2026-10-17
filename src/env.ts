export interface Env {
  DB: D1Database;

  // secrets (wrangler secret put / .dev.vars)
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  REMNAWAVE_TOKEN: string;
  /** same value as WEBHOOK_SECRET_HEADER in the Remnawave .env */
  REMNAWAVE_WEBHOOK_SECRET: string;

  // vars (wrangler.jsonc); overrides from .dev.vars arrive as strings
  ADMIN_ID: number | string;
  /** group where every event is logged; the bot must be a member */
  LOG_CHAT_ID: number | string;
  /** days -> price in Telegram Stars */
  PLANS: Record<string, number>;
  REMNAWAVE_URL: string;
  /** internal squad UUIDs assigned to every new user */
  REMNAWAVE_SQUADS: string[];
  /** optional, e.g. a self-hosted Bot API server */
  TELEGRAM_API_ROOT?: string;
}

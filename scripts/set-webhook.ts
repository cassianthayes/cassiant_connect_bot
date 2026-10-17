// Usage: bun run webhook https://cassiant-connect-bot.<account>.workers.dev
import { Api } from "node-telegram-bot-api";

const [baseUrl] = process.argv.slice(2);
const { BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET } = process.env;
if (!baseUrl || !BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
  console.error("Usage: bun run webhook <worker-url>  (BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are read from .dev.vars)");
  process.exit(1);
}

const api = new Api(BOT_TOKEN);
await api.setWebhook({
  url: `${baseUrl.replace(/\/+$/, "")}/telegram`,
  secret_token: TELEGRAM_WEBHOOK_SECRET,
  allowed_updates: ["message", "callback_query", "pre_checkout_query"],
});
await api.setMyCommands({ commands: [{ command: "start", description: "Меню" }] });

console.log(await api.getWebhookInfo());

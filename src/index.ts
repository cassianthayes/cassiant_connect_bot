import { webhookCallback } from "node-telegram-bot-api";
import { createBot } from "./bot";
import type { Env } from "./env";
import { handleRemnawaveWebhook } from "./remnawave";

export default {
  async fetch(req, env, ctx) {
    const { pathname } = new URL(req.url);
    if (req.method === "POST" && pathname === "/telegram") {
      return webhookCallback(createBot(env, ctx), { secretToken: env.TELEGRAM_WEBHOOK_SECRET })(req);
    }
    if (req.method === "POST" && pathname === "/remnawave") return handleRemnawaveWebhook(req, env, ctx);
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

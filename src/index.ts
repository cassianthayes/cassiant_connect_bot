import { webhookCallback } from "node-telegram-bot-api";
import { createBot } from "./bot";
import type { Env } from "./env";
import { handleRemnawaveWebhook } from "./remnawave";
import { HAPP_ROUTING_URL, routingPage } from "./texts";

export default {
  async fetch(req, env, ctx) {
    const { origin, pathname } = new URL(req.url);
    if (req.method === "POST" && pathname === "/telegram") {
      return webhookCallback(createBot(env, ctx, origin), { secretToken: env.TELEGRAM_WEBHOOK_SECRET })(req);
    }
    if (req.method === "POST" && pathname === "/remnawave") return handleRemnawaveWebhook(req, env, ctx);
    if (req.method === "GET" && pathname === "/routing") {
      // cached at the edge for an hour, so upstream changes land within that
      const res = await fetch(HAPP_ROUTING_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!res.ok) return new Response("Upstream error", { status: 502 });
      return new Response(routingPage((await res.text()).trim()), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

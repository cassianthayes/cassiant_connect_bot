# cassiant-connect-bot

A Telegram VPN shop bot on Cloudflare Workers. Each Telegram account maps to the Remnawave user `tg_<telegram id>`, which is created on `/start`.
Remnawave is the only source of user state. D1 stores just promocodes, failed promocode attempts and processed payments.

```
src/
  index.ts      routes: POST /telegram, POST /remnawave, GET /routing
  bot.ts        Telegram handlers
  remnawave.ts  Remnawave API client and webhook handler
  promo.ts      promocodes: generation, redemption, rate limit
  db.ts         drizzle schema
  texts.ts      every string and keyboard (welcome message: texts.welcome)
  telegram.ts   client options and the log-group logger
  env.ts        bindings
```

## Features

- Reply-keyboard menu: **Оплатить звёздами**, **Промокод**, **Как подключиться**. The last one shows subscription status with three inline buttons: **Подключиться** opens the subscription page, which has its own setup guide, **Для продвинутых** sends the raw link hidden under a spoiler, and **Маршрутизация для INCY** opens `GET /routing` on the worker, a tiny page that forwards to the recommended [roscomvpn-routing](https://github.com/hydraponique/roscomvpn-routing) `incy://` deeplink (fetched from GitHub, edge-cached for an hour), since Telegram buttons can't hold `incy://` URLs.
- All dates are shown in Moscow time with an «МСК» suffix.
- Stars plans are set in `PLANS` in `wrangler.jsonc` as days → price in Stars.
- Promocodes look like `1234-5678` and are single-use. Users can type them (`12345678` and `1234 5678` also work) or open `https://t.me/<bot>?start=1234-5678`.
  - Admin command: `/gen <days> [count]`, up to 30 codes at a time.
  - Rate limit: 5 wrong codes per user per hour.
- Remnawave webhooks: a reminder 3 days and 1 day before expiry, plus a message when the subscription expires.
- Log group: every user action, payment, promocode, error and Remnawave event is posted silently to `LOG_CHAT_ID`.

## Setup

```sh
bun install

bunx wrangler d1 create cassiant-connect-bot   # put the database_id into wrangler.jsonc
bun run db:migrate

# edit "vars" in wrangler.jsonc: ADMIN_ID, LOG_CHAT_ID, REMNAWAVE_URL, REMNAWAVE_SQUADS, PLANS

bunx wrangler secret put BOT_TOKEN
bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET    # any random string [A-Za-z0-9_-]
bunx wrangler secret put REMNAWAVE_TOKEN            # Remnawave panel -> API tokens
bunx wrangler secret put REMNAWAVE_WEBHOOK_SECRET   # see below

bun run deploy
cp .dev.vars.example .dev.vars                      # BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET, same values
bun run webhook https://cassiant-connect-bot.<account>.workers.dev
```

### Log group

1. Create a group and add the bot to it.
2. Get the group id, for example by forwarding a message from the group to @getidsbot. It looks like `-100…`.
3. Put that id in `LOG_CHAT_ID`.

Telegram allows about 20 messages per minute in a group. Under heavier traffic, log messages are delayed and retried.

### Remnawave webhooks (panel v2.8.0+)

1. Generate a secret. Remnawave requires exactly 64 characters, `a-zA-Z0-9` only:
   ```sh
   openssl rand -hex 32
   ```
2. Add the following to the panel's `.env`, usually `/opt/remnawave/.env`:
   ```env
   WEBHOOK_ENABLED=true
   WEBHOOK_URL=https://cassiant-connect-bot.<account>.workers.dev/remnawave
   WEBHOOK_SECRET_HEADER=<secret from step 1>

   EXPIRATION_NOTIFICATIONS_ENABLED=true
   # hours relative to expireAt: -72 = 3 days before, -24 = 1 day before
   EXPIRATION_NOTIFICATIONS=[-72, -24]
   ```
   `WEBHOOK_URL` takes comma-separated URLs if something else already listens.
3. Recreate the container, because `.env` changes need a recreate, not a restart:
   ```sh
   cd /opt/remnawave && docker compose down && docker compose up -d
   ```
4. Give the worker the same secret:
   ```sh
   bunx wrangler secret put REMNAWAVE_WEBHOOK_SECRET
   ```
5. Check it: edit any user in the panel. A `user.modified` line should appear in the log group. If nothing arrives, run `bunx wrangler tail`. A 401 there means the two secrets don't match.

The bot verifies `X-Remnawave-Signature`, an HMAC-SHA256 of the raw body. It sends reminders for `user.expiration` events with a negative offset and for `user.expired`, and writes every event to the log group.
To change when reminders go out, edit `EXPIRATION_NOTIFICATIONS`. The bot needs no changes, because the reminder text uses whatever offset arrives.

## Development

```sh
bun run typecheck
bun test
bun run db:generate        # after editing src/db.ts
bun run db:migrate:local
bun run dev
```

Set `TELEGRAM_API_ROOT` and `REMNAWAVE_URL` in `.dev.vars` to point at a mock or a self-hosted Bot API server.

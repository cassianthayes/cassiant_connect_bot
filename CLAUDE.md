Telegram VPN-shop bot: Cloudflare Worker + D1 (drizzle) + node-telegram-bot-api v2 (webhook) + Remnawave API/webhooks. Bun is the toolchain only; code runs on workerd, so no Bun runtime APIs in `src/`.

- Keep the structure flat and compact (see README for the file map). All strings/keyboards in `src/texts.ts` (Russian; menus are reply keyboards, the only inline buttons are under «Как подключиться»).
- Remnawave is the source of truth for users (`tg_<telegramId>`); no local users table.
- Every user-visible action logs one line to the log group via `event()`/`createLogger`.
- Build Telegram clients with `telegramOptions(env)` (bound fetch; unbound throws "Illegal invocation" on Workers).
- `bun check`, `bun test`, `bun run db:generate` after schema changes.

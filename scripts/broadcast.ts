// Usage: bun run broadcast <message-file> [--send]
import { readFile } from "node:fs/promises";
import process from "node:process";
import { esc } from "../src/texts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args: string[] = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (
    !file ||
    args.some((arg) => arg.startsWith("--") && arg !== "--send") ||
    args.filter((arg) => !arg.startsWith("--")).length !== 1
  ) {
    throw new Error("Usage: bun run broadcast <message-file> [--send]");
  }
  const config = Bun.JSONC.parse(
    await Bun.file(`${import.meta.dir}/../wrangler.jsonc`).text(),
  ) as { vars: Record<string, unknown> };
  const vars = config.vars;
  const token = process.env.BOT_TOKEN;
  const remnaToken = process.env.REMNAWAVE_TOKEN;
  const remnaUrl =
    process.env.REMNAWAVE_URL ?? String(vars.REMNAWAVE_URL ?? "");
  const logChat = process.env.LOG_CHAT_ID ?? String(vars.LOG_CHAT_ID ?? "");
  const apiRoot = (
    process.env.TELEGRAM_API_ROOT ?? "https://api.telegram.org"
  ).replace(/\/+$/, "");
  const send = args.includes("--send");
  if (!remnaToken || !remnaUrl || (send && (!token || !logChat))) {
    throw new Error(
      "Set REMNAWAVE_TOKEN and, for --send, BOT_TOKEN in .dev.vars; REMNAWAVE_URL and LOG_CHAT_ID default to wrangler.jsonc.",
    );
  }
  const text = await readFile(file, "utf8");
  if (!text.trim() || text.length > 4096)
    throw new Error("Message must contain 1–4096 characters (plain text).");

  // Read the entire audience before sending anything; never broadcast to unrelated panel accounts.
  const recipients = new Set<number>();
  let start = 0;
  while (true) {
    const response = await fetch(
      `${remnaUrl.replace(/\/+$/, "")}/api/users?start=${start}&size=100`,
      {
        headers: { Authorization: `Bearer ${remnaToken}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(`Remnawave users: HTTP ${response.status}`);
    const payload = (await response.json()) as {
      response: {
        users: { username: string; telegramId: number | null }[];
        total: number;
      };
    };
    const page = payload.response;
    if (
      !Array.isArray(page?.users) ||
      !Number.isSafeInteger(page.total) ||
      page.total < 0
    )
      throw new Error("Unexpected Remnawave users response");
    for (const user of page.users) {
      const match = /^tg_([1-9]\d*)$/.exec(user.username);
      if (!match) continue;
      const id = Number(match[1]);
      if (!Number.isSafeInteger(id)) continue;
      if (user.telegramId != null && user.telegramId !== id)
        throw new Error(`Telegram ID mismatch for ${user.username}`);
      recipients.add(id);
    }
    start += page.users.length;
    if (start >= page.total) break;
    if (!page.users.length)
      throw new Error("Remnawave pagination ended before total; nothing sent");
  }
  console.log(`Recipients: ${recipients.size}\nMessage (plain text):\n${text}`);
  if (!send) {
    console.log(
      "Dry run: nothing sent. Add --send to deliver to all listed bot accounts.",
    );
    return;
  }

  async function telegram(
    chatId: number | string,
    message: string,
    html = false,
  ) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(`${apiRoot}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          ...(html ? { parse_mode: "HTML", disable_notification: true } : {}),
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = (await response.json()) as {
        ok: boolean;
        error_code?: number;
        description?: string;
        parameters?: { retry_after?: number };
      };
      if (result.ok) return;
      if (result.error_code === 429 && attempt < 5) {
        await sleep((result.parameters?.retry_after ?? 5) * 1000 + 250);
        continue;
      }
      throw new Error(
        `Telegram ${result.error_code ?? response.status}: ${result.description ?? "request failed"}`,
      );
    }
  }
  // Await logs and stay below Telegram's group limit of approximately 20 messages/minute.
  async function event(message: string) {
    console.log(message);
    await telegram(logChat, esc(message), true);
    await sleep(3100);
  }
  await event(`📣 Broadcast started: ${recipients.size} recipients`);
  let sent = 0;
  let failed = 0;
  for (const id of recipients) {
    let outcome: string;
    try {
      await telegram(id, text);
      sent++;
      outcome = `📣 Broadcast → ${id}: sent`;
    } catch (error) {
      failed++;
      outcome = `📣 Broadcast → ${id}: ${error instanceof Error ? error.message : "request failed"}`;
    }
    // Stop if logging fails rather than continuing an unlogged broadcast.
    await event(outcome);
  }
  await event(`📣 Broadcast finished: ${sent} sent, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  // Do not print fetch errors/causes: their URLs can contain the bot token.
  console.error(
    error instanceof Error
      ? error.message.replace(/bot\d+:[^/\s]+/g, "bot[redacted]")
      : "Broadcast failed",
  );
  process.exitCode = 1;
});

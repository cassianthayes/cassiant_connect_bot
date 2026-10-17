import { and, eq, isNull } from "drizzle-orm";
import { promoAttempts, promocodes, type Db } from "./db";

const MAX_FAILS = 5;
const WINDOW_MS = 60 * 60 * 1000;

/** `1234-5678`; also accepts `12345678` and `1234 5678` */
export const CODE_RE = /^\s*\d{4}[-\s]?\d{4}\s*$/;

export const normalizeCode = (input: string) =>
  CODE_RE.test(input) ? input.replace(/\D/g, "").replace(/^\d{4}/, "$&-") : null;

export function generateCode(): string {
  // rejection sampling: keep only values below the largest multiple of 1e8, so every code is equally likely
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  if (n! >= 2 ** 32 - (2 ** 32 % 1e8)) return generateCode();
  return normalizeCode(String(n! % 1e8).padStart(8, "0"))!;
}

export async function createCodes(db: Db, days: number, count: number): Promise<string[]> {
  const codes: string[] = [];
  while (codes.length < count) {
    const batch = Array.from({ length: count - codes.length }, () => ({ code: generateCode(), days }));
    // collisions with existing codes are skipped and regenerated
    const inserted = await db.insert(promocodes).values(batch).onConflictDoNothing().returning();
    codes.push(...inserted.map((r) => r.code));
  }
  return codes;
}

export type RedeemResult = { ok: true; days: number } | { ok: false; reason: "invalid" | "used" | "limited" };

export async function redeemCode(db: Db, code: string, telegramId: number): Promise<RedeemResult> {
  const now = Date.now();
  const attempts = await db.query.promoAttempts.findFirst({ where: eq(promoAttempts.telegramId, telegramId) });
  const inWindow = attempts !== undefined && attempts.windowStart.getTime() > now - WINDOW_MS;
  if (inWindow && attempts.fails >= MAX_FAILS) return { ok: false, reason: "limited" };

  // atomic claim: only one user can flip used_by from NULL
  const [claimed] = await db
    .update(promocodes)
    .set({ usedBy: telegramId, usedAt: new Date(now) })
    .where(and(eq(promocodes.code, code), isNull(promocodes.usedBy)))
    .returning();
  if (claimed) return { ok: true, days: claimed.days };

  const row = inWindow
    ? { telegramId, fails: attempts.fails + 1, windowStart: attempts.windowStart }
    : { telegramId, fails: 1, windowStart: new Date(now) };
  await db.insert(promoAttempts).values(row).onConflictDoUpdate({ target: promoAttempts.telegramId, set: row });

  const exists = await db.query.promocodes.findFirst({ where: eq(promocodes.code, code) });
  return { ok: false, reason: exists ? "used" : "invalid" };
}

/** Undo a claim when applying the days failed, so the user can retry. */
export const releaseCode = (db: Db, code: string) =>
  db.update(promocodes).set({ usedBy: null, usedAt: null }).where(eq(promocodes.code, code));

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`);

export const promocodes = sqliteTable("promocodes", {
  code: text("code").primaryKey(),
  days: integer("days").notNull(),
  usedBy: integer("used_by"),
  usedAt: timestamp("used_at"),
  createdAt: createdAt(),
});

/** failed promocode attempts per user, for rate limiting */
export const promoAttempts = sqliteTable("promo_attempts", {
  telegramId: integer("telegram_id").primaryKey(),
  fails: integer("fails").notNull(),
  windowStart: timestamp("window_start").notNull(),
});

/** processed Stars payments, keyed by charge id so a redelivered update is applied once */
export const payments = sqliteTable("payments", {
  chargeId: text("charge_id").primaryKey(),
  telegramId: integer("telegram_id").notNull(),
  days: integer("days").notNull(),
  stars: integer("stars").notNull(),
  createdAt: createdAt(),
});

export const getDb = (d1: D1Database) => drizzle(d1, { schema: { promocodes, promoAttempts, payments } });
export type Db = ReturnType<typeof getDb>;

import { expect, test } from "bun:test";
import { CODE_RE, generateCode, normalizeCode } from "./promo";

test("generated codes are 1234-5678 and valid start parameters", () => {
  for (let i = 0; i < 1000; i++) expect(generateCode()).toMatch(/^\d{4}-\d{4}$/);
});

test("normalizes user input", () => {
  expect(normalizeCode("12345678")).toBe("1234-5678");
  expect(normalizeCode(" 1234 5678 ")).toBe("1234-5678");
  expect(normalizeCode("0012-0000")).toBe("0012-0000");
});

test("rejects non-codes", () => {
  for (const s of ["", "1234-567", "1234-56789", "abcd-efgh", "Промокод"]) {
    expect(CODE_RE.test(s)).toBe(false);
    expect(normalizeCode(s)).toBeNull();
  }
});

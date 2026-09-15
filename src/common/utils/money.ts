import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Convert a Prisma Decimal (or number/string) into a plain JS number rounded to 2 decimals. */
export function num(value: DecimalLike): number {
  if (value === null || value === undefined) return 0;
  const n = value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  return Math.round(n * 100) / 100;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Teacher share of an amount at a given percentage. */
export function share(amount: DecimalLike, percent: DecimalLike): number {
  return round2((num(amount) * num(percent)) / 100);
}

/**
 * Recursively convert Prisma Decimal values into numbers so that the JSON
 * sent to the frontend contains real numbers instead of strings.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return num(value) as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }
  return value;
}

import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { badRequest, notFound } from "../../common/utils/errors";
import { num, round2 } from "../../common/utils/money";
import { assertSharesValid, splitAmount, type ShareInput } from "../finance/finance.service";
import type { CreateTradingPayoutInput, TradingDefaultsInput, TradingFilters, UpdateTradingPayoutInput } from "./trading.schema";

export const tradingInclude = {
  shares: { include: { partner: { select: { id: true, name: true, kind: true } } } },
} as const satisfies Prisma.TradingPayoutInclude;

type Loaded = Prisma.TradingPayoutGetPayload<{ include: typeof tradingInclude }>;

function shape(t: Loaded) {
  const shares = t.shares.map((s) => ({
    partnerId: s.partnerId,
    partnerName: s.partner.name,
    percent: num(s.percent),
    amount: num(s.amount),
  }));
  const partnerShare = round2(shares.reduce((a, s) => a + s.amount, 0));
  return { ...t, shares, partnerShare, companyShare: round2(num(t.amount) - partnerShare) };
}

/** Saved split for new trading payouts. Company keeps whatever is left. */
export async function getDefaults() {
  const rows = await prisma.tradingShareDefault.findMany({
    include: { partner: { select: { id: true, name: true, kind: true, isActive: true } } },
    orderBy: { partner: { name: "asc" } },
  });
  const shares = rows.map((r) => ({ partnerId: r.partnerId, partner: r.partner, percent: num(r.percent) }));
  const partnerPercent = round2(shares.reduce((a, s) => a + s.percent, 0));
  return { shares, partnerPercent, companyPercent: round2(100 - partnerPercent) };
}

export async function setDefaults(input: TradingDefaultsInput) {
  const shares = input.shares.filter((s) => s.percent > 0);
  assertSharesValid(shares);
  if (shares.length) {
    const found = await prisma.partner.count({ where: { id: { in: shares.map((s) => s.partnerId) } } });
    if (found !== shares.length) throw badRequest("One of the selected partners does not exist");
  }
  await prisma.$transaction([
    prisma.tradingShareDefault.deleteMany({}),
    prisma.tradingShareDefault.createMany({ data: shares.map((s) => ({ partnerId: s.partnerId, percent: s.percent })) }),
  ]);
  return getDefaults();
}

async function resolveShares(requested?: ShareInput[]): Promise<ShareInput[]> {
  let shares = requested;
  if (!shares) {
    const rows = await prisma.tradingShareDefault.findMany();
    shares = rows.map((r) => ({ partnerId: r.partnerId, percent: num(r.percent) }));
  }
  shares = shares.filter((s) => s.percent > 0);
  assertSharesValid(shares);
  if (shares.length) {
    const found = await prisma.partner.count({ where: { id: { in: shares.map((s) => s.partnerId) } } });
    if (found !== shares.length) throw badRequest("One of the selected partners does not exist");
  }
  return shares;
}

export async function listTradingPayouts(f: TradingFilters) {
  const where: Prisma.TradingPayoutWhereInput = {
    ...(f.from || f.to
      ? { occurredAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}) } }
      : {}),
  };
  const rows = (await prisma.tradingPayout.findMany({ where, include: tradingInclude, orderBy: { occurredAt: "desc" } })).map(shape);

  // Per-partner totals for the summary strip.
  const byPartner = new Map<string, { partnerId: string; partnerName: string; amount: number }>();
  for (const row of rows) {
    for (const s of row.shares) {
      const current = byPartner.get(s.partnerId) ?? { partnerId: s.partnerId, partnerName: s.partnerName, amount: 0 };
      current.amount = round2(current.amount + s.amount);
      byPartner.set(s.partnerId, current);
    }
  }

  return {
    payouts: rows,
    summary: {
      count: rows.length,
      total: round2(rows.reduce((a, r) => a + num(r.amount), 0)),
      partnerShare: round2(rows.reduce((a, r) => a + r.partnerShare, 0)),
      companyShare: round2(rows.reduce((a, r) => a + r.companyShare, 0)),
      byPartner: [...byPartner.values()].sort((a, b) => b.amount - a.amount),
    },
  };
}

export async function createTradingPayout(input: CreateTradingPayoutInput) {
  const shares = await resolveShares(input.shares);
  const split = splitAmount(input.amount, shares);
  const created = await prisma.tradingPayout.create({
    data: {
      title: input.title || null,
      amount: input.amount,
      occurredAt: input.occurredAt ?? new Date(),
      note: input.note || null,
      shares: { create: split.rows },
    },
    include: tradingInclude,
  });
  return shape(created);
}

export async function updateTradingPayout(id: string, input: UpdateTradingPayoutInput) {
  const existing = await prisma.tradingPayout.findUnique({ where: { id }, include: { shares: true } });
  if (!existing) throw notFound("Trading payout not found");

  const amount = input.amount ?? num(existing.amount);
  // Keep the original percentages unless new ones are supplied.
  const shares = input.shares
    ? await resolveShares(input.shares)
    : existing.shares.map((s) => ({ partnerId: s.partnerId, percent: num(s.percent) }));
  const split = splitAmount(amount, shares);

  const updated = await prisma.tradingPayout.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title || null } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
      amount,
      shares: { deleteMany: {}, create: split.rows },
    },
    include: tradingInclude,
  });
  return shape(updated);
}

export async function deleteTradingPayout(id: string) {
  await prisma.tradingPayout.delete({ where: { id } });
}

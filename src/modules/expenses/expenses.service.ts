import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { num, round2 } from "../../common/utils/money";
import type { ExpenseFilters, ExpenseInput, UpdateExpenseInput } from "./expenses.schema";

/** Company running costs. They come out of the company share (see finance.companyTotals). */
export async function listExpenses(f: ExpenseFilters) {
  const where: Prisma.ExpenseWhereInput = {
    ...(f.category ? { category: { equals: f.category, mode: "insensitive" } } : {}),
    ...(f.search ? { OR: [{ title: { contains: f.search, mode: "insensitive" } }, { note: { contains: f.search, mode: "insensitive" } }] } : {}),
    ...(f.from || f.to
      ? { spentAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999`) } : {}) } }
      : {}),
  };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [expenses, allAgg, monthAgg, categories] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { spentAt: "desc" } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { spentAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);
  return {
    expenses,
    summary: {
      count: expenses.length,
      filteredTotal: round2(expenses.reduce((s, e) => s + num(e.amount), 0)),
      total: num(allAgg._sum.amount),
      thisMonth: num(monthAgg._sum.amount),
    },
    categories: categories.map((c) => c.category).filter((c): c is string => !!c),
  };
}

export function createExpense(input: ExpenseInput) {
  return prisma.expense.create({
    data: { title: input.title, category: input.category || null, amount: input.amount, spentAt: input.spentAt ?? new Date(), note: input.note || null },
  });
}

export function updateExpense(id: string, input: UpdateExpenseInput) {
  return prisma.expense.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.category !== undefined ? { category: input.category || null } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.spentAt !== undefined ? { spentAt: input.spentAt } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
    },
  });
}

export async function deleteExpense(id: string) {
  await prisma.expense.delete({ where: { id } });
}

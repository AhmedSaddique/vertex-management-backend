-- 1. Trading income, split between the members and the company.
-- 2. New academy policy: every active partner takes 20% of every course, company keeps 40%.
--    Recorded payments keep their original split, so past money is untouched.

CREATE TABLE "TradingPayout" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TradingPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TradingPayout_occurredAt_idx" ON "TradingPayout"("occurredAt");

CREATE TABLE "TradingPayoutShare" (
    "id" TEXT NOT NULL,
    "tradingPayoutId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "TradingPayoutShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingPayoutShare_tradingPayoutId_partnerId_key" ON "TradingPayoutShare"("tradingPayoutId", "partnerId");
CREATE INDEX "TradingPayoutShare_partnerId_idx" ON "TradingPayoutShare"("partnerId");
ALTER TABLE "TradingPayoutShare" ADD CONSTRAINT "TradingPayoutShare_tradingPayoutId_fkey" FOREIGN KEY ("tradingPayoutId") REFERENCES "TradingPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradingPayoutShare" ADD CONSTRAINT "TradingPayoutShare_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TradingShareDefault" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    CONSTRAINT "TradingShareDefault_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TradingShareDefault_partnerId_key" ON "TradingShareDefault"("partnerId");
ALTER TABLE "TradingShareDefault" ADD CONSTRAINT "TradingShareDefault_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trading: 25% to each active partner, the rest stays with the company.
INSERT INTO "TradingShareDefault" ("id", "partnerId", "percent")
SELECT gen_random_uuid()::text, p."id", 25 FROM "Partner" p WHERE p."isActive" = true;

-- Courses: 20% to each active partner on every subject, company keeps the remainder.
DELETE FROM "SubjectShareDefault";
INSERT INTO "SubjectShareDefault" ("id", "subjectId", "partnerId", "percent")
SELECT gen_random_uuid()::text, s."id", p."id", 20
FROM "Subject" s CROSS JOIN "Partner" p
WHERE p."isActive" = true;

-- Apply the same split to students already enrolled. Their recorded payments keep the
-- split that was snapshotted at the time, so earnings already booked do not move.
DELETE FROM "StudentShare";
INSERT INTO "StudentShare" ("id", "studentId", "partnerId", "percent")
SELECT gen_random_uuid()::text, st."id", p."id", 20
FROM "Student" st CROSS JOIN "Partner" p
WHERE p."isActive" = true;

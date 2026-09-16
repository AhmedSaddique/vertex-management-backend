-- Partners (fee share holders), per-student and per-payment share splits,
-- installments (fee due dates) and company expenses. Existing data is migrated:
-- every teacher becomes a TEACHER partner (same id), every admin a MANAGEMENT partner,
-- and the old single teacher commission becomes a StudentShare / PaymentShare row.

CREATE TYPE "PartnerKind" AS ENUM ('TEACHER', 'MANAGEMENT');

CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL DEFAULT 'TEACHER',
    "userId" TEXT,
    "teacherId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");
CREATE UNIQUE INDEX "Partner_teacherId_key" ON "Partner"("teacherId");
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SubjectShareDefault" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    CONSTRAINT "SubjectShareDefault_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubjectShareDefault_subjectId_partnerId_key" ON "SubjectShareDefault"("subjectId", "partnerId");
ALTER TABLE "SubjectShareDefault" ADD CONSTRAINT "SubjectShareDefault_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectShareDefault" ADD CONSTRAINT "SubjectShareDefault_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentShare" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    CONSTRAINT "StudentShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentShare_studentId_partnerId_key" ON "StudentShare"("studentId", "partnerId");
ALTER TABLE "StudentShare" ADD CONSTRAINT "StudentShare_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentShare" ADD CONSTRAINT "StudentShare_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Installment_studentId_idx" ON "Installment"("studentId");
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentShare" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "PaymentShare_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentShare_paymentId_partnerId_key" ON "PaymentShare"("paymentId", "partnerId");
CREATE INDEX "PaymentShare_partnerId_idx" ON "PaymentShare"("partnerId");
ALTER TABLE "PaymentShare" ADD CONSTRAINT "PaymentShare_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentShare" ADD CONSTRAINT "PaymentShare_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Expense_spentAt_idx" ON "Expense"("spentAt");

-- Data: partners from teachers (reusing the teacher id) and from admin users (reusing the user id)
INSERT INTO "Partner" ("id", "name", "kind", "userId", "teacherId", "isActive", "createdAt", "updatedAt")
SELECT t."id", u."name", 'TEACHER', t."userId", t."id", u."isActive", NOW(), NOW()
FROM "Teacher" t JOIN "User" u ON u."id" = t."userId";

INSERT INTO "Partner" ("id", "name", "kind", "userId", "teacherId", "isActive", "createdAt", "updatedAt")
SELECT u."id", u."name", 'MANAGEMENT', u."id", NULL, u."isActive", NOW(), NOW()
FROM "User" u WHERE u."role" = 'ADMIN';

-- Data: the old single teacher commission becomes a share row
INSERT INTO "StudentShare" ("id", "studentId", "partnerId", "percent")
SELECT gen_random_uuid()::text, s."id", s."teacherId", s."commissionPercent" FROM "Student" s;

INSERT INTO "PaymentShare" ("id", "paymentId", "partnerId", "percent", "amount")
SELECT gen_random_uuid()::text, p."id", p."teacherId", p."commissionPercent", ROUND(p."amount" * p."commissionPercent" / 100, 2)
FROM "Payment" p;

-- Payout: teacher -> partner
ALTER TABLE "Payout" ADD COLUMN "partnerId" TEXT;
UPDATE "Payout" SET "partnerId" = "teacherId";
ALTER TABLE "Payout" ALTER COLUMN "partnerId" SET NOT NULL;
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_teacherId_fkey";
DROP INDEX "Payout_teacherId_idx";
ALTER TABLE "Payout" DROP COLUMN "teacherId";
CREATE INDEX "Payout_partnerId_idx" ON "Payout"("partnerId");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment: link to installment; drop the old single percentage columns
ALTER TABLE "Payment" ADD COLUMN "installmentId" TEXT;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" DROP COLUMN "commissionPercent";
ALTER TABLE "Student" DROP COLUMN "commissionPercent";
ALTER TABLE "Teacher" DROP COLUMN "defaultCommissionPercent";

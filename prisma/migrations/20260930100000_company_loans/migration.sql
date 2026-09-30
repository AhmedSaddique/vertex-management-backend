-- Money taken from the company temporarily and paid back later.
-- Outstanding loans are cash out of the company, not an expense.

CREATE TABLE "CompanyLoan" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "borrowerName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyLoan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CompanyLoan_partnerId_idx" ON "CompanyLoan"("partnerId");
CREATE INDEX "CompanyLoan_takenAt_idx" ON "CompanyLoan"("takenAt");
ALTER TABLE "CompanyLoan" ADD CONSTRAINT "CompanyLoan_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoanRepayment_loanId_idx" ON "LoanRepayment"("loanId");
CREATE INDEX "LoanRepayment_paidAt_idx" ON "LoanRepayment"("paidAt");
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "CompanyLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

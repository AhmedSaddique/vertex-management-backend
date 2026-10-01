-- The day a student's first class takes place. Existing students have none recorded.
ALTER TABLE "Student" ADD COLUMN "classStartDate" TIMESTAMP(3);

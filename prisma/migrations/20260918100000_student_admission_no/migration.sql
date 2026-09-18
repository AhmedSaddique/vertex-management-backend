-- Sequential admission number for students, starting at 1001.
-- Existing students are numbered in enrollment order; the sequence then continues after them.

CREATE SEQUENCE "Student_admissionNo_seq" START WITH 1001;

ALTER TABLE "Student" ADD COLUMN "admissionNo" INTEGER;

WITH ordered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "enrolledAt" ASC, "createdAt" ASC, "id" ASC) AS rn
    FROM "Student"
)
UPDATE "Student" s
SET "admissionNo" = (1000 + o.rn)::int
FROM ordered o
WHERE s."id" = o."id";

SELECT setval('"Student_admissionNo_seq"', COALESCE((SELECT MAX("admissionNo") FROM "Student"), 1000));

ALTER TABLE "Student" ALTER COLUMN "admissionNo" SET NOT NULL;
ALTER TABLE "Student" ALTER COLUMN "admissionNo" SET DEFAULT nextval('"Student_admissionNo_seq"');
ALTER SEQUENCE "Student_admissionNo_seq" OWNED BY "Student"."admissionNo";

CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");

-- How a student attends class. Existing students default to in-person.
CREATE TYPE "ClassMode" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');

ALTER TABLE "Student" ADD COLUMN "classMode" "ClassMode" NOT NULL DEFAULT 'PHYSICAL';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "availableSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fatherPhone" TEXT;


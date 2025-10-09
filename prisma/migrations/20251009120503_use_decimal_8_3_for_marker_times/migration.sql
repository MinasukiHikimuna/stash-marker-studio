/*
  Warnings:

  - You are about to alter the column `seconds` on the `markers` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(8,3)`.
  - You are about to alter the column `end_seconds` on the `markers` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(8,3)`.

*/
-- AlterTable
ALTER TABLE "markers" ALTER COLUMN "seconds" SET DATA TYPE DECIMAL(8,3),
ALTER COLUMN "end_seconds" SET DATA TYPE DECIMAL(8,3);

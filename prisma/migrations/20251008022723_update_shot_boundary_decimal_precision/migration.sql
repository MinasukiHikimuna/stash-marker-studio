/*
  Warnings:

  - You are about to alter the column `start_time` on the `shot_boundaries` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(8,3)`.
  - You are about to alter the column `end_time` on the `shot_boundaries` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(8,3)`.

*/
-- AlterTable
ALTER TABLE "shot_boundaries" ALTER COLUMN "start_time" SET DATA TYPE DECIMAL(8,3),
ALTER COLUMN "end_time" SET DATA TYPE DECIMAL(8,3);

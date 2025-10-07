/*
  Warnings:

  - You are about to drop the column `confidence` on the `marker_slots` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `marker_slots` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "marker_slots" DROP COLUMN "confidence",
DROP COLUMN "notes";

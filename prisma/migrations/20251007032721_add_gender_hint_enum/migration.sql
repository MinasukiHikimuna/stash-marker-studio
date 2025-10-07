/*
  Warnings:

  - The `gender_hint` column on the `slot_definitions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "GenderHint" AS ENUM ('MALE', 'FEMALE', 'TRANSGENDER_MALE', 'TRANSGENDER_FEMALE');

-- AlterTable
ALTER TABLE "slot_definitions" DROP COLUMN "gender_hint",
ADD COLUMN     "gender_hint" "GenderHint";

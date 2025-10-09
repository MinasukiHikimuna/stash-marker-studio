/*
  Warnings:

  - You are about to drop the column `display_order` on the `slot_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `gender_hint` on the `slot_definitions` table. All the data in the column will be lost.
  - You are about to drop the column `stashapp_tag_id` on the `slot_definitions` table. All the data in the column will be lost.
  - Added the required column `slot_definition_set_id` to the `slot_definitions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `slot_definitions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."slot_definitions_stashapp_tag_id_idx";

-- AlterTable
ALTER TABLE "slot_definitions" DROP COLUMN "display_order",
DROP COLUMN "gender_hint",
DROP COLUMN "stashapp_tag_id",
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slot_definition_set_id" UUID NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "slot_definition_sets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "stashapp_tag_id" INTEGER NOT NULL,
    "allow_same_performer_in_multiple_slots" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_definition_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_definition_gender_hints" (
    "slot_definition_id" UUID NOT NULL,
    "gender_hint" "GenderHint" NOT NULL,

    CONSTRAINT "slot_definition_gender_hints_pkey" PRIMARY KEY ("slot_definition_id","gender_hint")
);

-- CreateIndex
CREATE UNIQUE INDEX "slot_definition_sets_stashapp_tag_id_key" ON "slot_definition_sets"("stashapp_tag_id");

-- CreateIndex
CREATE INDEX "slot_definitions_slot_definition_set_id_idx" ON "slot_definitions"("slot_definition_set_id");

-- AddForeignKey
ALTER TABLE "slot_definitions" ADD CONSTRAINT "slot_definitions_slot_definition_set_id_fkey" FOREIGN KEY ("slot_definition_set_id") REFERENCES "slot_definition_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_definition_gender_hints" ADD CONSTRAINT "slot_definition_gender_hints_slot_definition_id_fkey" FOREIGN KEY ("slot_definition_id") REFERENCES "slot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

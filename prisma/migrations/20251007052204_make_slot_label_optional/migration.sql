-- DropIndex
DROP INDEX "public"."slot_definitions_stashapp_tag_id_slot_label_key";

-- AlterTable
ALTER TABLE "slot_definitions" ALTER COLUMN "slot_label" DROP NOT NULL;

-- AlterTable
ALTER TABLE "marker_slots" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "shot_boundaries" ALTER COLUMN "id" SET DEFAULT uuidv7();

-- AlterTable
ALTER TABLE "slot_definitions" ALTER COLUMN "id" SET DEFAULT uuidv7();

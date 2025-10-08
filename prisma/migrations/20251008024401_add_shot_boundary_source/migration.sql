-- CreateEnum
CREATE TYPE "ShotBoundarySource" AS ENUM ('PYSCENEDETECT', 'MANUAL');

-- AlterTable
ALTER TABLE "shot_boundaries" ADD COLUMN     "source" "ShotBoundarySource" NOT NULL DEFAULT 'MANUAL';

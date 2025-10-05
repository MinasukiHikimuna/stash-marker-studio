-- CreateTable
CREATE TABLE "shot_boundaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stashapp_scene_id" INTEGER NOT NULL,
    "start_time" DECIMAL(65,30) NOT NULL,
    "end_time" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shot_boundaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shot_boundaries_stashapp_scene_id_start_time_idx" ON "shot_boundaries"("stashapp_scene_id", "start_time");

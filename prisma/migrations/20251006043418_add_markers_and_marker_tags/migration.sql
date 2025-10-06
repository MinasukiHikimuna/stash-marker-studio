-- CreateTable
CREATE TABLE "markers" (
    "id" SERIAL NOT NULL,
    "stashapp_marker_id" INTEGER,
    "stashapp_scene_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "seconds" DECIMAL(65,30) NOT NULL,
    "end_seconds" DECIMAL(65,30),
    "primary_tag_id" INTEGER,
    "last_synced_at" TIMESTAMP(3),
    "last_exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marker_tags" (
    "id" SERIAL NOT NULL,
    "marker_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marker_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markers_stashapp_marker_id_key" ON "markers"("stashapp_marker_id");

-- CreateIndex
CREATE INDEX "markers_stashapp_scene_id_idx" ON "markers"("stashapp_scene_id");

-- CreateIndex
CREATE INDEX "markers_stashapp_marker_id_idx" ON "markers"("stashapp_marker_id");

-- CreateIndex
CREATE INDEX "marker_tags_tag_id_idx" ON "marker_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "marker_tags_marker_id_tag_id_key" ON "marker_tags"("marker_id", "tag_id");

-- AddForeignKey
ALTER TABLE "marker_tags" ADD CONSTRAINT "marker_tags_marker_id_fkey" FOREIGN KEY ("marker_id") REFERENCES "markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

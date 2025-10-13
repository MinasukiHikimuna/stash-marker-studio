-- CreateTable
CREATE TABLE "marker_group_tag_sorting" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "marker_group_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marker_group_tag_sorting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marker_group_tag_sorting_tag_id_key" ON "marker_group_tag_sorting"("tag_id");

-- CreateIndex
CREATE INDEX "marker_group_tag_sorting_marker_group_id_idx" ON "marker_group_tag_sorting"("marker_group_id");

-- CreateIndex
CREATE INDEX "marker_group_tag_sorting_marker_group_id_sort_order_idx" ON "marker_group_tag_sorting"("marker_group_id", "sort_order");

-- CreateTable
CREATE TABLE "corresponding_tag_mappings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_tag_id" INTEGER NOT NULL,
    "corresponding_tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corresponding_tag_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "corresponding_tag_mappings_source_tag_id_key" ON "corresponding_tag_mappings"("source_tag_id");

-- CreateIndex
CREATE INDEX "corresponding_tag_mappings_corresponding_tag_id_idx" ON "corresponding_tag_mappings"("corresponding_tag_id");

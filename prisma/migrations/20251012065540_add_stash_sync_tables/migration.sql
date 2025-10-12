-- CreateTable
CREATE TABLE "stash_performers" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "image_path" TEXT,
    "stash_updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_performers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stash_tags" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "stash_updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stash_tag_parents" (
    "child_id" INTEGER NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_tag_parents_pkey" PRIMARY KEY ("child_id","parent_id")
);

-- CreateTable
CREATE TABLE "stash_scenes" (
    "id" INTEGER NOT NULL,
    "title" TEXT,
    "date" DATE,
    "details" TEXT,
    "filesize" BIGINT,
    "duration" DECIMAL(10,2),
    "stash_updated_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stash_scene_performers" (
    "scene_id" INTEGER NOT NULL,
    "performer_id" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_scene_performers_pkey" PRIMARY KEY ("scene_id","performer_id")
);

-- CreateTable
CREATE TABLE "stash_scene_tags" (
    "scene_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stash_scene_tags_pkey" PRIMARY KEY ("scene_id","tag_id")
);

-- CreateIndex
CREATE INDEX "stash_performers_name_idx" ON "stash_performers"("name");

-- CreateIndex
CREATE INDEX "stash_performers_stash_updated_at_idx" ON "stash_performers"("stash_updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "stash_tags_name_key" ON "stash_tags"("name");

-- CreateIndex
CREATE INDEX "stash_tags_name_idx" ON "stash_tags"("name");

-- CreateIndex
CREATE INDEX "stash_tags_stash_updated_at_idx" ON "stash_tags"("stash_updated_at");

-- CreateIndex
CREATE INDEX "stash_tag_parents_parent_id_idx" ON "stash_tag_parents"("parent_id");

-- CreateIndex
CREATE INDEX "stash_scenes_date_idx" ON "stash_scenes"("date");

-- CreateIndex
CREATE INDEX "stash_scenes_stash_updated_at_idx" ON "stash_scenes"("stash_updated_at");

-- CreateIndex
CREATE INDEX "stash_scene_performers_performer_id_idx" ON "stash_scene_performers"("performer_id");

-- CreateIndex
CREATE INDEX "stash_scene_tags_tag_id_idx" ON "stash_scene_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "stash_tag_parents" ADD CONSTRAINT "stash_tag_parents_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "stash_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_tag_parents" ADD CONSTRAINT "stash_tag_parents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "stash_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_scene_performers" ADD CONSTRAINT "stash_scene_performers_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "stash_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_scene_performers" ADD CONSTRAINT "stash_scene_performers_performer_id_fkey" FOREIGN KEY ("performer_id") REFERENCES "stash_performers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_scene_tags" ADD CONSTRAINT "stash_scene_tags_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "stash_scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_scene_tags" ADD CONSTRAINT "stash_scene_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "stash_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

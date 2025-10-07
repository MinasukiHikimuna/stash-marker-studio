-- CreateTable
CREATE TABLE "slot_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stashapp_tag_id" INTEGER NOT NULL,
    "slot_label" TEXT NOT NULL,
    "gender_hint" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marker_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "marker_id" INTEGER NOT NULL,
    "slot_definition_id" UUID NOT NULL,
    "stashapp_performer_id" INTEGER,
    "confidence" DECIMAL(3,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marker_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_definitions_stashapp_tag_id_idx" ON "slot_definitions"("stashapp_tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "slot_definitions_stashapp_tag_id_slot_label_key" ON "slot_definitions"("stashapp_tag_id", "slot_label");

-- CreateIndex
CREATE INDEX "marker_slots_marker_id_idx" ON "marker_slots"("marker_id");

-- CreateIndex
CREATE INDEX "marker_slots_slot_definition_id_idx" ON "marker_slots"("slot_definition_id");

-- CreateIndex
CREATE INDEX "marker_slots_stashapp_performer_id_idx" ON "marker_slots"("stashapp_performer_id");

-- AddForeignKey
ALTER TABLE "marker_slots" ADD CONSTRAINT "marker_slots_marker_id_fkey" FOREIGN KEY ("marker_id") REFERENCES "markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marker_slots" ADD CONSTRAINT "marker_slots_slot_definition_id_fkey" FOREIGN KEY ("slot_definition_id") REFERENCES "slot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "marker_derivations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_marker_id" INTEGER NOT NULL,
    "derived_marker_id" INTEGER NOT NULL,
    "rule_id" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marker_derivations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marker_derivations_derived_marker_id_idx" ON "marker_derivations"("derived_marker_id");

-- CreateIndex
CREATE INDEX "marker_derivations_rule_id_idx" ON "marker_derivations"("rule_id");

-- CreateIndex
CREATE INDEX "marker_derivations_depth_idx" ON "marker_derivations"("depth");

-- CreateIndex
CREATE UNIQUE INDEX "marker_derivations_source_marker_id_derived_marker_id_key" ON "marker_derivations"("source_marker_id", "derived_marker_id");

-- AddForeignKey
ALTER TABLE "marker_derivations" ADD CONSTRAINT "marker_derivations_source_marker_id_fkey" FOREIGN KEY ("source_marker_id") REFERENCES "markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marker_derivations" ADD CONSTRAINT "marker_derivations_derived_marker_id_fkey" FOREIGN KEY ("derived_marker_id") REFERENCES "markers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

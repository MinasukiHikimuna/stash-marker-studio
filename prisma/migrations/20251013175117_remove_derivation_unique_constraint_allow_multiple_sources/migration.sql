-- Remove unique constraint to allow multiple source markers per derived marker
-- This enables tracking both immediate parent and ultimate source relationships

-- Drop the unique constraint
ALTER TABLE "marker_derivations"
  DROP CONSTRAINT IF EXISTS "marker_derivations_source_marker_id_derived_marker_id_key";

-- Add composite index for querying both directions efficiently
CREATE INDEX IF NOT EXISTS "marker_derivations_source_derived_idx"
  ON "marker_derivations"("source_marker_id", "derived_marker_id");

-- The existing index on derived_marker_id already exists for reverse lookups
-- CREATE INDEX "marker_derivations_derived_marker_id_idx" ON "marker_derivations"("derived_marker_id");

-- Drop triggers and functions that enforce primary tag consistency
DROP TRIGGER IF EXISTS prevent_deleting_primary_tag ON marker_tags;
DROP FUNCTION IF EXISTS prevent_primary_tag_deletion();

DROP TRIGGER IF EXISTS ensure_primary_tag_in_marker_tags ON markers;
DROP FUNCTION IF EXISTS validate_primary_tag_consistency();

-- Remove primary tags from marker_tags (they're already in markers.primary_tag_id)
DELETE FROM marker_tags WHERE is_primary = true;

-- Remove is_primary column as it's no longer needed
ALTER TABLE marker_tags DROP COLUMN is_primary;

-- Rename table to clarify it only contains additional (non-primary) tags
ALTER TABLE marker_tags RENAME TO marker_additional_tags;

-- Update index and constraint names to match new table name
ALTER INDEX marker_tags_pkey RENAME TO marker_additional_tags_pkey;
ALTER INDEX marker_tags_marker_id_tag_id_key RENAME TO marker_additional_tags_marker_id_tag_id_key;
ALTER INDEX marker_tags_tag_id_idx RENAME TO marker_additional_tags_tag_id_idx;

-- Update foreign key constraint name
ALTER TABLE marker_additional_tags
  RENAME CONSTRAINT marker_tags_marker_id_fkey TO marker_additional_tags_marker_id_fkey;

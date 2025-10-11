-- Ensure primary tags exist in marker_tags table with is_primary flag set to true

-- Step 1: Insert missing primary tags into marker_tags
INSERT INTO marker_tags (marker_id, tag_id, is_primary, created_at, updated_at)
SELECT
    m.id as marker_id,
    m.primary_tag_id as tag_id,
    true as is_primary,
    GREATEST(m.created_at, m.updated_at) as created_at,
    GREATEST(m.created_at, m.updated_at) as updated_at
FROM markers m
WHERE m.primary_tag_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM marker_tags mt
    WHERE mt.marker_id = m.id
      AND mt.tag_id = m.primary_tag_id
  );

-- Step 2: Ensure existing primary tags have is_primary = true
UPDATE marker_tags
SET is_primary = true, updated_at = CURRENT_TIMESTAMP
WHERE (marker_id, tag_id) IN (
    SELECT m.id, m.primary_tag_id
    FROM markers m
    WHERE m.primary_tag_id IS NOT NULL
)
AND is_primary = false;

-- Step 3: Clear is_primary flag from tags that are not the primary tag
UPDATE marker_tags
SET is_primary = false, updated_at = CURRENT_TIMESTAMP
WHERE is_primary = true
  AND (marker_id, tag_id) NOT IN (
    SELECT m.id, m.primary_tag_id
    FROM markers m
    WHERE m.primary_tag_id IS NOT NULL
  );

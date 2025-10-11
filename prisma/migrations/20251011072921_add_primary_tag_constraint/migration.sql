-- Add constraint to ensure primary_tag_id exists in marker_tags with is_primary = true

-- Create a function to validate primary tag consistency
CREATE OR REPLACE FUNCTION validate_primary_tag_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- If marker has a primary_tag_id, ensure it exists in marker_tags with is_primary = true
    IF NEW.primary_tag_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM marker_tags
            WHERE marker_id = NEW.id
              AND tag_id = NEW.primary_tag_id
        ) THEN
            RAISE EXCEPTION 'Primary tag must exist in marker_tags table';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate on marker insert/update
CREATE TRIGGER ensure_primary_tag_in_marker_tags
    AFTER INSERT OR UPDATE ON markers
    FOR EACH ROW
    WHEN (NEW.primary_tag_id IS NOT NULL)
    EXECUTE FUNCTION validate_primary_tag_consistency();

-- Create a function to prevent removing primary tag from marker_tags
CREATE OR REPLACE FUNCTION prevent_primary_tag_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the tag being deleted is a primary tag
    IF OLD.tag_id IN (
        SELECT primary_tag_id FROM markers WHERE id = OLD.marker_id AND primary_tag_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Cannot delete primary tag from marker_tags. Update marker.primary_tag_id first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent primary tag deletion
CREATE TRIGGER prevent_deleting_primary_tag
    BEFORE DELETE ON marker_tags
    FOR EACH ROW
    EXECUTE FUNCTION prevent_primary_tag_deletion();

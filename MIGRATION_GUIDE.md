# Migration Guide

This document provides instructions for migrating data and configuration when upgrading Stash Marker Studio.

## Table of Contents

- [Marker Group Tag Sorting Migration](#marker-group-tag-sorting-migration)

---

## Marker Group Tag Sorting Migration

**When:** After upgrading to a version that includes the `marker_group_tag_sorting` database table.

**Why:** Marker group tag sorting configuration has been moved from `app-config.json` to the PostgreSQL database for better reliability, multi-user support, and consistency with other metadata.

### Migration Steps

#### 1. Check if Migration is Needed

Look in your `app-config.json` file for a `markerGroupTagSorting` section:

```json
{
  "markerGroupTagSorting": {
    "8846": ["6619", "5867", "5378", ...],
    "8849": ["8809", "8646", ...]
  }
}
```

If this section exists and has data, you need to migrate.

#### 2. Run the Migration Script

From your project directory, run:

```bash
npx tsx scripts/migrate-tag-sorting-to-db.ts
```

Expected output:

```
🔄 Migrating marker group tag sorting to database...

Reading app-config.json...
Found markerGroupTagSorting with 2 marker group(s):
  • Marker Group 8846: 50 tag(s)
  • Marker Group 8849: 30 tag(s)

Migrating...
  ✅ Marker Group 8846: 50/50 tag(s) migrated
  ✅ Marker Group 8849: 30/30 tag(s) migrated

Summary:
  ✅ Migrated: 80 row(s)
  ⚠️  Skipped: 0 (already existed)
  ❌ Failed: 0

🎉 Migration complete!

Next steps:
  1. Verify the app works correctly
  2. (Optional) Remove markerGroupTagSorting from app-config.json
  3. (Optional) Backup app-config.json before removal
```

#### 3. Verify the Migration

1. Start your development server: `npm run dev`
2. Navigate to Settings > Marker Groups
3. Verify that your tag sorting order is preserved
4. Try drag-and-drop reordering to ensure it saves correctly

#### 4. Clean Up (Optional)

Once you've verified everything works:

1. **Backup your config** (recommended):
   ```bash
   cp app-config.json app-config.backup.json
   ```

2. **Edit `app-config.json`** and remove the `markerGroupTagSorting` section:
   ```json
   {
     "serverConfig": { ... },
     "markerConfig": { ... },
     // Remove this entire section:
     // "markerGroupTagSorting": { ... }
   }
   ```

3. The deprecation warning in your server logs will disappear.

### Troubleshooting

#### Migration Script Shows Errors

If the migration fails for specific tags:

1. Note which tag IDs failed (shown in error messages)
2. Check if those tags still exist in Stashapp
3. Manually verify the marker group relationships in Stashapp
4. Re-run the migration script (it's idempotent - safe to run multiple times)

#### Sorting Order Not Preserved

If your tag sorting appears incorrect after migration:

1. Check the database directly:
   ```sql
   SELECT marker_group_id, tag_id, sort_order
   FROM marker_group_tag_sorting
   ORDER BY marker_group_id, sort_order;
   ```

2. Compare with your `app-config.json` backup
3. If needed, manually adjust in the UI (Settings > Marker Groups > drag-and-drop)

#### Need to Rollback

To revert to JSON-based sorting:

1. Restore your `app-config.json` backup:
   ```bash
   cp app-config.backup.json app-config.json
   ```

2. Clear the database table:
   ```sql
   DELETE FROM marker_group_tag_sorting;
   ```

3. Restart the application

Note: The app will still attempt to load from the database first. For a full rollback, you would need to revert to a previous version of the code.

### Technical Details

**Database Schema:**
```sql
CREATE TABLE marker_group_tag_sorting (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  marker_group_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**API Endpoints:**
- `GET /api/marker-group-tag-sorting?markerGroupId=<id>` - Get sorted tags for a marker group
- `POST /api/marker-group-tag-sorting` - Bulk update sorting for a marker group
- `DELETE /api/marker-group-tag-sorting?markerGroupId=<id>` - Remove all sorting for a marker group

**Redux State:**

The `markerGroupTagSorting` format in Redux state remains unchanged for backward compatibility:

```typescript
{
  [markerGroupId: string]: string[]  // array of tag IDs in sort order
}
```

Data is loaded from the database on app startup via `loadMarkerGroupTagSorting()` thunk.

---

## Need Help?

If you encounter issues during migration:

1. Check the [GitHub Issues](https://github.com/anthropics/claude-code/issues)
2. Review server logs for detailed error messages
3. Create a new issue with:
   - Migration script output
   - Server logs
   - Your environment (OS, Node version, PostgreSQL version)

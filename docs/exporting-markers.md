# Exporting Markers to Stashapp

## Overview

Implement marker export functionality that syncs markers from our local database to Stashapp. This is a one-way sync operation (local DB → Stashapp) that merges changes by updating existing markers, creating new ones, and deleting markers that are no longer in our database.

## Export Strategy

The export operates on a **per-scene** basis as part of the existing "Complete" workflow:

1. **Fetch** all markers from Stashapp for the scene
2. **Match** Stashapp markers to our local database by `stashappMarkerId`
3. **Classify** operations:
   - **Create**: Markers in our DB without `stashappMarkerId` (new markers)
   - **Update**: Markers in our DB with `stashappMarkerId` (existing markers to sync)
   - **Delete**: Markers in Stashapp that don't have a corresponding entry in our DB (orphaned/incorrect markers)
4. **Preview** the changes to the user (counts: X creates, Y updates, Z deletes)
5. **Execute** the operations after user confirmation
6. **Update** `lastExportedAt` timestamp for all exported markers

## Database Schema Context

### Relevant Fields

```prisma
model Marker {
  id                Int      @id @default(autoincrement())
  stashappMarkerId  Int?     @unique              // NULL = not yet exported
  stashappSceneId   Int
  seconds           Decimal
  endSeconds        Decimal?
  primaryTagId      Int?

  lastSyncedAt      DateTime?  // Import timestamp
  lastExportedAt    DateTime?  // Export timestamp

  markerTags        MarkerTag[]
  derivations       MarkerDerivation[] @relation("source")
  derivedFrom       MarkerDerivation[] @relation("derived")
}

model MarkerTag {
  markerId   Int
  tagId      Int
  isPrimary  Boolean
}
```

## Export Logic Details

### 1. Fetch Local Markers for Scene

Query all markers in our database for the given scene:
- Include all marker tags (primary and secondary)
- Filter to only materialized markers (exclude virtual derived markers that haven't been materialized)
- Include markers without `stashappMarkerId` (new markers to create)
- Include markers with `stashappMarkerId` (existing markers to update)

### 2. Fetch Stashapp Markers for Scene

Use existing `StashappService.getSceneMarkers(sceneId)` to fetch all markers from Stashapp for the scene.

### 3. Match and Classify Operations

```typescript
interface ExportOperation {
  type: 'create' | 'update' | 'delete';
  localMarker?: Marker;        // For create/update
  stashappMarker?: SceneMarker; // For update/delete
}
```

**Create Operations**:
- Markers in local DB where `stashappMarkerId IS NULL`

**Update Operations**:
- Markers in local DB where `stashappMarkerId` matches a Stashapp marker ID
- Always overwrite Stashapp values with local database values

**Delete Operations**:
- Stashapp markers where the marker ID is NOT in the set of `stashappMarkerId` values from our database
- These are considered incorrect/orphaned markers

### 4. Preview and Confirmation

Before executing operations, show the user:
```
Export Preview for Scene "Example Scene":
- 5 markers to create
- 12 markers to update
- 3 markers to delete

Continue? [Yes/No]
```

User must explicitly confirm before any Stashapp modifications occur.

### 5. Execute Operations

Execute in this order to minimize conflicts:

1. **Deletes**: Remove orphaned markers from Stashapp
   - Use `StashappService.deleteMarkers(markerIds)`

2. **Updates**: Update existing markers in Stashapp
   - Use `StashappService.updateMarkerTimes()` for timing changes
   - Use `StashappService.updateMarkerTagAndTitle()` for tag/title changes
   - May need to combine or create a new update method that handles both

3. **Creates**: Create new markers in Stashapp
   - Use `StashappService.createSceneMarker()`
   - After creation, update local database with returned `stashappMarkerId`

### 6. Update Export Timestamps

After successful export of each marker:
- Set `lastExportedAt = now()` in local database
- This tracks when each marker was last synced to Stashapp

## API Endpoint Design

### POST `/api/markers/export`

**Request Body**:
```typescript
{
  sceneId: string;           // Stashapp scene ID
  preview?: boolean;         // If true, only return preview without executing
  force?: boolean;           // Reserved for future conflict handling
}
```

**Response (Preview)**:
```typescript
{
  preview: {
    creates: number;
    updates: number;
    deletes: number;
    operations: ExportOperation[];  // Detailed list for debugging
  }
}
```

**Response (Execution)**:
```typescript
{
  success: true;
  results: {
    created: number;
    updated: number;
    deleted: number;
  };
  errors?: Array<{
    operation: ExportOperation;
    error: string;
  }>;
}
```

## Data Mapping: Local DB → Stashapp

When creating or updating markers in Stashapp:

| Local DB Field | Stashapp Field | Notes |
|----------------|----------------|-------|
| `seconds` | `seconds` | Round to 3 decimal places |
| `endSeconds` | `end_seconds` | Round to 3 decimal places, nullable |
| `primaryTagId` | `primary_tag_id` | From MarkerTag where isPrimary=true |
| `markerTags` | `tag_ids` | All tagId values from MarkerTag |
| _(generated)_ | `title` | Fetch tag name from Stashapp and use as title |

**Not Exported**:
- Performer slots (no representation in Stashapp)
- Derivation relationships (local metadata only)
- `lastSyncedAt`, `lastExportedAt` (local tracking only)

## Error Handling

### Partial Failure Recovery

If some operations fail during execution:
1. Continue processing remaining operations
2. Collect all errors
3. Return partial success with error details
4. Only update `lastExportedAt` for successfully exported markers

### Rollback Considerations

Stashapp GraphQL mutations are individual transactions. If an export batch partially fails:
- **No automatic rollback** (operations already committed to Stashapp)
- User should be informed which operations succeeded/failed
- Can re-run export to sync remaining markers
- Idempotent design: re-running export with same data should be safe

### Common Error Scenarios

1. **Stashapp marker doesn't exist** (deleted externally)
   - Update operation fails
   - Remove `stashappMarkerId` from local DB and retry as create?
   - Or just log error and skip?

2. **Tag ID doesn't exist in Stashapp**
   - Create/update fails
   - Mark marker as failed, require user to fix tags

3. **Network failure mid-export**
   - Partial completion
   - Re-running export should resume from where it left off
   - Use `lastExportedAt` to identify which markers need export

## Integration with Complete Workflow

The export functionality should be integrated into the existing "Complete" button/workflow:

### Current Complete Flow
1. User reviews markers in the scene
2. Confirms/rejects markers with status tags
3. Clicks "Complete" button

### Enhanced Complete Flow
1. User reviews markers in the scene
2. Confirms/rejects markers with status tags
3. Clicks "Complete" button
4. **[NEW]** System generates export preview
5. **[NEW]** User sees preview modal: "Export changes to Stashapp? (X creates, Y updates, Z deletes)"
6. **[NEW]** User confirms or cancels
7. **[NEW]** Export executes and updates are synced to Stashapp
8. User is redirected to scene list or next scene

### UI Considerations

- Add export preview modal/dialog component
- Show operation counts clearly
- Option to "Show details" to expand and see individual operations
- Clear cancel button to abort export
- Progress indicator during export execution
- Success/error notification after completion

## Implementation Phases

### Phase 1: Core Export Logic
1. Create export service/utility function for operation classification
2. Implement operation execution logic
3. Add timestamp tracking (`lastExportedAt`)
4. Create `/api/markers/export` endpoint with preview and execution modes

### Phase 2: StashappService Enhancements
1. Review existing update methods
2. Add bulk update capability if needed
3. Ensure proper error handling and response parsing

### Phase 3: UI Integration
1. Create export preview modal component
2. Add confirmation dialog to Complete workflow
3. Add progress/loading states
4. Add error handling and user feedback

### Phase 4: Testing & Edge Cases
1. Test with scenes containing many markers
2. Test partial failure scenarios
3. Test with markers deleted externally in Stashapp
4. Test re-running export after partial failure
5. Verify timestamp tracking

## Future Enhancements (Not in Initial Implementation)

- **Export filtering**: Allow user to filter which markers to export (e.g., only confirmed markers)
- **Conflict detection**: Compare timestamps between local and Stashapp versions
- **Dry-run mode**: More detailed preview with actual before/after values
- **Batch scene export**: Export markers for multiple scenes at once
- **Selective sync**: Choose which operations to execute (e.g., only creates/updates, skip deletes)
- **Export history/audit log**: Track all export operations over time

## Testing Checklist

- [ ] Export markers for scene with no existing Stashapp markers (all creates)
- [ ] Export markers for scene with existing Stashapp markers (updates)
- [ ] Export with markers deleted from local DB (Stashapp deletions)
- [ ] Export with derived markers (verify they export correctly)
- [ ] Export with markers having multiple tags
- [ ] Export with markers having null endSeconds
- [ ] Export preview mode (no changes made to Stashapp)
- [ ] Export execution mode (changes committed to Stashapp)
- [ ] Verify `lastExportedAt` timestamp updates correctly
- [ ] Handle Stashapp API errors gracefully
- [ ] Handle network failures mid-export
- [ ] Re-export same scene (should show 0 operations if unchanged)
- [ ] Verify `stashappMarkerId` is set after creating new markers

## Open Questions

1. **Stashapp update API**: The current `updateMarkerTimes()` and `updateMarkerTagAndTitle()` methods update different fields separately. Should we create a unified `updateMarker()` method that updates all fields in one GraphQL mutation?

2. **Delete confirmation**: Should deletes have an extra confirmation step since they're destructive? Or is the preview sufficient?

3. **Export on every save**: Should individual marker edits automatically trigger export, or only on explicit "Complete"? (Current plan: only on Complete)

4. **Marker IDs in preview**: Should the preview show marker IDs/titles in the UI, or just counts?

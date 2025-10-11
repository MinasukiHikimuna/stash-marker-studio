import { classifyExportOperations, extractTagIds, getPrimaryTagId } from './markerExport';
import { Marker, MarkerAdditionalTag } from '@prisma/client';
import { SceneMarker } from './StashappService';
import { Decimal } from '@prisma/client/runtime/library';

describe('markerExport', () => {
  describe('classifyExportOperations', () => {
    it('should identify markers to create when they have no stashappMarkerId', () => {
      const localMarkers: (Marker & { additionalTags: MarkerAdditionalTag[] })[] = [
        {
          id: 1,
          stashappMarkerId: null,
          stashappSceneId: 100,
          seconds: new Decimal(10.5),
          endSeconds: new Decimal(15.5),
          primaryTagId: 1,
          lastSyncedAt: null,
          lastExportedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalTags: [
            {
              id: 1,
              markerId: 1,
              tagId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      const stashappMarkers: SceneMarker[] = [];

      const result = classifyExportOperations(localMarkers, stashappMarkers);

      expect(result.creates).toBe(1);
      expect(result.updates).toBe(0);
      expect(result.deletes).toBe(0);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('create');
      expect(result.operations[0].localMarker).toBe(localMarkers[0]);
    });

    it('should identify markers to update when they exist in both places', () => {
      const localMarkers: (Marker & { additionalTags: MarkerAdditionalTag[] })[] = [
        {
          id: 1,
          stashappMarkerId: 500,
          stashappSceneId: 100,
          seconds: new Decimal(10.5),
          endSeconds: new Decimal(15.5),
          primaryTagId: 1,
          lastSyncedAt: null,
          lastExportedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalTags: [
            {
              id: 1,
              markerId: 1,
              tagId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      const stashappMarkers: SceneMarker[] = [
        {
          id: '500',
          title: 'Test Marker',
          seconds: 10.5,
          end_seconds: 15.5,
          stream: '',
          preview: '',
          screenshot: '',
          scene: { id: '100', title: 'Test Scene' },
          primary_tag: { id: '1', name: 'Test Tag' },
          tags: [],
        },
      ];

      const result = classifyExportOperations(localMarkers, stashappMarkers);

      expect(result.creates).toBe(0);
      expect(result.updates).toBe(1);
      expect(result.deletes).toBe(0);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('update');
      expect(result.operations[0].localMarker).toBe(localMarkers[0]);
      expect(result.operations[0].stashappMarker).toBe(stashappMarkers[0]);
    });

    it('should identify markers to delete when they exist in Stashapp but not locally', () => {
      const localMarkers: (Marker & { additionalTags: MarkerAdditionalTag[] })[] = [];

      const stashappMarkers: SceneMarker[] = [
        {
          id: '500',
          title: 'Orphaned Marker',
          seconds: 10.5,
          end_seconds: 15.5,
          stream: '',
          preview: '',
          screenshot: '',
          scene: { id: '100', title: 'Test Scene' },
          primary_tag: { id: '1', name: 'Test Tag' },
          tags: [],
        },
      ];

      const result = classifyExportOperations(localMarkers, stashappMarkers);

      expect(result.creates).toBe(0);
      expect(result.updates).toBe(0);
      expect(result.deletes).toBe(1);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('delete');
      expect(result.operations[0].stashappMarker).toBe(stashappMarkers[0]);
    });

    it('should handle complex scenarios with creates, updates, and deletes', () => {
      const localMarkers: (Marker & { additionalTags: MarkerAdditionalTag[] })[] = [
        // Marker to create (no stashappMarkerId)
        {
          id: 1,
          stashappMarkerId: null,
          stashappSceneId: 100,
          seconds: new Decimal(5.0),
          endSeconds: new Decimal(10.0),
          primaryTagId: 1,
          lastSyncedAt: null,
          lastExportedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalTags: [
            {
              id: 1,
              markerId: 1,
              tagId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        // Marker to update (has stashappMarkerId)
        {
          id: 2,
          stashappMarkerId: 500,
          stashappSceneId: 100,
          seconds: new Decimal(15.0),
          endSeconds: new Decimal(20.0),
          primaryTagId: 2,
          lastSyncedAt: null,
          lastExportedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          additionalTags: [
            {
              id: 2,
              markerId: 2,
              tagId: 2,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ];

      const stashappMarkers: SceneMarker[] = [
        // Marker that matches local marker (update)
        {
          id: '500',
          title: 'Marker to Update',
          seconds: 15.0,
          end_seconds: 20.0,
          stream: '',
          preview: '',
          screenshot: '',
          scene: { id: '100', title: 'Test Scene' },
          primary_tag: { id: '2', name: 'Tag 2' },
          tags: [],
        },
        // Orphaned marker (delete)
        {
          id: '600',
          title: 'Orphaned Marker',
          seconds: 25.0,
          end_seconds: 30.0,
          stream: '',
          preview: '',
          screenshot: '',
          scene: { id: '100', title: 'Test Scene' },
          primary_tag: { id: '3', name: 'Tag 3' },
          tags: [],
        },
      ];

      const result = classifyExportOperations(localMarkers, stashappMarkers);

      expect(result.creates).toBe(1);
      expect(result.updates).toBe(1);
      expect(result.deletes).toBe(1);
      expect(result.operations).toHaveLength(3);

      const createOps = result.operations.filter(op => op.type === 'create');
      const updateOps = result.operations.filter(op => op.type === 'update');
      const deleteOps = result.operations.filter(op => op.type === 'delete');

      expect(createOps).toHaveLength(1);
      expect(createOps[0].localMarker?.id).toBe(1);

      expect(updateOps).toHaveLength(1);
      expect(updateOps[0].localMarker?.id).toBe(2);
      expect(updateOps[0].stashappMarker?.id).toBe('500');

      expect(deleteOps).toHaveLength(1);
      expect(deleteOps[0].stashappMarker?.id).toBe('600');
    });
  });

  describe('extractTagIds', () => {
    it('should extract tag IDs with primary tag first', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 3,
          markerId: 1,
          tagId: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = extractTagIds(additionalTags, 20);

      expect(result).toEqual(['20', '10', '30']);
      expect(result[0]).toBe('20'); // Primary tag first
    });
  });

  describe('getPrimaryTagId', () => {
    it('should return the primary tag ID from primaryTagId parameter', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = getPrimaryTagId(additionalTags, 20);

      expect(result).toBe('20');
    });

    it('should return null if no primary tag exists', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = getPrimaryTagId(additionalTags);

      expect(result).toBeNull();
    });

    it('should use primaryTagId parameter', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = getPrimaryTagId(additionalTags, 5566);

      expect(result).toBe('5566');
    });
  });

  describe('extractTagIds with primary tag', () => {
    it('should include primaryTagId first', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 7879,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = extractTagIds(additionalTags, 5566);

      expect(result).toEqual(['5566', '7879']);
      expect(result[0]).toBe('5566'); // Primary tag first
    });

    it('should work when primary tag is one of the additional tags', () => {
      const additionalTags: MarkerAdditionalTag[] = [
        {
          id: 1,
          markerId: 1,
          tagId: 5566,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          markerId: 1,
          tagId: 7879,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = extractTagIds(additionalTags, 5566);

      // Primary tag first, then additional tags (including duplicate 5566)
      expect(result).toEqual(['5566', '5566', '7879']);
    });
  });
});

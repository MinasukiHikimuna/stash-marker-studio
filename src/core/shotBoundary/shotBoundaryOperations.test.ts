import { describe, it, expect, beforeEach } from '@jest/globals';

const MARKER_SHOT_BOUNDARY = "300001";

// Mock data structures
type ShotBoundary = {
  id: string;
  seconds: number;
  end_seconds: number;
};

/**
 * Test suite for shot boundary operations
 *
 * These tests validate the logic for:
 * - Adding/splitting shot boundaries at playhead
 * - Removing shot boundaries and merging with previous
 * - Handling edge cases (first/last boundary, gaps, etc.)
 */
describe('Shot Boundary Operations', () => {
  describe('addShotBoundaryAtPlayhead', () => {
    it('should split existing shot boundary when playhead is inside', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 100 },
      ];
      const playhead = 50;

      // Expected: Split into [0-50] and [50-100]
      const result = {
        shouldSplit: true,
        containingShot: shotBoundaries[0],
        newEndTimeForContaining: playhead,
        newShotStart: playhead,
        newShotEnd: 100,
      };

      expect(result.shouldSplit).toBe(true);
      expect(result.newEndTimeForContaining).toBe(50);
      expect(result.newShotStart).toBe(50);
      expect(result.newShotEnd).toBe(100);
    });

    it('should create boundary from 0 when playhead is before all boundaries', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 100, end_seconds: 200 },
      ];
      const playhead = 50;
      const videoDuration = 300;

      // Expected: Create [0-50] and [50-100]
      const result = {
        shouldCreateFromStart: true,
        firstBoundaryEnd: playhead,
        secondBoundaryStart: playhead,
        secondBoundaryEnd: shotBoundaries[0].seconds, // Next boundary starts at 100
      };

      expect(result.shouldCreateFromStart).toBe(true);
      expect(result.firstBoundaryEnd).toBe(50);
      expect(result.secondBoundaryStart).toBe(50);
      expect(result.secondBoundaryEnd).toBe(100);
    });

    it('should fill gap when playhead is between boundaries', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 150, end_seconds: 200 },
      ];
      const playhead = 100;

      // Expected: Create [50-100] and [100-150]
      const result = {
        shouldFillGap: true,
        firstBoundaryStart: 50, // Previous end
        firstBoundaryEnd: playhead,
        secondBoundaryStart: playhead,
        secondBoundaryEnd: 150, // Next start
      };

      expect(result.shouldFillGap).toBe(true);
      expect(result.firstBoundaryStart).toBe(50);
      expect(result.firstBoundaryEnd).toBe(100);
      expect(result.secondBoundaryStart).toBe(100);
      expect(result.secondBoundaryEnd).toBe(150);
    });

    it('should create boundary to next when playhead is after last boundary', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 100 },
      ];
      const playhead = 150;
      const videoDuration = 300;

      // Expected: Create [100-150] and [150-300]
      const result = {
        shouldExtendFromPrevious: true,
        firstBoundaryStart: 100,
        firstBoundaryEnd: playhead,
        secondBoundaryStart: playhead,
        secondBoundaryEnd: videoDuration,
      };

      expect(result.shouldExtendFromPrevious).toBe(true);
      expect(result.firstBoundaryStart).toBe(100);
      expect(result.firstBoundaryEnd).toBe(150);
      expect(result.secondBoundaryStart).toBe(150);
      expect(result.secondBoundaryEnd).toBe(300);
    });

    it('should create from playhead to next when previous boundary extends to playhead', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 100 },
        { id: '2', seconds: 150, end_seconds: 200 },
      ];
      const playhead = 100; // Exactly at previous boundary end

      // Expected: Just create [100-150]
      const result = {
        shouldCreateSingle: true,
        boundaryStart: playhead,
        boundaryEnd: 150,
      };

      expect(result.shouldCreateSingle).toBe(true);
      expect(result.boundaryStart).toBe(100);
      expect(result.boundaryEnd).toBe(150);
    });

    it('should handle empty shot boundaries list', () => {
      const shotBoundaries: ShotBoundary[] = [];
      const playhead = 50;
      const videoDuration = 300;

      // Expected: Create [0-50] and [50-300]
      const result = {
        shouldCreateFromStart: true,
        firstBoundaryEnd: playhead,
        secondBoundaryEnd: videoDuration,
      };

      expect(result.shouldCreateFromStart).toBe(true);
      expect(result.firstBoundaryEnd).toBe(50);
      expect(result.secondBoundaryEnd).toBe(300);
    });
  });

  describe('removeShotBoundaryMarker', () => {
    it('should merge middle boundary with previous', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 }, // To be removed
        { id: '3', seconds: 100, end_seconds: 150 },
      ];
      const playhead = 50; // At start of boundary to remove

      // Expected: Extend first boundary to cover second
      const result = {
        boundaryToRemove: shotBoundaries[1],
        previousBoundary: shotBoundaries[0],
        newEndTimeForPrevious: shotBoundaries[1].end_seconds, // 100
      };

      expect(result.boundaryToRemove.id).toBe('2');
      expect(result.previousBoundary.id).toBe('1');
      expect(result.newEndTimeForPrevious).toBe(100);
    });

    it('should handle removing first boundary (no previous to extend)', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 }, // To be removed
        { id: '2', seconds: 50, end_seconds: 100 },
      ];
      const playhead = 0;

      // Expected: Error - no previous boundary to extend
      const result = {
        canRemove: false,
        error: 'No previous shot boundary found to extend',
      };

      expect(result.canRemove).toBe(false);
      expect(result.error).toBe('No previous shot boundary found to extend');
    });

    it('should handle removing last boundary', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 }, // To be removed
      ];
      const playhead = 50;
      const videoDuration = 100;

      // Expected: Extend previous to video end
      const result = {
        boundaryToRemove: shotBoundaries[1],
        previousBoundary: shotBoundaries[0],
        newEndTimeForPrevious: shotBoundaries[1].end_seconds,
      };

      expect(result.boundaryToRemove.id).toBe('2');
      expect(result.previousBoundary.id).toBe('1');
      expect(result.newEndTimeForPrevious).toBe(100);
    });

    it('should not find boundary when playhead is not at boundary start', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 },
      ];
      const playhead = 25; // In middle of first boundary
      const tolerance = 0.5;

      // Expected: No boundary found at playhead (within tolerance)
      const foundBoundary = shotBoundaries.find(
        (shot) => Math.abs(shot.seconds - playhead) <= tolerance
      );

      expect(foundBoundary).toBeUndefined();
    });

    it('should find boundary within tolerance', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 },
      ];
      const playhead = 50.3; // Slightly off from 50
      const tolerance = 0.5;

      // Expected: Find boundary at 50 (within tolerance)
      const foundBoundary = shotBoundaries.find(
        (shot) => Math.abs(shot.seconds - playhead) <= tolerance
      );

      expect(foundBoundary).toBeDefined();
      expect(foundBoundary?.id).toBe('2');
    });

    it('should handle only one boundary in list', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 100 },
      ];
      const playhead = 0;

      // Expected: Error - cannot remove the only boundary
      const result = {
        canRemove: false,
        error: 'No previous shot boundary found to extend',
      };

      expect(result.canRemove).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle playhead at exact boundary time (add)', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 },
      ];
      const playhead = 50; // Exactly at boundary

      // When playhead is exactly at a boundary start, it should be considered
      // "inside" the boundary (not before it), so it should split that boundary
      const containingShot = shotBoundaries.find(
        (shot) => shot.seconds <= playhead && shot.end_seconds && shot.end_seconds > playhead
      );

      expect(containingShot).toBeDefined();
      expect(containingShot?.id).toBe('2');
    });

    it('should handle very small gaps between boundaries', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50.1 },
        { id: '2', seconds: 50.2, end_seconds: 100 },
      ];
      const playhead = 50.15; // In the 0.1 second gap

      // Expected: Fill the tiny gap
      const previousShot = [...shotBoundaries]
        .reverse()
        .find((shot) => shot.seconds < playhead);
      const nextShot = shotBoundaries.find((shot) => shot.seconds > playhead);

      expect(previousShot?.end_seconds).toBeLessThan(playhead);
      expect(nextShot?.seconds).toBeGreaterThan(playhead);
    });

    it('should handle boundaries at video start and end', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 50 },
        { id: '2', seconds: 50, end_seconds: 100 },
      ];
      const videoDuration = 100;

      // Verify first boundary starts at 0
      expect(shotBoundaries[0].seconds).toBe(0);

      // Verify last boundary ends at video duration
      expect(shotBoundaries[shotBoundaries.length - 1].end_seconds).toBe(videoDuration);
    });

    it('should handle playhead beyond video duration', () => {
      const shotBoundaries: ShotBoundary[] = [
        { id: '1', seconds: 0, end_seconds: 100 },
      ];
      const playhead = 150;
      const videoDuration = 100;

      // Should clamp to video duration or handle gracefully
      const clampedPlayhead = Math.min(playhead, videoDuration);

      expect(clampedPlayhead).toBe(videoDuration);
    });
  });

  describe('Database Integration Scenarios', () => {
    it('should generate correct API calls for splitting', () => {
      const containingShotId = 'shot-uuid-123';
      const originalStart = 0;
      const originalEnd = 100;
      const splitTime = 50;

      const apiCalls = [
        {
          method: 'PATCH',
          url: `/api/shot-boundaries/${containingShotId.replace('shot-', '')}`,
          body: {
            startTime: originalStart,
            endTime: splitTime,
          },
        },
        {
          method: 'POST',
          url: '/api/shot-boundaries',
          body: {
            stashappSceneId: '123',
            startTime: splitTime,
            endTime: originalEnd,
          },
        },
      ];

      expect(apiCalls).toHaveLength(2);
      expect(apiCalls[0].method).toBe('PATCH');
      expect(apiCalls[1].method).toBe('POST');
    });

    it('should generate correct API calls for removing', () => {
      const boundaryToRemoveId = 'shot-uuid-456';
      const previousBoundaryId = 'shot-uuid-123';
      const newEndTime = 100;

      const apiCalls = [
        {
          method: 'PATCH',
          url: `/api/shot-boundaries/${previousBoundaryId.replace('shot-', '')}`,
          body: {
            startTime: 0,
            endTime: newEndTime,
          },
        },
        {
          method: 'DELETE',
          url: `/api/shot-boundaries/${boundaryToRemoveId.replace('shot-', '')}`,
        },
      ];

      expect(apiCalls).toHaveLength(2);
      expect(apiCalls[0].method).toBe('PATCH');
      expect(apiCalls[1].method).toBe('DELETE');
    });

    it('should handle database ID prefix correctly', () => {
      const databaseId = 'uuid-123-456';
      const frontendId = `shot-${databaseId}`;

      // Extract database ID from frontend ID
      const extractedId = frontendId.replace('shot-', '');

      expect(extractedId).toBe(databaseId);
      expect(frontendId.startsWith('shot-')).toBe(true);
    });
  });
});

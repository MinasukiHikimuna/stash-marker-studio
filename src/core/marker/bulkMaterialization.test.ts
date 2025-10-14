import { analyzeMaterializableMarkers } from './bulkMaterialization';
import type { DerivedMarkerConfig } from '@/serverConfig';
import type { SceneMarker } from '@/services/StashappService';

describe('analyzeMaterializableMarkers', () => {
  const createMarker = (
    id: string,
    primaryTagId: string,
    primaryTagName: string,
    seconds: number = 10.0
  ): SceneMarker => ({
    id,
    seconds,
    end_seconds: seconds + 20,
    primary_tag: {
      id: primaryTagId,
      name: primaryTagName,
    },
    tags: [],
    slots: [],
    scene: { id: '1', title: 'Test Scene' },
    title: '',
    stream: '',
    preview: '',
    screenshot: '',
  });

  const createDerivedMarkerConfig = (
    sourceTagId: string,
    derivedTagId: string
  ): DerivedMarkerConfig => ({
    sourceTagId,
    derivedTagId,
    relationshipType: 'implies',
    slotMapping: [],
  });

  const createTagNameMap = (entries: Array<[string, string]>): Map<string, string> => {
    return new Map(entries);
  };

  it('should identify markers with new derivations as materializable', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // Blowjob -> Oral Sex
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      ['200', 'Oral Sex'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0]).toEqual({
      markerId: '1',
      markerTag: 'Blowjob',
      markerTime: '10.0s',
      newDerivationsCount: 1,
      totalDerivationsCount: 1,
      derivedTags: ['Oral Sex'],
    });
    expect(result.alreadyMaterializedMarkers).toHaveLength(0);
    expect(result.skippedMarkers).toHaveLength(0);
  });

  it('should identify markers with all existing derivations as already materialized', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // Blowjob -> Oral Sex
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>([
      ['1', new Set(['100->200'])],
    ]);
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      ['200', 'Oral Sex'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(0);
    expect(result.alreadyMaterializedMarkers).toHaveLength(1);
    expect(result.alreadyMaterializedMarkers[0]).toEqual({
      markerId: '1',
      markerTag: 'Blowjob',
      markerTime: '10.0s',
      existingDerivationsCount: 1,
    });
    expect(result.skippedMarkers).toHaveLength(0);
  });

  it('should skip markers with no derivation rules', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob'),
      createMarker('2', '999', 'Unknown Tag'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // Blowjob -> Oral Sex
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      ['200', 'Oral Sex'],
      ['999', 'Unknown Tag'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].markerId).toBe('1');
    expect(result.skippedMarkers).toHaveLength(1);
    expect(result.skippedMarkers[0]).toEqual({
      markerId: '2',
      markerTag: 'Unknown Tag',
      markerTime: '10.0s',
      reason: 'No derivation rules configured',
    });
  });

  it('should handle markers with partial existing derivations', () => {
    const markers = [
      createMarker('1', '100', 'Reverse Cowgirl (DP)'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // -> Reverse Cowgirl
      createDerivedMarkerConfig('200', '300'), // -> Vaginal Sex
      createDerivedMarkerConfig('300', '400'), // -> Vaginal Penetration
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>([
      ['1', new Set(['100->200'])], // Only first derivation exists
    ]);
    const tagNameMap = createTagNameMap([
      ['100', 'Reverse Cowgirl (DP)'],
      ['200', 'Reverse Cowgirl'],
      ['300', 'Vaginal Sex'],
      ['400', 'Vaginal Penetration'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].markerId).toBe('1');
    expect(result.materializableMarkers[0].newDerivationsCount).toBe(2);
    expect(result.materializableMarkers[0].totalDerivationsCount).toBe(3);
    expect(result.materializableMarkers[0].derivedTags).toEqual(['Vaginal Sex', 'Vaginal Penetration']);
  });

  it('should handle multi-level derivation chains', () => {
    const markers = [
      createMarker('1', '100', 'Reverse Cowgirl (DP)'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // -> Reverse Cowgirl
      createDerivedMarkerConfig('200', '300'), // -> Vaginal Sex
      createDerivedMarkerConfig('300', '400'), // -> Vaginal Penetration
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Reverse Cowgirl (DP)'],
      ['200', 'Reverse Cowgirl'],
      ['300', 'Vaginal Sex'],
      ['400', 'Vaginal Penetration'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].newDerivationsCount).toBe(3);
    expect(result.materializableMarkers[0].derivedTags).toEqual([
      'Reverse Cowgirl',
      'Vaginal Sex',
      'Vaginal Penetration',
    ]);
  });

  it('should handle multiple markers with mixed states', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob', 10.0),
      createMarker('2', '200', 'Cunnilingus', 30.0),
      createMarker('3', '999', 'Unknown', 50.0),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '300'), // Blowjob -> Oral Sex
      createDerivedMarkerConfig('200', '300'), // Cunnilingus -> Oral Sex
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>([
      ['1', new Set(['100->300'])], // Already materialized
    ]);
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      ['200', 'Cunnilingus'],
      ['300', 'Oral Sex'],
      ['999', 'Unknown'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].markerId).toBe('2');
    expect(result.alreadyMaterializedMarkers).toHaveLength(1);
    expect(result.alreadyMaterializedMarkers[0].markerId).toBe('1');
    expect(result.skippedMarkers).toHaveLength(1);
    expect(result.skippedMarkers[0].markerId).toBe('3');
  });

  it('should handle empty markers array', () => {
    const markers: SceneMarker[] = [];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'),
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(0);
    expect(result.alreadyMaterializedMarkers).toHaveLength(0);
    expect(result.skippedMarkers).toHaveLength(0);
  });

  it('should handle empty derivation configs', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob'),
      createMarker('2', '200', 'Cunnilingus'),
    ];
    const derivedMarkerConfigs: DerivedMarkerConfig[] = [];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      ['200', 'Cunnilingus'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(0);
    expect(result.alreadyMaterializedMarkers).toHaveLength(0);
    expect(result.skippedMarkers).toHaveLength(2);
    expect(result.skippedMarkers.every(m => m.reason === 'No derivation rules configured')).toBe(true);
  });

  it('should deduplicate derived tag names when multiple derivations lead to same tag', () => {
    const markers = [
      createMarker('1', '100', 'Source Tag'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // -> Derived Tag
      createDerivedMarkerConfig('100', '200'), // -> Same Derived Tag (duplicate rule)
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Source Tag'],
      ['200', 'Derived Tag'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    // Should only show "Derived Tag" once despite duplicate rules
    expect(result.materializableMarkers[0].derivedTags).toEqual(['Derived Tag']);
  });

  it('should handle missing tag names gracefully', () => {
    const markers = [
      createMarker('1', '100', 'Blowjob'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '999'), // Tag 999 not in tagNameMap
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Blowjob'],
      // Tag 999 intentionally missing
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    // Should use fallback tag name format
    expect(result.materializableMarkers[0].derivedTags).toEqual(['Tag 999']);
  });

  it('should respect maxDerivationDepth limit', () => {
    const markers = [
      createMarker('1', '100', 'Level 0'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // Level 0 -> Level 1
      createDerivedMarkerConfig('200', '300'), // Level 1 -> Level 2
      createDerivedMarkerConfig('300', '400'), // Level 2 -> Level 3
      createDerivedMarkerConfig('400', '500'), // Level 3 -> Level 4 (should be skipped with max depth 2)
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Level 0'],
      ['200', 'Level 1'],
      ['300', 'Level 2'],
      ['400', 'Level 3'],
      ['500', 'Level 4'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      2, // maxDerivationDepth = 2
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    // Should only have derivations up to depth 2 (3 total: depths 0, 1, 2)
    expect(result.materializableMarkers[0].newDerivationsCount).toBe(3);
    expect(result.materializableMarkers[0].derivedTags).toEqual(['Level 1', 'Level 2', 'Level 3']);
    expect(result.materializableMarkers[0].derivedTags).not.toContain('Level 4');
  });

  it('should format marker time correctly with one decimal place', () => {
    const markers = [
      createMarker('1', '100', 'Tag', 123.456),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'),
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Tag'],
      ['200', 'Derived'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers[0].markerTime).toBe('123.5s');
  });

  it('should handle branching derivations (one source to multiple derived)', () => {
    const markers = [
      createMarker('1', '100', 'Reverse Cowgirl (DP)'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // -> Reverse Cowgirl
      createDerivedMarkerConfig('100', '201'), // -> Anal Reverse Cowgirl (branch)
      createDerivedMarkerConfig('200', '300'), // -> Vaginal Sex
      createDerivedMarkerConfig('201', '301'), // -> Anal Sex
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    const tagNameMap = createTagNameMap([
      ['100', 'Reverse Cowgirl (DP)'],
      ['200', 'Reverse Cowgirl'],
      ['201', 'Anal Reverse Cowgirl'],
      ['300', 'Vaginal Sex'],
      ['301', 'Anal Sex'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].newDerivationsCount).toBe(4);
    expect(result.materializableMarkers[0].derivedTags).toContain('Reverse Cowgirl');
    expect(result.materializableMarkers[0].derivedTags).toContain('Anal Reverse Cowgirl');
    expect(result.materializableMarkers[0].derivedTags).toContain('Vaginal Sex');
    expect(result.materializableMarkers[0].derivedTags).toContain('Anal Sex');
  });

  it('should handle scenario where some branches are already materialized', () => {
    const markers = [
      createMarker('1', '100', 'Reverse Cowgirl (DP)'),
    ];
    const derivedMarkerConfigs = [
      createDerivedMarkerConfig('100', '200'), // -> Reverse Cowgirl
      createDerivedMarkerConfig('100', '201'), // -> Anal Reverse Cowgirl
    ];
    const existingDerivationsByMarker = new Map<string, Set<string>>([
      ['1', new Set(['100->200'])], // Only first branch exists
    ]);
    const tagNameMap = createTagNameMap([
      ['100', 'Reverse Cowgirl (DP)'],
      ['200', 'Reverse Cowgirl'],
      ['201', 'Anal Reverse Cowgirl'],
    ]);

    const result = analyzeMaterializableMarkers(
      markers,
      derivedMarkerConfigs,
      3,
      existingDerivationsByMarker,
      tagNameMap
    );

    expect(result.materializableMarkers).toHaveLength(1);
    expect(result.materializableMarkers[0].newDerivationsCount).toBe(1);
    expect(result.materializableMarkers[0].totalDerivationsCount).toBe(2);
    expect(result.materializableMarkers[0].derivedTags).toEqual(['Anal Reverse Cowgirl']);
  });
});

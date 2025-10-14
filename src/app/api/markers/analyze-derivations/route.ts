import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { type AppConfig } from '@/serverConfig';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeMaterializableMarkers } from '@/core/marker/bulkMaterialization';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'app-config.json');

async function loadConfig(): Promise<AppConfig> {
  const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(configData) as AppConfig;
}

// Analyze which markers can be materialized
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: 'sceneId is required' },
        { status: 400 }
      );
    }

    const sceneIdNum = parseInt(sceneId);
    if (isNaN(sceneIdNum)) {
      return NextResponse.json(
        { error: 'Invalid sceneId' },
        { status: 400 }
      );
    }

    // Load configuration
    const config = await loadConfig();
    const derivedMarkerConfigs = config.derivedMarkers || [];
    const maxDerivationDepth = config.maxDerivationDepth || 3;

    // Load markers from database with their existing derivations
    // Only include non-derived markers (source markers)
    const dbMarkers = await prisma.marker.findMany({
      where: { stashappSceneId: sceneIdNum },
      include: {
        additionalTags: true,
        markerSlots: {
          include: {
            slotDefinition: {
              include: {
                genderHints: true,
              },
            },
          },
        },
        derivations: {
          select: {
            ruleId: true,
          },
        },
        derivedFrom: true,
      },
    });

    // Filter out derived markers - only analyze source markers
    const sourceMarkers = dbMarkers.filter(
      marker => !marker.derivedFrom || marker.derivedFrom.length === 0
    );

    if (sourceMarkers.length === 0) {
      return NextResponse.json({
        materializableMarkers: [],
        alreadyMaterializedMarkers: [],
        skippedMarkers: [],
      });
    }

    // Fetch tags from local database cache (stash_tags table)
    const dbTags = await prisma.stashTag.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Create tag name map
    const tagNameMap = new Map<string, string>();
    for (const tag of dbTags) {
      tagNameMap.set(tag.id.toString(), tag.name);
    }

    // Build existingDerivationsByMarker map (only for source markers)
    const existingDerivationsByMarker = new Map<string, Set<string>>();
    for (const dbMarker of sourceMarkers) {
      const ruleIds = new Set<string>();
      for (const derivation of dbMarker.derivations) {
        ruleIds.add(derivation.ruleId);
      }
      existingDerivationsByMarker.set(dbMarker.id.toString(), ruleIds);
    }

    // Convert database markers to SceneMarker format (only source markers)
    const sceneMarkers = sourceMarkers.map(dbMarker => ({
      id: dbMarker.id.toString(),
      seconds: parseFloat(dbMarker.seconds.toString()),
      end_seconds: dbMarker.endSeconds ? parseFloat(dbMarker.endSeconds.toString()) : undefined,
      primary_tag: {
        id: dbMarker.primaryTagId?.toString() || '',
        name: tagNameMap.get(dbMarker.primaryTagId?.toString() || '') || 'Unknown',
      },
      tags: dbMarker.additionalTags.map(at => ({
        id: at.tagId.toString(),
        name: tagNameMap.get(at.tagId.toString()) || 'Unknown',
      })),
      slots: dbMarker.markerSlots.map(slot => ({
        id: slot.id,
        slotDefinitionId: slot.slotDefinitionId,
        stashappPerformerId: slot.stashappPerformerId,
        slotLabel: slot.slotDefinition.slotLabel,
        genderHints: slot.slotDefinition.genderHints.map(gh => gh.genderHint),
        order: slot.slotDefinition.order,
      })),
      scene: { id: sceneIdNum.toString(), title: '' },
      title: '',
      stream: '',
      preview: '',
      screenshot: '',
    }));

    // Analyze markers
    const result = analyzeMaterializableMarkers(
      sceneMarkers,
      derivedMarkerConfigs,
      maxDerivationDepth,
      existingDerivationsByMarker,
      tagNameMap
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error analyzing derivations:', error);
    return NextResponse.json(
      { error: 'Failed to analyze derivations' },
      { status: 500 }
    );
  }
}

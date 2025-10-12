import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import { type AppConfig } from "@/serverConfig";

async function loadConfig(): Promise<AppConfig | null> {
  try {
    const configPath = path.join(process.cwd(), "app-config.json");
    const configData = await fs.readFile(configPath, "utf-8");
    return JSON.parse(configData) as AppConfig;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const includedTagIds = searchParams.get("includedTagIds")?.split(",").filter(Boolean).map(Number) || [];
    const excludedTagIds = searchParams.get("excludedTagIds")?.split(",").filter(Boolean).map(Number) || [];
    const sortField = searchParams.get("sortField") || "title";
    const sortDirection = (searchParams.get("sortDirection") || "ASC") as "ASC" | "DESC";

    // Marker filters
    const markerFilter = searchParams.get("markerFilter"); // "none", "has_unconfirmed", "all"

    // Load config to get status tag IDs
    const config = await loadConfig();
    const statusConfirmedId = config ? parseInt(config.markerConfig.statusConfirmed) : null;
    const statusRejectedId = config ? parseInt(config.markerConfig.statusRejected) : null;

    // Build WHERE clause
    const whereConditions: any[] = [
      // Text search on title
      query ? {
        title: {
          contains: query,
          mode: 'insensitive' as Prisma.QueryMode,
        }
      } : {},

      // Included tags (must have ALL)
      ...includedTagIds.map(tagId => ({
        tags: {
          some: {
            tagId,
          }
        }
      })),

      // Excluded tags (must have NONE)
      ...excludedTagIds.map(tagId => ({
        tags: {
          none: {
            tagId,
          }
        }
      })),
    ];

    // Add marker-based filters using raw SQL subqueries
    if (markerFilter === "none") {
      // Scenes with no markers at all
      whereConditions.push({
        id: {
          notIn: await prisma.$queryRaw<Array<{ stashapp_scene_id: number }>>`
            SELECT DISTINCT stashapp_scene_id FROM markers
          `.then(rows => rows.map(r => r.stashapp_scene_id))
        }
      });
    } else if (markerFilter === "has_unconfirmed" && statusConfirmedId && statusRejectedId) {
      // Scenes that have at least one marker that is NOT confirmed or rejected
      const scenesWithUnconfirmedMarkers = await prisma.$queryRaw<Array<{ stashapp_scene_id: number }>>`
        SELECT DISTINCT m.stashapp_scene_id
        FROM markers m
        WHERE m.id NOT IN (
          -- Exclude markers that have confirmed tag
          SELECT marker_id FROM marker_additional_tags WHERE tag_id = ${statusConfirmedId}
          UNION
          SELECT id FROM markers WHERE primary_tag_id = ${statusConfirmedId}
        )
        AND m.id NOT IN (
          -- Exclude markers that have rejected tag
          SELECT marker_id FROM marker_additional_tags WHERE tag_id = ${statusRejectedId}
          UNION
          SELECT id FROM markers WHERE primary_tag_id = ${statusRejectedId}
        )
      `;

      if (scenesWithUnconfirmedMarkers.length > 0) {
        whereConditions.push({
          id: {
            in: scenesWithUnconfirmedMarkers.map(r => r.stashapp_scene_id)
          }
        });
      } else {
        // No scenes match, return empty set
        whereConditions.push({ id: -1 });
      }
    }

    const where: Prisma.StashSceneWhereInput = {
      AND: whereConditions,
    };

    // Build ORDER BY clause - map Stashapp field names to database field names
    let orderBy: Prisma.StashSceneOrderByWithRelationInput = {};

    // Map Stashapp sort fields to database fields
    const fieldMapping: Record<string, string> = {
      'title': 'title',
      'date': 'date',
      'created_at': 'stashUpdatedAt', // Use stashUpdatedAt as proxy
      'updated_at': 'stashUpdatedAt',
      'filesize': 'filesize',
      'duration': 'duration',
      'id': 'id',
    };

    const dbField = fieldMapping[sortField] || 'title';
    orderBy = { [dbField]: sortDirection.toLowerCase() };

    // Query scenes with related data
    const scenes = await prisma.stashScene.findMany({
      where,
      orderBy,
      take: 100, // Limit results
      include: {
        performers: {
          include: {
            performer: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Get scene IDs to fetch markers
    const sceneIds = scenes.map(s => s.id);

    // Fetch markers for all scenes with their tags
    const markers = await prisma.marker.findMany({
      where: {
        stashappSceneId: { in: sceneIds },
      },
      include: {
        additionalTags: true,
      },
    });

    // Group markers by scene ID
    const markersByScene = markers.reduce((acc, marker) => {
      const sceneId = marker.stashappSceneId;
      if (!acc[sceneId]) acc[sceneId] = [];

      // Build tag IDs array (primary tag + additional tags)
      const tagIds = [
        ...(marker.primaryTagId ? [marker.primaryTagId.toString()] : []),
        ...marker.additionalTags.map(at => at.tagId.toString()),
      ];

      acc[sceneId].push({
        id: marker.id.toString(),
        title: "", // We don't store title in local markers
        seconds: parseFloat(marker.seconds.toString()),
        end_seconds: marker.endSeconds ? parseFloat(marker.endSeconds.toString()) : undefined,
        primary_tag: {
          id: marker.primaryTagId?.toString() || "",
          name: "", // We don't have tag names here, but they're not needed for status calculation
        },
        tags: tagIds.map(id => ({ id, name: "" })), // Just IDs needed for status calculation
      });

      return acc;
    }, {} as Record<number, any[]>);

    // Transform database format to Stashapp format
    const transformedScenes = scenes.map(scene => ({
      id: scene.id.toString(),
      title: scene.title || "Untitled",
      date: scene.date?.toISOString().split('T')[0] || null,
      details: scene.details || null,
      files: scene.filesize ? [{
        size: scene.filesize.toString(),
        duration: scene.duration ? parseFloat(scene.duration.toString()) : null,
      }] : [],
      paths: {
        screenshot: `/scene/${scene.id}/screenshot`, // Stashapp path format
      },
      performers: scene.performers.map(sp => ({
        id: sp.performer.id.toString(),
        name: sp.performer.name,
        gender: sp.performer.gender,
        image_path: sp.performer.imagePath,
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id.toString(),
        name: st.tag.name,
      })),
      scene_markers: markersByScene[scene.id] || [],
    }));

    return NextResponse.json({
      scenes: transformedScenes,
      count: scenes.length,
    });
  } catch (error) {
    console.error("Error searching scenes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search scenes" },
      { status: 500 }
    );
  }
}

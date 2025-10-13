import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/marker-group-tag-sorting
 * Query params:
 *   - markerGroupId: (optional) Filter by marker group ID
 *
 * Returns all marker group tag sorting rules, optionally filtered by marker group.
 * Format: { groups: [{ markerGroupId, tagIds: [...] }, ...] }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const markerGroupId = searchParams.get("markerGroupId");

    if (markerGroupId) {
      // Get sorted tags for a specific marker group
      const sortingRules = await prisma.markerGroupTagSorting.findMany({
        where: {
          markerGroupId: parseInt(markerGroupId),
        },
        orderBy: {
          sortOrder: 'asc',
        },
      });

      return NextResponse.json({
        markerGroupId: parseInt(markerGroupId),
        tagIds: sortingRules.map(rule => rule.tagId.toString()),
      });
    } else {
      // Get all sorting rules grouped by marker group
      const allRules = await prisma.markerGroupTagSorting.findMany({
        orderBy: [
          { markerGroupId: 'asc' },
          { sortOrder: 'asc' },
        ],
      });

      // Group by marker group ID
      const groupedRules = new Map<number, string[]>();
      for (const rule of allRules) {
        if (!groupedRules.has(rule.markerGroupId)) {
          groupedRules.set(rule.markerGroupId, []);
        }
        groupedRules.get(rule.markerGroupId)!.push(rule.tagId.toString());
      }

      // Transform to array format
      const groups = Array.from(groupedRules.entries()).map(([markerGroupId, tagIds]) => ({
        markerGroupId,
        tagIds,
      }));

      return NextResponse.json({ groups });
    }
  } catch (error) {
    console.error("Error loading marker group tag sorting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load marker group tag sorting" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marker-group-tag-sorting
 * Body: { markerGroupId: number, tagIds: string[] }
 *
 * Replaces all sorting rules for the specified marker group atomically.
 * Array index becomes sort_order (0, 1, 2, ...).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { markerGroupId, tagIds } = body;

    if (!markerGroupId || !Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: "markerGroupId and tagIds array are required" },
        { status: 400 }
      );
    }

    const markerGroupIdNum = parseInt(markerGroupId.toString());

    // Use transaction to atomically replace all sorting rules for this marker group
    await prisma.$transaction(async (tx) => {
      // Delete existing rules for this marker group
      await tx.markerGroupTagSorting.deleteMany({
        where: {
          markerGroupId: markerGroupIdNum,
        },
      });

      // Insert new rules
      for (let i = 0; i < tagIds.length; i++) {
        const tagId = parseInt(tagIds[i]);
        await tx.markerGroupTagSorting.create({
          data: {
            markerGroupId: markerGroupIdNum,
            tagId,
            sortOrder: i,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving marker group tag sorting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save marker group tag sorting" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/marker-group-tag-sorting
 * Query params:
 *   - markerGroupId: Marker group ID to delete all sorting rules for
 *
 * Removes all sorting rules for the specified marker group.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const markerGroupId = searchParams.get("markerGroupId");

    if (!markerGroupId) {
      return NextResponse.json(
        { error: "markerGroupId query parameter is required" },
        { status: 400 }
      );
    }

    await prisma.markerGroupTagSorting.deleteMany({
      where: {
        markerGroupId: parseInt(markerGroupId),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting marker group tag sorting:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete marker group tag sorting" },
      { status: 500 }
    );
  }
}

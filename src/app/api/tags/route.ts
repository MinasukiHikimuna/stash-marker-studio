import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const tags = await prisma.stashTag.findMany({
      include: {
        parents: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform to Stashapp format
    const transformedTags = tags.map(tag => ({
      id: tag.id.toString(),
      name: tag.name,
      parents: tag.parents.map(parentRel => ({
        id: parentRel.parent.id.toString(),
        name: parentRel.parent.name,
      })),
    }));

    return NextResponse.json({
      tags: transformedTags,
    });
  } catch (error) {
    console.error("Error loading tags:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load tags" },
      { status: 500 }
    );
  }
}

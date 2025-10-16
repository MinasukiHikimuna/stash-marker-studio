import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Tag } from '@/services/StashappService';

export async function GET() {
  try {
    // Fetch all tags from local database with parent/child relationships
    const dbTags = await prisma.stashTag.findMany({
      include: {
        parents: {
          include: {
            parent: {
              include: {
                parents: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
        children: {
          include: {
            child: true,
          },
        },
      },
      orderBy: { syncedAt: 'desc' },
    });

    // Transform database tags to match StashappService Tag format
    const tags: Tag[] = dbTags.map((dbTag) => ({
      id: dbTag.id.toString(),
      name: dbTag.name,
      description: null, // Description not stored in sync table
      parents: dbTag.parents.map((p) => ({
        id: p.parent.id.toString(),
        name: p.parent.name,
        parents: p.parent.parents.map((pp) => ({
          id: pp.parent.id.toString(),
          name: pp.parent.name,
        })),
      })),
      children: dbTag.children.map((c) => ({
        id: c.child.id.toString(),
        name: c.child.name,
        description: null,
      })),
    }));

    // Return in same format as StashappService.getAllTags()
    return NextResponse.json({
      findTags: {
        count: tags.length,
        tags,
      },
    });
  } catch (error) {
    console.error('Error fetching tags from local database:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags from local database' },
      { status: 500 }
    );
  }
}

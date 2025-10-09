import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ sourceTagId: string }>;
};

// GET /api/corresponding-tag-mappings/by-source-tag/[sourceTagId] - Get mapping by source tag ID
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sourceTagId } = await context.params;

    const mapping = await prisma.correspondingTagMapping.findUnique({
      where: { sourceTagId: parseInt(sourceTagId) },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: 'Corresponding tag mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error fetching corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch corresponding tag mapping' },
      { status: 500 }
    );
  }
}

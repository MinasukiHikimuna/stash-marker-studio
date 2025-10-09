import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/corresponding-tag-mappings - List all tag mappings
export async function GET() {
  try {
    const mappings = await prisma.correspondingTagMapping.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error('Error fetching corresponding tag mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch corresponding tag mappings' },
      { status: 500 }
    );
  }
}

// POST /api/corresponding-tag-mappings - Create a new tag mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceTagId, correspondingTagId } = body;

    if (!sourceTagId || !correspondingTagId) {
      return NextResponse.json(
        { error: 'sourceTagId and correspondingTagId are required' },
        { status: 400 }
      );
    }

    // Check if mapping already exists for this source tag
    const existing = await prisma.correspondingTagMapping.findUnique({
      where: { sourceTagId: parseInt(sourceTagId) },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A mapping already exists for this source tag' },
        { status: 409 }
      );
    }

    const mapping = await prisma.correspondingTagMapping.create({
      data: {
        sourceTagId: parseInt(sourceTagId),
        correspondingTagId: parseInt(correspondingTagId),
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error('Error creating corresponding tag mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create corresponding tag mapping' },
      { status: 500 }
    );
  }
}

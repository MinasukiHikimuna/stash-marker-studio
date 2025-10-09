import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get all slot definitions, optionally filtered by tag ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId');

    const slotDefinitions = await prisma.slotDefinition.findMany({
      where: tagId
        ? {
            slotDefinitionSet: {
              stashappTagId: parseInt(tagId),
            },
          }
        : undefined,
      include: {
        slotDefinitionSet: true,
        genderHints: true,
      },
      orderBy: [{ slotDefinitionSetId: 'asc' }, { order: 'asc' }],
    });

    return NextResponse.json({
      slotDefinitions,
    });
  } catch (error) {
    console.error('Error fetching slot definitions:', error);
    return NextResponse.json({ error: 'Failed to fetch slot definitions' }, { status: 500 });
  }
}

// TODO: This endpoint needs to be redesigned for SlotDefinitionSet structure
// Create a new slot definition
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { error: 'This endpoint is being redesigned for the new SlotDefinitionSet structure' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Error creating slot definition:', error);
    return NextResponse.json({ error: 'Failed to create slot definition' }, { status: 500 });
  }
}

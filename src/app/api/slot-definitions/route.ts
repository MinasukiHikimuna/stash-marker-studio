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
            stashappTagId: parseInt(tagId),
          }
        : undefined,
      orderBy: [{ stashappTagId: 'asc' }, { displayOrder: 'asc' }],
    });

    return NextResponse.json({
      slotDefinitions,
    });
  } catch (error) {
    console.error('Error fetching slot definitions:', error);
    return NextResponse.json({ error: 'Failed to fetch slot definitions' }, { status: 500 });
  }
}

// Create a new slot definition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stashappTagId, slotLabel, genderHint, displayOrder } = body;

    if (!stashappTagId) {
      return NextResponse.json(
        { error: 'stashappTagId is required' },
        { status: 400 }
      );
    }

    const slotDefinition = await prisma.slotDefinition.create({
      data: {
        stashappTagId: parseInt(stashappTagId),
        slotLabel: slotLabel?.trim() || null,
        genderHint: genderHint ?? null,
        displayOrder: displayOrder ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      slotDefinition,
    });
  } catch (error) {
    console.error('Error creating slot definition:', error);
    return NextResponse.json({ error: 'Failed to create slot definition' }, { status: 500 });
  }
}

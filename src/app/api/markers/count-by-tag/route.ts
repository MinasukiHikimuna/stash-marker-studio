import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/markers/count-by-tag?tagId=123
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json(
        { error: 'tagId is required' },
        { status: 400 }
      );
    }

    const count = await prisma.marker.count({
      where: {
        primaryTagId: parseInt(tagId),
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error counting markers by tag:', error);
    return NextResponse.json(
      { error: 'Failed to count markers by tag' },
      { status: 500 }
    );
  }
}

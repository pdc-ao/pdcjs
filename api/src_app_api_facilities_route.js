// GET / POST /api/facilities
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId') || undefined;
    const city = searchParams.get('city') || undefined;

    const facilities = await db.transformationFacility.findMany({
      where: {
        ...(ownerId ? { ownerId } : {}),
        ...(city ? { city } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, username: true, fullName: true } }
      }
    });

    return NextResponse.json(facilities);
  } catch (err) {
    console.error('[FACILITIES GET]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!['TRANSFORMER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();

    // Basic validation
    if (!body.facilityName || !body.addressLine1 || !body.city) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const created = await db.transformationFacility.create({
      data: {
        ownerId: session.user.id,
        facilityName: body.facilityName,
        facilityType: body.facilityType || null,
        capacity: body.capacity ? parseInt(body.capacity, 10) : null,
        capacityUnit: body.capacityUnit || null,
        addressLine1: body.addressLine1,
        city: body.city,
        country: body.country || 'Angola',
        description: body.description || null,
      },
      include: {
        owner: { select: { id: true, username: true, fullName: true } }
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[FACILITIES POST]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

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
    });

    return NextResponse.json(facilities);
  } catch (err) {
    console.error('[FACILITIES GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!['TRANSFORMER','ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const body = await request.json();
    const created = await db.transformationFacility.create({
      data: { ownerId: session.user.id, facilityName: body.facilityName, facilityType: body.facilityType || null, capacity: body.capacity || null, capacityUnit: body.capacityUnit || null, addressLine1: body.addressLine1, city: body.city, country: body.country || 'Angola', description: body.description || null },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[FACILITIES POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
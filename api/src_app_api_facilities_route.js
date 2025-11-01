import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

// GET /api/facilities
export async function GET() {
  try {
    const facilities = await db.facility.findMany({
      where: { status: 'Active' },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(facilities);
  } catch (err) {
    console.error('[FACILITIES GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/facilities
export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const facility = await db.facility.create({
      data: {
        ownerId: session.user.id,
        name: body.name,
        location: body.location,
        capacity: parseFloat(body.capacity),
        description: body.description || '',
        status: 'Active'
      }
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (err) {
    console.error('[FACILITIES POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/facilities/:id
export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const facility = await db.facility.findUnique({ where: { id: params.id } });
    if (!facility) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (facility.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const updated = await db.facility.update({
      where: { id: params.id },
      data: {
        name: body.name ?? facility.name,
        location: body.location ?? facility.location,
        capacity: body.capacity ? parseFloat(body.capacity) : facility.capacity,
        description: body.description ?? facility.description,
        status: body.status ?? facility.status
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[FACILITIES PATCH]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

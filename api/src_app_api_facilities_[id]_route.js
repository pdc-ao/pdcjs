// GET / PATCH / DELETE for /api/facilities/[id]
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(_req, { params }) {
  try {
    const f = await db.transformationFacility.findUnique({ where: { id: params.id } });
    if (!f) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(f);
  } catch (err) {
    console.error('[FACILITY GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await request.json();
    const existing = await db.transformationFacility.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.ownerId !== session.user.id && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const updated = await db.transformationFacility.update({ where: { id: params.id }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[FACILITY PATCH]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const existing = await db.transformationFacility.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.ownerId !== session.user.id && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    await db.transformationFacility.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FACILITY DELETE]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
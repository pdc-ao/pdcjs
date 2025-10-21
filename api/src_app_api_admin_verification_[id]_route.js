// PATCH /api/admin/verification/[id]
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const id = params.id;
    const body = await request.json();
    const status = body.status;
    const notes = body.notes || null;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (doc.status !== 'PENDING_REVIEW') {
      return NextResponse.json({ error: 'Already reviewed' }, { status: 409 });
    }

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.document.update({
        where: { id },
        data: { status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED', rejectionReason: notes, reviewedBy: session.user.id, reviewedAt: new Date() },
      });

      if (status === 'APPROVED') {
        // mark user verified (simple heuristic)
        await tx.user.update({ where: { id: doc.userId }, data: { verificationStatus: 'VERIFIED', isVerified: true } });
      } else {
        // if no pending and no approved docs, set REJECTED (conservative)
        const pendingCount = await tx.document.count({ where: { userId: doc.userId, status: 'PENDING_REVIEW' } });
        const approvedCount = await tx.document.count({ where: { userId: doc.userId, status: 'APPROVED' } });
        if (pendingCount === 0 && approvedCount === 0) {
          await tx.user.update({ where: { id: doc.userId }, data: { verificationStatus: 'REJECTED', isVerified: false } });
        }
      }
      return u;
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[ADMIN VERIFICATION PATCH]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
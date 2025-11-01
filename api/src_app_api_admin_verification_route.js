import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

// GET /api/admin/verification
export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const userId = url.searchParams.get('userId') || undefined;
    const docType = url.searchParams.get('docType') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const docs = await db.document.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(docType ? { type: docType } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return NextResponse.json(docs);
  } catch (err) {
    console.error('[ADMIN VERIFICATION GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PATCH /api/admin/verification/:id
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
        data: {
          status: status === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          rejectionReason: notes,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      });

      if (status === 'APPROVED') {
        await tx.user.update({
          where: { id: doc.userId },
          data: { verificationStatus: 'VERIFIED', isVerified: true },
        });
      } else {
        const pendingCount = await tx.document.count({
          where: { userId: doc.userId, status: 'PENDING_REVIEW' },
        });
        const approvedCount = await tx.document.count({
          where: { userId: doc.userId, status: 'APPROVED' },
        });
        if (pendingCount === 0 && approvedCount === 0) {
          await tx.user.update({
            where: { id: doc.userId },
            data: { verificationStatus: 'REJECTED', isVerified: false },
          });
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

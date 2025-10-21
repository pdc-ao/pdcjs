// GET /api/admin/verification
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(request) {
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
      include: { user: { select: { id: true, username: true, fullName: true, verificationStatus: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    return NextResponse.json(docs);
  } catch (err) {
    console.error('[ADMIN VERIFICATION GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
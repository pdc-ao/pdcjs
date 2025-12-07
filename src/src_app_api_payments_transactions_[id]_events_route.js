// GET /api/payments/transactions/[id]/events
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(_req, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const events = await db.paymentTransactionEvent.findMany({
      where: { transactionId: params.id },
      include: {
        actor: { select: { id: true, username: true, fullName: true } }
      },
      orderBy: { timestamp: 'asc' }
    });

    return NextResponse.json(events);
  } catch (err) {
    console.error('[TRANSACTION EVENTS GET]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

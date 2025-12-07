// GET, POST /api/payments/transactions
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // optional filter

    const where = role === 'buyer'
      ? { buyerId: session.user.id }
      : role === 'seller'
        ? { sellerId: session.user.id }
        : {
            OR: [
              { buyerId: session.user.id },
              { sellerId: session.user.id }
            ]
          };

    const txns = await db.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, username: true, fullName: true } },
        seller: { select: { id: true, username: true, fullName: true } }
      }
    });

    return NextResponse.json(txns);
  } catch (err) {
    console.error('[TRANSACTIONS GET]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { sellerId, amount, description } = body;

    if (!sellerId || !amount) {
      return NextResponse.json({ error: 'Missing sellerId or amount' }, { status: 400 });
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const seller = await db.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const txn = await db.paymentTransaction.create({
      data: {
        buyerId: session.user.id,
        sellerId,
        amount: Number(amount),
        description: description || null,
        status: 'PENDING'
      },
      include: {
        buyer: { select: { id: true, username: true, fullName: true } },
        seller: { select: { id: true, username: true, fullName: true } }
      }
    });

    return NextResponse.json(txn, { status: 201 });
  } catch (err) {
    console.error('[TRANSACTIONS POST]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

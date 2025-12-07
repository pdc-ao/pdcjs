// GET, PATCH for /api/payments/transactions/[id]
// state machine: FUND, SELLER_CONFIRM, BUYER_CONFIRM, RELEASE, DISPUTE, REFUND, CANCELLED
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { ensureWallet, creditWallet } from '@/lib/wallet';

export async function GET(_req, { params }) {
  try {
    const tx = await db.paymentTransaction.findUnique({
      where: { id: params.id },
      include: {
        buyer: { select: { id: true, username: true, fullName: true } },
        seller: { select: { id: true, username: true, fullName: true } }
      }
    });
    if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tx);
  } catch (err) {
    console.error('[TRANSACTION GET]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action } = await request.json();
    const id = params.id;

    const payment = await db.paymentTransaction.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const isBuyer = payment.buyerId === session.user.id;
    const isSeller = payment.sellerId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.paymentTransaction.findUnique({ where: { id } });
      if (!fresh) throw new Error('Transaction gone');

      switch (action) {
        case 'FUND':
          if (!isBuyer) return NextResponse.json({ error: 'Only buyer can fund' }, { status: 403 });
          if (fresh.status !== 'PENDING') return NextResponse.json({ error: 'Invalid state' }, { status: 409 });
          return tx.paymentTransaction.update({
            where: { id },
            data: { status: 'FUNDED', buyerConfirmed: true, escrowHeldAt: new Date() }
          });

        case 'SELLER_CONFIRM':
          if (!isSeller) return NextResponse.json({ error: 'Only seller can confirm' }, { status: 403 });
          if (fresh.status !== 'FUNDED') return NextResponse.json({ error: 'Invalid state' }, { status: 409 });
          return tx.paymentTransaction.update({
            where: { id },
            data: { status: 'SELLER_CONFIRMED', sellerConfirmed: true }
          });

        case 'BUYER_CONFIRM':
          if (!isBuyer) return NextResponse.json({ error: 'Only buyer can confirm' }, { status: 403 });
          if (!['FUNDED','SELLER_CONFIRMED'].includes(fresh.status)) {
            return NextResponse.json({ error: 'Invalid state' }, { status: 409 });
          }
          return tx.paymentTransaction.update({
            where: { id },
            data: { status: 'BUYER_CONFIRMED', buyerConfirmed: true }
          });

        case 'RELEASE':
          if (!(isAdmin || (fresh.buyerConfirmed && fresh.sellerConfirmed))) {
            return NextResponse.json({ error: 'Not authorized to release' }, { status: 403 });
          }
          if (['RELEASED','REFUNDED','CANCELLED'].includes(fresh.status)) {
            return NextResponse.json({ error: 'Already finalized' }, { status: 409 });
          }
          if (Number(fresh.amount) <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
          }
          await ensureWallet(tx, fresh.sellerId);
          await creditWallet(tx, fresh.sellerId, Number(fresh.amount), { paymentTransactionId: id });
          return tx.paymentTransaction.update({
            where: { id },
            data: { status: 'RELEASED', releasedAt: new Date() }
          });

        case 'DISPUTE':
          if (!(isBuyer || isSeller)) return NextResponse.json({ error: 'Participants only' }, { status: 403 });
          if (!['FUNDED','SELLER_CONFIRMED','BUYER_CONFIRMED'].includes(fresh.status)) {
            return NextResponse.json({ error: 'Invalid state' }, { status: 409 });
          }
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'DISPUTED' } });

        case 'REFUND':
          if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
          if (fresh.status !== 'DISPUTED') return NextResponse.json({ error: 'Can only refund disputed' }, { status: 409 });
          if (Number(fresh.amount) <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
          }
          await ensureWallet(tx, fresh.buyerId);
          await creditWallet(tx, fresh.buyerId, Number(fresh.amount), { paymentTransactionId: id, refund: true });
          return tx.paymentTransaction.update({
            where: { id },
            data: { status: 'REFUNDED', releasedAt: new Date() }
          });

        case 'CANCEL':
          if (!isBuyer) return NextResponse.json({ error: 'Only buyer can cancel' }, { status: 403 });
          if (fresh.status !== 'PENDING') return NextResponse.json({ error: 'Can only cancel pending' }, { status: 409 });
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'CANCELLED' } });

        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      }
    });

    return result;
  } catch (err) {
    console.error('[TRANSACTION PATCH]', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

// GET, PATCH for /api/payments/transactions/[id]
// state machine: FUND, SELLER_CONFIRM, BUYER_CONFIRM, RELEASE, DISPUTE, REFUND, CANCEL
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { ensureWallet, creditWallet } from '@/lib/wallet';

export async function GET(_req, { params }) {
  try {
    const tx = await db.paymentTransaction.findUnique({ where: { id: params.id } });
    if (!tx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tx);
  } catch (err) {
    console.error('[TRANSACTION GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const action = body.action;
    const id = params.id;

    const payment = await db.paymentTransaction.findUnique({ where: { id } });
    if (!payment) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    const isBuyer = payment.buyerId === session.user.id;
    const isSeller = payment.sellerId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    const result = await db.$transaction(async (tx) => {
      const fresh = await tx.paymentTransaction.findUnique({ where: { id } });
      if (!fresh) throw new Error('Transaction gone');

      switch (action) {
        case 'FUND':
          if (!isBuyer) throw new Error('Only buyer can fund');
          if (fresh.status !== 'PENDING') throw new Error('Invalid state');
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'FUNDED', buyerConfirmed: true, escrowHeldAt: new Date() } });

        case 'SELLER_CONFIRM':
          if (!isSeller) throw new Error('Only seller can confirm');
          if (fresh.status !== 'FUNDED') throw new Error('Invalid state');
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'SELLER_CONFIRMED', sellerConfirmed: true } });

        case 'BUYER_CONFIRM':
          if (!isBuyer) throw new Error('Only buyer can confirm');
          if (!['FUNDED','SELLER_CONFIRMED'].includes(fresh.status)) throw new Error('Invalid state');
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'BUYER_CONFIRMED', buyerConfirmed: true } });

        case 'RELEASE':
          if (!(isAdmin || (fresh.buyerConfirmed && fresh.sellerConfirmed))) throw new Error('Not authorized to release');
          if (['RELEASED','REFUNDED','CANCELLED'].includes(fresh.status)) throw new Error('Already finalized');
          await ensureWallet(tx, fresh.sellerId);
          await creditWallet(tx, fresh.sellerId, Number(fresh.amount), { paymentTransactionId: id });
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'RELEASED', releasedAt: new Date() } });

        case 'DISPUTE':
          if (!(isBuyer || isSeller)) throw new Error('Participants only');
          if (!['FUNDED','SELLER_CONFIRMED','BUYER_CONFIRMED'].includes(fresh.status)) throw new Error('Invalid state');
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'DISPUTED' } });

        case 'REFUND':
          if (!isAdmin) throw new Error('Admin only');
          if (fresh.status !== 'DISPUTED') throw new Error('Can only refund disputed');
          await ensureWallet(tx, fresh.buyerId);
          await creditWallet(tx, fresh.buyerId, Number(fresh.amount), { paymentTransactionId: id, refund: true });
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'REFUNDED', releasedAt: new Date() } });

        case 'CANCEL':
          if (!isBuyer) throw new Error('Only buyer can cancel');
          if (fresh.status !== 'PENDING') throw new Error('Can only cancel pending');
          return tx.paymentTransaction.update({ where: { id }, data: { status: 'CANCELLED' } });

        default:
          throw new Error('Unknown action');
      }
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[TRANSACTION PATCH]', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 400 });
  }
}
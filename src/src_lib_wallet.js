// Minimal wallet helper in JS for transactional credit/debit and audit entries
import { Prisma } from '@prisma/client';
import { db } from './prisma';

export async function ensureWallet(tx, userId) {
  const existing = await tx.walletBalance.findUnique({ where: { userId } });
  if (!existing) {
    return tx.walletBalance.create({ data: { userId, balance: new Prisma.Decimal(0) } });
  }
  return existing;
}

export async function creditWallet(tx, userId, amount, meta) {
  await ensureWallet(tx, userId);
  const updated = await tx.walletBalance.update({
    where: { userId },
    data: { balance: { increment: new Prisma.Decimal(amount) } },
  });
  await tx.auditLog.create({
    data: { userId, action: 'WALLET_CREDIT', entityType: 'WALLET', entityId: userId, details: { amount, meta } },
  });
  return updated;
}

export async function debitWallet(tx, userId, amount, meta) {
  await ensureWallet(tx, userId);
  const wallet = await tx.walletBalance.findUnique({ where: { userId } });
  const current = Number(wallet?.balance ?? 0);
  if (current < amount) throw new Error('Insufficient wallet balance');
  const updated = await tx.walletBalance.update({
    where: { userId },
    data: { balance: { decrement: new Prisma.Decimal(amount) } },
  });
  await tx.auditLog.create({
    data: { userId, action: 'WALLET_DEBIT', entityType: 'WALLET', entityId: userId, details: { amount, meta } },
  });
  return updated;
}
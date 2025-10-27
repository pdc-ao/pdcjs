// PATCH /api/products/[id]
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const product = await db.productListing.findUnique({ where: { id: params.id } });
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (product.producerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const updated = await db.productListing.update({
      where: { id: params.id },
      data: {
        title: body.title ?? product.title,
        description: body.description ?? product.description,
        category: body.category ?? product.category,
        quantityAvailable: body.quantityAvailable ? parseFloat(body.quantityAvailable) : product.quantityAvailable,
        unitOfMeasure: body.unitOfMeasure ?? product.unitOfMeasure,
        pricePerUnit: body.pricePerUnit ? parseFloat(body.pricePerUnit) : product.pricePerUnit,
        status: body.status ?? product.status,
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[PRODUCT PATCH]', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

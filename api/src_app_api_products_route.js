// GET / POST /api/products (basic list + create)
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where = { status: 'Active', quantityAvailable: { gt: 0 } };
    if (category) where.category = category;
    if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }];

    const [products, total] = await Promise.all([
      db.productListing.findMany({
        where,
        include: { producer: { select: { id: true, username: true, fullName: true, averageRating: true } }, reviews: { where: { isApprovedByAdmin: true }, take: 5 } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.productListing.count({ where }),
    ]);

    const productsWithRatings = products.map(p => {
      const avg = p.reviews && p.reviews.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : null;
      return { ...p, averageRating: avg, totalReviews: p.reviews?.length || 0 };
    });

    return NextResponse.json({ products: productsWithRatings, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[PRODUCTS GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.role !== 'PRODUCER') return NextResponse.json({ error: 'Only producers can create products' }, { status: 403 });

    if (!body.title || !body.description || !body.category || !body.quantityAvailable || !body.unitOfMeasure || !body.pricePerUnit) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const images = Array.isArray(body.imagesUrls) ? body.imagesUrls.filter(Boolean) : null;

    const product = await db.productListing.create({
      data: {
        producerId: session.user.id,
        title: body.title,
        description: body.description,
        category: body.category,
        subcategory: body.subcategory || null,
        quantityAvailable: parseFloat(body.quantityAvailable),
        unitOfMeasure: body.unitOfMeasure,
        pricePerUnit: parseFloat(body.pricePerUnit),
        currency: body.currency || 'AOA',
        plannedAvailabilityDate: body.plannedAvailabilityDate ? new Date(body.plannedAvailabilityDate) : null,
        locationAddress: body.locationAddress || null,
        locationLatitude: body.locationLatitude ? parseFloat(body.locationLatitude) : null,
        locationLongitude: body.locationLongitude ? parseFloat(body.locationLongitude) : null,
        qualityCertifications: body.qualityCertifications || null,
        imagesUrls: images,
        status: body.status || 'Active',
      },
      include: { producer: { select: { id: true, username: true, fullName: true } } },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error('[PRODUCTS POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
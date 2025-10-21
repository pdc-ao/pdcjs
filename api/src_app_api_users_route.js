// GET / POST /api/users
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { id: true, username: true, email: true, fullName: true, role: true, isVerified: true, averageRating: true, createdAt: true },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error('[USERS GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.username || !body.email || !body.password || !body.role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const exists = await db.user.findFirst({ where: { OR: [{ email: body.email }, { username: body.username }] } });
    if (exists) return NextResponse.json({ error: 'User or email exists' }, { status: 409 });

    // Hash password server-side
    const hashed = await bcrypt.hash(body.password, 12);

    const user = await db.user.create({
      data: {
        username: body.username,
        email: body.email,
        passwordHash: hashed,
        fullName: body.fullName || null,
        phoneNumber: body.phoneNumber || null,
        role: body.role,
      },
    });

    // create role-specific details if provided
    if (body.role === 'PRODUCER' && body.producerDetails) {
      await db.producerDetails.create({ data: { userId: user.id, farmName: body.producerDetails.farmName || null, farmDescription: body.producerDetails.farmDescription || null, certifications: body.producerDetails.certifications || null } });
    } else if (body.role === 'STORAGE_OWNER' && body.storageDetails) {
      await db.storageDetails.create({ data: { userId: user.id, facilityName: body.storageDetails.facilityName || null, businessRegistrationId: body.storageDetails.businessRegistrationId || null } });
    } else if (body.role === 'TRANSPORTER' && body.transporterDetails) {
      await db.transporterDetails.create({ data: { userId: user.id, companyName: body.transporterDetails.companyName || null, driverLicenseId: body.transporterDetails.driverLicenseId || null, vehicleRegistrationDetails: body.transporterDetails.vehicleRegistrationDetails || null } });
    }

    return NextResponse.json({ id: user.id, username: user.username, email: user.email, role: user.role, createdAt: user.createdAt }, { status: 201 });
  } catch (err) {
    console.error('[USERS POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
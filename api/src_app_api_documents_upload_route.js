// POST /api/documents/upload
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
});

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const form = await request.formData();
    const file = form.get('file');
    const docType = form.get('docType');

    if (!file || !docType) return NextResponse.json({ error: 'Missing file or docType' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const key = `documents/${session.user.id}/${uuidv4()}-${file.name}`;

    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer, ContentType: file.type, ACL: 'private' }));

    const fileUrl = process.env.S3_PUBLIC_BASE_URL ? `${process.env.S3_PUBLIC_BASE_URL}/${key}` : `s3://${process.env.S3_BUCKET}/${key}`;

    const doc = await db.document.create({
      data: { userId: session.user.id, type: String(docType), fileName: file.name, fileUrl, fileKey: key, fileSize: buffer.length, mimeType: file.type, status: 'PENDING_REVIEW' },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('[DOCUMENT UPLOAD]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
// GET and POST /api/messages
import { NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const senderId = searchParams.get('senderId');
    const receiverId = searchParams.get('receiverId');
    const conversationId = searchParams.get('conversationId');

    let effectiveConversationId = conversationId;

    if (!conversationId && senderId && receiverId) {
      const existingMessage = await db.message.findFirst({
        where: { OR: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] },
        orderBy: { sentAt: 'desc' },
      });
      effectiveConversationId = existingMessage ? existingMessage.conversationId : `conv_${senderId}_${receiverId}`;
    }

    const messages = await db.message.findMany({
      where: {
        ...(effectiveConversationId ? { conversationId: effectiveConversationId } : {}),
        ...(senderId && !effectiveConversationId ? { OR: [{ senderId }, { receiverId: senderId }] } : {}),
      },
      include: {
        sender: { select: { id: true, username: true, fullName: true, profilePictureUrl: true } },
        receiver: { select: { id: true, username: true, fullName: true, profilePictureUrl: true } },
      },
      orderBy: { sentAt: 'asc' },
    });

    if (receiverId && messages.length > 0) {
      await db.message.updateMany({ where: { receiverId, readAt: null }, data: { readAt: new Date() } });
    }

    return NextResponse.json({ conversationId: effectiveConversationId, messages });
  } catch (err) {
    console.error('[MESSAGES GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json();
    const senderId = session.user.id;
    const { receiverId, messageContent } = body;

    if (!receiverId || !messageContent) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const receiver = await db.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return NextResponse.json({ error: 'Receiver not found' }, { status: 404 });

    let conversationId = body.conversationId;
    if (!conversationId) {
      const existingMessage = await db.message.findFirst({
        where: { OR: [{ senderId, receiverId }, { senderId: receiverId, receiverId: senderId }] },
        orderBy: { sentAt: 'desc' },
      });
      conversationId = existingMessage ? existingMessage.conversationId : `conv_${senderId}_${receiverId}`;
    }

    const message = await db.message.create({
      data: { conversationId, senderId, receiverId, messageContent },
      include: { sender: { select: { id: true, username: true, fullName: true } }, receiver: { select: { id: true, username: true, fullName: true } } },
    });

    // TODO: emit realtime event using your realtime bus/pusher integration

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error('[MESSAGES POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
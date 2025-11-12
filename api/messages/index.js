const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = payload.userId;

    if (req.method === 'GET') {
      const { senderId, receiverId, conversationId, limit } = req.query || {};
      let effectiveConversationId = conversationId;

      // Normalize conversationId if missing
      if (!conversationId && senderId && receiverId) {
        const convKey = [senderId, receiverId].sort().join('_');
        const existingMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId, receiverId },
              { senderId: receiverId, receiverId: senderId }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });
        effectiveConversationId = existingMessage
          ? existingMessage.conversationId
          : `conv_${convKey}`;
      }

      const messages = await prisma.message.findMany({
        where: {
          ...(effectiveConversationId ? { conversationId: effectiveConversationId } : {}),
          ...(senderId && !effectiveConversationId
            ? { OR: [{ senderId }, { receiverId: senderId }] }
            : {})
        },
        include: {
          sender: {
            select: { id: true, username: true, fullName: true, profilePictureUrl: true }
          },
          receiver: {
            select: { id: true, username: true, fullName: true, profilePictureUrl: true }
          }
        },
        orderBy: { createdAt: 'asc' },
        take: Math.min(parseInt(limit) || 100, 200)
      });

      // Mark as read
      if (receiverId && messages.length > 0) {
        await prisma.message.updateMany({
          where: { receiverId, readAt: null },
          data: { readAt: new Date() }
        });
      }

      return res.json({ conversationId: effectiveConversationId, messages });
    }

    if (req.method === 'POST') {
      const { receiverId, messageContent, conversationId } = req.body || {};
      if (!receiverId || !messageContent) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (messageContent.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }
      if (messageContent.length > 1000) {
        return res.status(400).json({ error: 'Message too long' });
      }

      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      if (!receiver) {
        return res.status(404).json({ error: 'Receiver not found' });
      }

      // Normalize conversationId
      let finalConversationId = conversationId;
      if (!conversationId) {
        const convKey = [userId, receiverId].sort().join('_');
        const existingMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId },
              { senderId: receiverId, receiverId: userId }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });
        finalConversationId = existingMessage
          ? existingMessage.conversationId
          : `conv_${convKey}`;
      }

      const message = await prisma.message.create({
        data: {
          senderId: userId,
          receiverId,
          messageContent,
          conversationId: finalConversationId
        },
        include: {
          sender: { select: { id: true, username: true, fullName: true } },
          receiver: { select: { id: true, username: true, fullName: true } }
        }
      });

      return res.status(201).json({ data: message });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[MESSAGES API]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

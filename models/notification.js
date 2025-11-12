import db from '../db/index.js';

export async function getNotifications(userId) {
  return await db('notifications')
    .where({ userId })
    .orderBy('time', 'desc')
    .limit(50);
}

export async function markAllRead(userId) {
  return await db('notifications')
    .where({ userId, read: false })
    .update({ read: true });
}

export async function createNotification(userId, message, icon = '🔔') {
  return await db('notifications').insert({
    userId,
    message,
    icon,
    time: new Date(),
    read: false
  });
}

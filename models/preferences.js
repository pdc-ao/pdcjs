import db from '../db/index.js';

export async function getPreferences(userId) {
  const prefs = await db('notification_preferences').where({ userId }).first();
  return prefs || { email: false, sms: false, app: true };
}

export async function setPreferences(userId, { email, sms, app }) {
  const existing = await db('notification_preferences').where({ userId }).first();
  if (existing) {
    await db('notification_preferences').where({ userId }).update({ email, sms, app });
  } else {
    await db('notification_preferences').insert({ userId, email, sms, app });
  }
  return { email, sms, app };
}

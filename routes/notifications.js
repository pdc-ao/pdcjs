import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getNotifications, markAllRead, createNotification } from '../models/notification.js';
import { getPreferences, setPreferences } from '../models/preferences.js';

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  const alerts = await getNotifications(req.user.id);
  res.json(alerts);
});

// PATCH /api/notifications/mark-all-read
router.patch('/mark-all-read', requireAuth, async (req, res) => {
  await markAllRead(req.user.id);
  res.json({ success: true });
});

// GET /api/notifications/preferences
router.get('/preferences', requireAuth, async (req, res) => {
  const prefs = await getPreferences(req.user.id);
  res.json(prefs);
});

// POST /api/notifications/preferences
router.post('/preferences', requireAuth, async (req, res) => {
  const updated = await setPreferences(req.user.id, req.body);
  res.json(updated);
});

// (Optional) POST /api/notifications — create a new alert
router.post('/', requireAuth, async (req, res) => {
  const { message, icon } = req.body;
  const notif = await createNotification(req.user.id, message, icon);
  res.json(notif);
});

export default router;

// ===============================================================
// api/notifications.js – Notifications (Alertas) API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET  /api/notifications               → list notifications for current user
//   POST /api/notifications               → create a new notification (optional)
//   PATCH /api/notifications/mark-all     → mark every notification of the user as read
// ---------------------------------------------------------------
// All responses are JSON { data: … } (or { error: … }).
// ===============================================================

const prisma = require('../lib/prisma');          // adjust if your lib folder lives elsewhere
const { verifyToken } = require('../lib/jwt');
require('dotenv').config();                       // loads DB URL, JWT secret, etc.

// ---------- Tiny JSON helper ----------
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// -----------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// -----------------------------------------------------------------
module.exports = async (req, res) => {
  // ---------- CORS (the outer catch‑all already adds this, but keep it safe) ----------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -----------------------------------------------------------------
  // 1️⃣ Authenticate – required for all endpoints
  // -----------------------------------------------------------------
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const currentUserId = payload.userId;   // the logged‑in user

  // -----------------------------------------------------------------
  // 2️⃣ GET /api/notifications → list current user's notifications
  // -----------------------------------------------------------------
  if (req.method === 'GET' && req.url.startsWith('/api/notifications')) {
    try {
      const notes = await prisma.notification.findMany({
        where: { userId: currentUserId },
        orderBy: { createdAt: 'desc' }
      });

      // The front‑end expects:
      //   icon  (we’ll map a simple default emoji)
      //   message
      //   time   (ISO string)
      //   read   (bool)
      //   userId (so we can filter on the client if needed)
      const transformed = notes.map(n => ({
        id: n.id,
        icon: n.type === 'EMAIL' ? '📧' :
              n.type === 'SMS'   ? '📱' :
              n.type === 'APP'   ? '🔔' : '🔔', // default
        message: n.message,
        time: n.createdAt,
        read: n.read,
        userId: n.userId
      }));

      return json(res, { data: transformed });
    } catch (e) {
      console.error('[notifications GET]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 3️⃣ POST /api/notifications → create a new notification (optional)
  // -----------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/api/notifications') {
    // ---- Parse JSON body ----------------------------------------------------
    let body;
    try {
      body = await new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => (raw += chunk));
        req.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
        req.on('error', reject);
      });
    } catch {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }

    const { type = 'APP', title = '', message = '' } = body;
    if (!message) return json(res, { error: 'message is required' }, 400);

    try {
      const created = await prisma.notification.create({
        data: {
          userId: currentUserId,
          type,
          title,
          message,
          // read defaults to false, createdAt handled by Prisma
        }
      });

      // Return the newly created notification in the same shape the UI expects
      const result = {
        id: created.id,
        icon: type === 'EMAIL' ? '📧' :
              type === 'SMS'   ? '📱' :
              type === 'APP'   ? '🔔' : '🔔',
        message: created.message,
        time: created.createdAt,
        read: created.read,
        userId: created.userId
      };

      return json(res, { data: result }, 201);
    } catch (e) {
      console.error('[notifications POST]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // 4️⃣ PATCH /api/notifications/mark-all → set read = true for all user's notes
  // -----------------------------------------------------------------
  if (req.method === 'PATCH' && req.url === '/api/notifications/mark-all') {
    try {
      await prisma.notification.updateMany({
        where: { userId: currentUserId, read: false },
        data: { read: true }
      });
      // No payload needed – just return success
      return json(res, { data: { success: true } });
    } catch (e) {
      console.error('[notifications PATCH mark-all]', e);
      return json(res, { error: 'Server error' }, 500);
    }
  }

  // -----------------------------------------------------------------
  // Anything else → 405 Method Not Allowed
  // -----------------------------------------------------------------
  return json(res, { error: 'Method not allowed' }, 405);
};

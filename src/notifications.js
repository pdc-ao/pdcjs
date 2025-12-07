// ===============================================================
// api/notifications.js – Unified Notifications (Alertas) API
// ---------------------------------------------------------------
// Endpoints:
//
//   GET    /api/notifications                     → list notifications for a user
//   POST   /api/notifications                     → create a new notification
//   PATCH  /api/notifications/mark-all-read       → mark all of a user's alerts as read
//   GET    /api/notifications/preferences         → (currently a stub)
// ---------------------------------------------------------------
// All responses are JSON { data: … } (or { error: … }).
// ===============================================================

export default async function handler(req, res) {
  // ------------------------------------------------
  // 0️⃣ Simple in‑memory store (replace with DB later)
  // ------------------------------------------------
  global.notifications = global.notifications || [];

  // ------------------------------------------------
  // 1️⃣ Grab the “slug” that the catch‑all passed us.
  //    Vercel adds it as a query param called `slug`.
  // ------------------------------------------------
  const slug = (req.query && req.query.slug) || []; // [] for /notifications, ["mark-all-read"] for the sub‑route

  // ------------------------------------------------
  // 2️⃣ Helper to send consistent JSON responses
  // ------------------------------------------------
  const send = (status, payload) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  // ------------------------------------------------
  // 3️⃣ GET /api/notifications?userId=123
  // ------------------------------------------------
  if (req.method === 'GET' && (!slug.length || slug[0] === '')) {
    const userId = req.query.userId;
    if (!userId) return send(400, { error: 'userId query param required' });

    const userAlerts = global.notifications.filter(n => n.userId === userId);
    return send(200, { data: userAlerts });
  }

  // ------------------------------------------------
  // 4️⃣ POST /api/notifications   (body: { userId, message, icon? })
  // ------------------------------------------------
  if (req.method === 'POST' && (!slug.length || slug[0] === '')) {
    const { userId, message, icon } = req.body || {};
    if (!userId || !message) {
      return send(400, { error: 'userId and message are required' });
    }
    const notif = {
      id: Date.now().toString(),   // quick id – replace with DB‑generated id later
      userId,
      message,
      icon: icon || '🔔',
      time: new Date().toISOString(),
      read: false,
    };
    global.notifications.push(notif);
    return send(201, { data: notif });
  }

  // ------------------------------------------------
  // 5️⃣ PATCH /api/notifications/mark-all-read   (body: { userId })
  // ------------------------------------------------
  if (req.method === 'PATCH' && slug[0] === 'mark-all-read') {
    const { userId } = req.body || {};
    if (!userId) return send(400, { error: 'userId is required' });

    global.notifications = global.notifications.map(n =>
      n.userId === userId ? { ...n, read: true } : n
    );
    return send(200, { data: { success: true } });
  }

  // ------------------------------------------------
  // 6️⃣ GET /api/notifications/preferences   (currently a stub)
  // ------------------------------------------------
  if (req.method === 'GET' && slug[0] === 'preferences') {
    // No data yet – just return an empty object for now
    return send(200, { data: {} });
  }

  // ------------------------------------------------
  // 7️⃣ Anything else → 405 Method Not Allowed
  // ------------------------------------------------
  return send(405, { error: 'Método não permitido' });
}
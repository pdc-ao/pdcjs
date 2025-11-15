export default function handler(req, res) {
  // In-memory store for demo (replace with DB later)
  global.notifications = global.notifications || [];

  const { method, query } = req;
  const userId = query.userId;

  if (method === 'GET') {
    const userAlerts = global.notifications.filter(n => n.userId === userId);
    return res.status(200).json(userAlerts);
  }

  if (method === 'POST') {
    const { userId, message, icon } = req.body;
    const notif = { userId, message, icon: icon || '🔔', time: new Date(), read: false };
    global.notifications.push(notif);
    return res.status(201).json(notif);
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

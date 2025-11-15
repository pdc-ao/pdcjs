export default function handler(req, res) {
  global.preferences = global.preferences || [];

  const { method, query, body } = req;
  const userId = query.userId || body.userId;

  if (method === 'GET') {
    const prefs = global.preferences.find(p => p.userId === userId);
    return res.status(200).json(prefs || { email: false, sms: false, app: true });
  }

  if (method === 'POST') {
    const { email, sms, app } = body;
    global.preferences = global.preferences.filter(p => p.userId !== userId);
    global.preferences.push({ userId, email, sms, app });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

export default function handler(req, res) {
  global.notifications = global.notifications || [];

  if (req.method === 'PATCH') {
    const { userId } = req.body;
    global.notifications = global.notifications.map(n =>
      n.userId === userId ? { ...n, read: true } : n
    );
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

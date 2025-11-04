const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { signToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Use passwordHash per Prisma schema; fallback to password for backwards compatibility
    const hashed = user.passwordHash || user.password;
    if (!hashed) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, hashed);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ userId: user.id, role: user.role });

    // safe user object to return
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.fullName || user.name || null,
      role: user.role
    };

    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error('[AUTH LOGIN]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
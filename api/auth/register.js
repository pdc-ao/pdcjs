const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { signToken } = require('../../lib/jwt');

require('dotenv').config();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, name, role } = req.body || {};

    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashed,
        fullName: name || undefined,
        role: role || undefined
      },
      select: { id: true, email: true, fullName: true, role: true }
    });

    const token = signToken({ userId: user.id, role: user.role });

    const safeUser = { id: user.id, email: user.email, name: user.fullName || null, role: user.role };
    return res.status(201).json({ user: safeUser, token });
  } catch (err) {
    console.error('[AUTH REGISTER]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
// -----------------------------------------------------------------------------
// src/auth/register.js
// -----------------------------------------------------------------------------
// Registers a new user, creates a unique username, returns the user data + JWT.
// -----------------------------------------------------------------------------
// NOTE: This file lives in `src/auth/`, so the Prisma client and JWT helper are
// imported with `../../lib/...` (two levels up). If you ever move the file, adjust
// the relative path accordingly.
// -----------------------------------------------------------------------------

const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');          // ← correct path
const { signToken } = require('../../lib/jwt');       // ← correct path
require('dotenv').config();

/**
 * Helper – generate a unique username based on the e‑mail prefix.
 * If the base name already exists, we add a random 4‑digit suffix (e.g. “john‑1234”)
 * and retry until the value is free.
 */
async function generateUniqueUsername(base) {
  // First try the plain base; many users will be fine with that.
  let candidate = base;
  let exists = await prisma.user.findUnique({ where: { username: candidate } });

  // If it already exists, keep adding a numeric suffix until we find one.
  while (exists) {
    // Generate a short random 4‑digit number (0000‑9999)
    const suffix = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    candidate = `${base}-${suffix}`;
    // Check again
    exists = await prisma.user.findUnique({ where: { username: candidate } });
  }
  return candidate;
}

// -----------------------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// -----------------------------------------------------------------------------
module.exports = async (req, res) => {
  // --------------------------------------------------------------
  // Only POST is allowed for registration
  // --------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --------------------------------------------------------------
    // 1️⃣  Pull data from the request body (the global catch‑all already parsed JSON)
    // --------------------------------------------------------------
    const { email, password, name, role } = req.body || {};

    // ---- Basic validation ------------------------------------------------
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    // --------------------------------------------------------------
    // 2️⃣  Guard against duplicate e‑mail (unique in the schema)
    // --------------------------------------------------------------
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // --------------------------------------------------------------
    // 3️⃣  Hash the password
    // --------------------------------------------------------------
    const hashed = await bcrypt.hash(password, 10);

    // --------------------------------------------------------------
    // 4️⃣  Build a unique username
    // --------------------------------------------------------------
    const baseUsername = email.split('@')[0];
    const username = await generateUniqueUsername(baseUsername);

    // --------------------------------------------------------------
    // 5️⃣  Create the new user record
    // --------------------------------------------------------------
    const user = await prisma.user.create({
      data: {
        email: email.trim(),
        passwordHash: hashed,
        fullName: name?.trim() || undefined,
        role: role?.trim() || undefined,
        username,
      },
      // Return only the fields we need for the client – never the password hash!
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        username: true,
      },
    });

    // --------------------------------------------------------------
    // 6️⃣  Issue a JWT (you already have a `signToken` helper)
    // --------------------------------------------------------------
    const token = signToken({ userId: user.id, role: user.role });

    // --------------------------------------------------------------
    // 7️⃣  Shape the response exactly as the front‑end expects
    // --------------------------------------------------------------
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.fullName || null,
      role: user.role,
      username: user.username,
    };

    return res.status(201).json({ user: safeUser, token });
  } catch (err) {
    console.error('[AUTH REGISTER]', err);
    // Keep the generic message for security (no stack trace to the client)
    return res.status(500).json({ error: 'Internal server error' });
  }
};

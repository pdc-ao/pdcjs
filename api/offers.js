// ---------------------------------------------------------------------------
// api/offers.js
// ---------------------------------------------------------------------------
// Handles POST /api/offers  – creates a new Offering for the logged‑in user.
// ---------------------------------------------------------------------------

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper – read the whole request body and JSON‑parse it.
 * (Exactly the same code you used in the old file; kept here to stay self‑contained.)
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * POST handler – called by the catch‑all wrapper.
 * The wrapper passes (req, res, params) and expects either:
 *   • nothing (handler wrote the response itself) or
 *   • a plain object/value (wrapper will JSON‑stringify it).
 */
async function POST(req, res) {
  // -------------------------------------------------
  // 1️⃣  Parse body
  // -------------------------------------------------
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (e) {
    // Bad JSON → 400
    res.statusCode = 400;
    return { error: 'Invalid JSON payload' };
  }

  const { title, description, status } = body;

  // -------------------------------------------------
  // 2️⃣  Basic validation
  // -------------------------------------------------
  if (!title || !description) {
    res.statusCode = 400;
    return { error: 'title and description are required' };
  }

  // The Offering model does **not** have an enum for status,
  // you can store any string you like (e.g. "Ativo" / "Inativo").
  const safeStatus = status?.trim() ? status.trim() : 'Ativo';

  // -------------------------------------------------
  // 3️⃣  Identify the user that is creating the offering.
  // -------------------------------------------------
  // You said you already have a JWT stored in localStorage
  // (pdc_auth_token).  If you protect this endpoint you can
  // decode it here.  For the sake of a quick demo we’ll just
  // read the user‑id from a custom header “x-user-id”.
  const userId = req.headers['x-user-id']; // <-- adjust to your auth logic

  if (!userId) {
    res.statusCode = 401;
    return { error: 'Unauthenticated – missing user id' };
  }

  // -------------------------------------------------
  // 4️⃣  Persist with Prisma
  // -------------------------------------------------
  try {
    const newOffering = await prisma.offering.create({
      data: {
        title,
        description,
        // we keep the column name exactly as in the schema
        // (status column does NOT exist – you can store it in description,
        // or add a new column later.  For now we’ll save it in a JSON field
        // called `metadata` if you want to keep it.)
        ownerId: userId,
        // OPTIONAL: if you want to keep the status you can add a JSON column
        // `metadata: { status: safeStatus }` – omit if you don’t have it.
      },
    });

    // -------------------------------------------------
    // 5️⃣  Return the created record
    // -------------------------------------------------
    // Setting the status here makes the wrapper send 201 instead of 200.
    res.statusCode = 201;
    return newOffering;
  } catch (e) {
    console.error('[api/offers] DB error →', e);
    res.statusCode = 500;
    return { error: 'Database error while creating the offering' };
  }
}

// Export the verb map – the catch‑all will look for `POST`.
module.exports = { POST };

// api/offers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function POST(req, res) {
  // parse body
  let body = {};
  try {
    body = await new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => (raw += chunk));
      req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
      req.on('error', reject);
    });
  } catch {
    return sendJson(res, { error: 'Invalid JSON' }, 400);
  }

  const { title, description, status } = body;
  if (!title || !description) {
    return sendJson(res, { error: 'title & description required' }, 400);
  }

  try {
    const newOffer = await prisma.offer.create({
      data: {
        title,
        description,
        status: status ?? 'Ativo',
      },
    });
    return sendJson(res, newOffer, 201);
  } catch (err) {
    console.error('[offers] DB error:', err);
    return sendJson(res, { error: 'Database error' }, 500);
  }
}

module.exports = { POST };

// ================================================================
// api/documents/upload.js – Document Upload API (POST only)
// ---------------------------------------------------------------
// Expected multipart/form-data with fields:
//   - docType (e.g. ID_CARD, LICENSE, OTHER)
//   - file    (PDF / JPG / PNG)
// ---------------------------------------------------------------
// Returns the created Document record (including a temporary fileUrl)
// ================================================================

const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');
require('dotenv').config();


const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const cuid = require('cuid');   // ✅ correct import

// tiny json helper – same style as the other API files
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// -----------------------------------------------------------------
// Helper – extract Bearer token either from Authorization header or
// from the `pdc_auth_token` cookie (so the front‑end can keep using its
// existing cookie without adding an explicit header).
// -----------------------------------------------------------------
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];

  const cookie = req.headers.cookie || '';
  const match = cookie.match(/pdc_auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// -----------------------------------------------------------------
// Main exported handler – Vercel calls it with (req, res)
// -----------------------------------------------------------------
module.exports = async (req, res) => {
  // -------------------------------------------------
  // CORS (same as all other API files)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣ Authenticate – token can come from header or cookie
  // -------------------------------------------------
  const token = extractToken(req);
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (e) {
    return json(res, { error: 'Invalid token' }, 401);
  }

  const userId = payload.userId;

  // -------------------------------------------------
  // 2️⃣ Only POST is supported
  // -------------------------------------------------
  if (req.method !== 'POST') {
    return json(res, { error: 'Method not allowed' }, 405);
  }

  // -------------------------------------------------
  // 3️⃣ Parse multipart/form-data with Busboy
  // -------------------------------------------------
  const contentType = req.headers['content-type'];
  if (!contentType?.startsWith('multipart/form-data')) {
    return json(res, { error: 'Content-Type must be multipart/form-data' }, 400);
  }

  const busboy = new Busboy({ headers: req.headers });
  const fields = {};
  let fileInfo = null; // { path, size, mime, name }

  // ---- Collect fields -------------------------------------------------
  busboy.on('field', (fieldname, val) => {
    fields[fieldname] = val;
  });

  // ---- Collect file ---------------------------------------------------
  const tmpDir = '/tmp';
  await new Promise((resolve, reject) => {
    busboy.on('file', (fieldname, file, filename, encoding, mimeType) => {
      if (!filename) {
        // No file selected
        file.resume(); // discard
        return;
      }

      const id = cuid(); // unique id for the document
      const safeName = path.basename(filename).replace(/\s+/g, '_');
      const tmpPath = path.join(tmpDir, `${id}-${safeName}`);

      const writeStream = fs.createWriteStream(tmpPath);
      let fileSize = 0;

      file.on('data', chunk => (fileSize += chunk.length));
      file.pipe(writeStream);

      writeStream.on('finish', () => {
        fileInfo = {
          id,
          path: tmpPath,
          size: fileSize,
          mime: mimeType,
          name: filename,
        };
      });

      writeStream.on('error', reject);
    });

    busboy.on('error', reject);
    busboy.on('finish', resolve);
    req.pipe(busboy);
  });

  // -------------------------------------------------
  // 4️⃣ Validate required fields
  // -------------------------------------------------
  const docType = fields.docType;
  if (!docType) return json(res, { error: 'docType field is required' }, 400);
  if (!fileInfo) return json(res, { error: 'File is required' }, 400);

  // -------------------------------------------------
  // 5️⃣ Create Document record in Prisma
  // -------------------------------------------------
  try {
    const doc = await prisma.document.create({
      data: {
        id: fileInfo.id,
        userId,
        type: docType,
        fileName: fileInfo.name,
        fileUrl: fileInfo.path,          // temporary URL – you can replace with a CDN URL later
        fileKey: null,                   // not used in this demo
        fileSize: fileInfo.size,
        mimeType: fileInfo.mime,
        status: 'PENDING',               // enum DocumentStatus default
        // optional fields (leave null)
        relatedEntityId: null,
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    // Return the created document (including status)
    return json(res, doc, 201);
  } catch (e) {
    console.error('[documents upload] →', e);
    return json(res, { error: 'Server error while saving document' }, 500);
  }
};

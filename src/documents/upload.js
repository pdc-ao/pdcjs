// ---------------------------------------------------------------------------
// src/upload.js – Document Upload API (fixed race condition)
// ---------------------------------------------------------------------------

const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const cuid = require('cuid'); // already installed

/* -------------------------------------------------------------------------
   Tiny JSON helper (same style as the other API files)
   ------------------------------------------------------------------------- */
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

/* -------------------------------------------------------------------------
   Helper – extract Bearer token from header **or** cookie
   ------------------------------------------------------------------------- */
function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];

  const cookie = req.headers.cookie || '';
  const match = cookie.match(/pdc_auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/* -------------------------------------------------------------------------
   Main exported handler – Vercel calls it with (req, res)
   ------------------------------------------------------------------------- */
module.exports = async (req, res) => {
  // -------------------------------------------------
  // CORS (same as all other API files)
  // -------------------------------------------------
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.end();

  // -------------------------------------------------
  // 1️⃣  Authenticate – token can be in header OR cookie
  // -------------------------------------------------
  const token = extractToken(req);
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch (_) {
    return json(res, { error: 'Invalid token' }, 401);
  }
  const userId = payload.userId;

  // -------------------------------------------------
  // 2️⃣  Only POST is supported
  // -------------------------------------------------
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  // -------------------------------------------------
  // 3️⃣  Verify Content‑Type = multipart/form‑data
  // -------------------------------------------------
  const contentType = req.headers['content-type'];
  if (!contentType?.startsWith('multipart/form-data')) {
    return json(res, { error: 'Content-Type must be multipart/form-data' }, 400);
  }

  // -------------------------------------------------
  // 4️⃣  Parse multipart/form‑data with Busboy
  // -------------------------------------------------
  const busboy = new Busboy({ headers: req.headers });
  const fields = {};
  let fileInfo = null;                 // will hold { id, path, size, mime, name }
  const tmpDir = '/tmp';

  // ---- Collect normal fields (e.g. docType) ------------------------------
  busboy.on('field', (fieldname, val) => {
    fields[fieldname] = val;
  });

  // ---- Collect the uploaded file -----------------------------------------
  busboy.on('file', (fieldname, file, filename, encoding, mimeType) => {
    if (!filename) {
      // User didn’t pick a file → just discard the stream
      file.resume();
      return;
    }

    const id = cuid(); // unique document identifier
    const safeName = path.basename(filename).replace(/\s+/g, '_');
    const tmpPath = path.join(tmpDir, `${id}-${safeName}`);

    const writeStream = fs.createWriteStream(tmpPath);
    let fileSize = 0;

    file.on('data', chunk => (fileSize += chunk.length));
    file.pipe(writeStream);

    // ---- When the write is *finished* we store the metadata ----------
    writeStream.on('close', () => {
      // `close` fires after the underlying fd is closed, guaranteeing that
      // the file is fully persisted on disk.
      fileInfo = {
        id,
        path: tmpPath,
        size: fileSize,
        mime: mimeType,
        name: filename,
      };
    });

    writeStream.on('error', err => {
      console.error('[upload] writeStream error', err);
      // Propagate to the outer promise via rejection
      busboy.emit('error', err);
    });
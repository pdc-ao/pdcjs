const prisma = require('../../lib/prisma');
const { verifyToken } = require('../../lib/jwt');
const fs = require('fs');
const path = require('path');
const Busboy = require('busboy');
const cuid = require('cuid'); // ✅ correct import

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function extractToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.split(' ')[1];
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/pdc_auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  const token = extractToken(req);
  if (!token) return json(res, { error: 'Missing token' }, 401);

  let payload;
  try { payload = verifyToken(token); } catch { return json(res, { error: 'Invalid token' }, 401); }
  const userId = payload.userId;

  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const contentType = req.headers['content-type'];
  if (!contentType?.startsWith('multipart/form-data')) return json(res, { error: 'Content-Type must be multipart/form-data' }, 400);

  const busboy = new Busboy({ headers: req.headers });
  const fields = {};
  let fileInfo = null;
  const tmpDir = '/tmp';

  await new Promise((resolve, reject) => {
    busboy.on('field', (fieldname, val) => { fields[fieldname] = val; });
    busboy.on('file', (fieldname, file, filename, encoding, mimeType) => {
      if (!filename) return file.resume();
      const id = cuid();
      const safeName = path.basename(filename).replace(/\s+/g, '_');
      const tmpPath = path.join(tmpDir, `${id}-${safeName}`);
      const writeStream = fs.createWriteStream(tmpPath);
      let fileSize = 0;
      file.on('data', chunk => (fileSize += chunk.length));
      file.pipe(writeStream);
      writeStream.on('finish', () => {
        fileInfo = { id, path: tmpPath, size: fileSize, mime: mimeType, name: filename };
      });
      writeStream.on('error', reject);
    });
    busboy.on('error', reject);
    busboy.on('finish', resolve);
    req.pipe(busboy);
  });

  if (!fields.docType) return json(res, { error: 'docType field is required' }, 400);
  if (!fileInfo) return json(res, { error: 'File is required' }, 400);

  try {
    const doc = await prisma.document.create({
      data: {
        id: fileInfo.id,
        userId,
        type: fields.docType,
        fileName: fileInfo.name,
        fileUrl: fileInfo.path, // temporary
        fileSize: fileInfo.size,
        mimeType: fileInfo.mime,
        status: 'PENDING'
      }
    });
    return json(res, doc, 201);
  } catch (e) {
    console.error('[documents upload] →', e);
    return json(res, { error: 'Server error while saving document' }, 500);
  }
};

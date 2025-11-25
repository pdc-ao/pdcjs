// =============================================================
// api/[...slug].js – ONE catch‑all Vercel Function
// -------------------------------------------------------------
// * Resolves any /api/* request to a handler that lives **outside**
//   the /api folder (archived‑api/, src/... etc.).
// * Parses JSON bodies and adds tiny Express‑style shims
//   (res.status, res.json) so legacy handlers keep working.
// * Handles folder‑index routes (e.g. /api/products → archived‑api/products/index.js).
// * Sends proper CORS headers (required for browser calls).
// * Keeps the Hobby‑plan limit: ONLY THIS file lives in /api.
// =============================================================

const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ------------------------------------------------------------------
// 1️⃣ Tiny JSON helper (same as every other API file)
// ------------------------------------------------------------------
function json(res, payload, status = 200) {
  if (res.headersSent) return;                 // guard against double‑send
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ------------------------------------------------------------------
// 2️⃣ CORS helper (required for front‑end calls)
// ------------------------------------------------------------------
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ------------------------------------------------------------------
// 3️⃣ Parse a JSON body (used by legacy handlers)
// ------------------------------------------------------------------
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
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

// ------------------------------------------------------------------
// 4️⃣ Main exported Vercel handler
// ------------------------------------------------------------------
module.exports = async function (req, res) {
  // ---------- CORS & pre‑flight ----------
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // ---------- Parse the incoming URL ----------
  const parsed   = url.parse(req.url || '');
  const clean    = (parsed.pathname || '')
    .replace(/^\/api\/?/, '')   // strip leading "/api"
    .replace(/^\/+/, '');       // remove any extra leading slash
  const slugArray = clean ? clean.split('/').filter(Boolean) : [];

  // keep legacy compatibility (some old handlers read req._slugArray)
  req._slugArray = slugArray;

  // ---------- Body parsing for POST/PUT/PATCH ----------
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      req.body = await parseJsonBody(req);
    } catch (e) {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }
  }

  // ---------- Tiny Express‑style shims (so old handlers keep working) ----------
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code;
      return this;                     // chainable
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (payload) {
      return json(this, payload, this.statusCode || 200);
    };
  }

  // ---------- Resolve the file that should handle this request ----------
  // Build the absolute path inside the lambda bundle.
  // process.cwd() = repository root when the lambda runs.
  let targetFile = path.join(process.cwd(), 'archived-api', ...slugArray);

  // If the path points to a directory → use its index.js
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory()) {
    targetFile = path.join(targetFile, 'index.js');
  } else {
    // Otherwise make sure we have the .js extension
    if (!targetFile.endsWith('.js')) {
      targetFile = targetFile + '.js';
    }
  }

  // DEBUG – appears in the Vercel Function logs
  console.log('[API] resolved ->', { file: targetFile, exists: fs.existsSync(targetFile) });
  // ---------- Load & execute the handler ----------
  if (fs.existsSync(targetFile)) {
    try {
      const mod = require(targetFile);               // legacy handlers export a function
      // The handler can be:
      //   - a plain function (module.exports = async (req,res)=>{…})
      //   - an ES‑module default export
      //   - an object with .handler or verb methods (GET, POST …)
      if (typeof mod === 'function') return mod(req, res);
      if (mod && typeof mod.default === 'function') return mod.default(req, res);
      if (mod && typeof mod.handler === 'function') return mod.handler(req, res);
      if (mod && typeof mod[req.method] === 'function') return mod[req.method](req, res);

      // If we got here the module didn’t export anything we can call
      return json(res, { error: 'Handler did not send a response' }, 500);
    } catch (e) {
      console.error('[API loader error]', e);
      return json(res, { error: 'Failed to load handler' }, 500);
    }
  }

  // ---------- Nothing matched → 404 ----------
  return json(res, { error: 'Not found' }, 404);
};

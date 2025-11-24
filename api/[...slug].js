// ---------------------------------------------------------------
// api/[...slug].js – single catch‑all Vercel Function
// ---------------------------------------------------------------
// It resolves ANY request (/api/*) to a handler that lives **outside**
// the api folder (e.g. archived‑api/, src/api‑handlers/, …)
// This keeps the Hobby‑plan limit to ONE function.
// ---------------------------------------------------------------

const fs   = require('fs');
const path = require('path');
const url  = require('url');

// -------------------------------------------------
// 1️⃣ Tiny helpers (exactly the same shape you used before)
// -------------------------------------------------
function sendJson(res, payload, status = 200) {
  // If the response was already sent, do nothing – prevents
  // “ERR_HTTP_HEADERS_SENT”.
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// CORS – needed for static assets that call the API from the same origin
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
}

// -------------------------------------------------
// 2️⃣ Body parser (used by legacy handlers)
// -------------------------------------------------
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

// -------------------------------------------------
// 3️⃣ Helpers that walk the external folders and match patterns
// -------------------------------------------------
let cachedFileList = null;
function getAllJsFiles(baseDir) {
  if (cachedFileList) return cachedFileList;
  const walk = dir => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walk(full));
      else if (e.isFile() && e.name.endsWith('.js')) files.push(full);
    }
    return files;
  };
  cachedFileList = walk(baseDir);
  return cachedFileList;
}
function pathToPattern(fullPath, rootDir) {
  const rel = path.relative(rootDir, fullPath).replace(/\.js$/i, '');
  return rel.split(path.sep);
}
function matchPattern(pattern, segments) {
  if (pattern.length !== segments.length) return { matched: false };
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const s = segments[i];
    if (p.startsWith('[') && p.endsWith(']')) {
      params[p.slice(1, -1)] = s;
    } else if (p !== s) {
      return { matched: false };
    }
  }
  return { matched: true, params };
}

// -------------------------------------------------
// 4️⃣ Resolve the correct JS file (new api folder first, then external folders)
// -------------------------------------------------
function resolveHandler(segments) {
  const apiRoot = path.join(__dirname); // physical folder api/
  const tryCandidates = [];

  // ---- fast path – new‑api files that already sit in /api/ ----
  const first = segments[0] || '';
  if (first === 'products') {
    if (segments.length === 2) {
      tryCandidates.push(path.join(apiRoot, 'products', '[id].js'));
    } else {
      tryCandidates.push(path.join(apiRoot, 'products', 'index.js'));
    }
  } else if (first === 'auth') {
    if (segments[1]) tryCandidates.push(path.join(apiRoot, 'auth', `${segments[1]}.js`));
  } else if (first === 'orders') {
    tryCandidates.push(path.join(apiRoot, 'orders', 'index.js'));
  } else {
    // generic: <first>.js  or  <first>/index.js
    tryCandidates.push(path.join(apiRoot, `${first}.js`));
    tryCandidates.push(path.join(apiRoot, first, 'index.js'));
  }

  for (const p of tryCandidates) if (fs.existsSync(p)) return { file: p, params: {} };

  // ---- fallback – look in external folders (archived‑api, src‑handlers, etc.) ----
  const externalBases = [
    path.join(__dirname, '..', 'archived-api'),      // ← your historic folder
    // Add more external roots here if you create a new folder for fresh handlers
    // path.join(__dirname, '..', 'src', 'api-handlers')
  ];

  for (const base of externalBases) {
    const allJs = getAllJsFiles(base);
    const sorted = allJs.sort((a, b) => {
      const al = pathToPattern(a, base).length;
      const bl = pathToPattern(b, base).length;
      return bl - al; // longest (most specific) first
    });

    for (const filePath of sorted) {
      const pattern = pathToPattern(filePath, base);
      const { matched, params } = matchPattern(pattern, segments);
      if (matched) return { file: filePath, params };
    }
  }

  // nothing matched → 404
  return null;
}

// -------------------------------------------------
// 5️⃣ Execute the exported handler (CommonJS or ESM)
// -------------------------------------------------
async function executeHandler(mod, req, res, params) {
  // keep the original compatibility
  req.params = params || {};

  // 1️⃣ module itself is a function (default export)
  if (typeof mod === 'function') return mod(req, res);
  if (mod && typeof mod.default === 'function') return mod.default(req, res);

  // 2️⃣ verb‑specific exports (GET, POST, …)
  const method = req.method.toUpperCase();
  if (mod && typeof mod[method] === 'function') return mod[method](req, res);

  // 3️⃣ object with a `handler` field
  if (mod && typeof mod.handler === 'function') return mod.handler(req, res);

  // nothing we can call
  return null;
}

// -------------------------------------------------
// 6️⃣ Main exported Vercel handler
// -------------------------------------------------
module.exports = async function (req, res) {
  // ----- CORS & pre‑flight -----
  setCors(res);
  if (req.method === 'OPTIONS') return (res.statusCode = 200), res.end();

  // ----- Resolve URL -----
  const parsed   = url.parse(req.url || '');
  const clean    = (parsed.pathname || '').replace(/^\/api\/?/, '').replace(/^\/+/, '');
  const segments = clean ? clean.split('/').filter(Boolean) : [];

  // keep old compatibility (some old code used _slugArray)
  req._slugArray = segments;

  // ----- Find the handler file -----
  const resolved = resolveHandler(segments);
  if (!resolved) return sendJson(res, { error: 'Not found' }, 404);

  const { file: handlerPath, params } = resolved;

  try {
    // ----- Load the module (CommonJS first, fallback to ESM) -----
    let mod;
    try {
      mod = require(handlerPath);
    } catch (e) {
      // ESM file → dynamic import
      mod = await import(handlerPath);
    }

    // ----- Run the handler -----
    const result = await executeHandler(mod, req, res, params);

    // If the handler already wrote a response, stop here.
    if (res.headersSent) return;

    // If the handler returned a plain object/array, send it as JSON.
    if (result !== null && result !== undefined && typeof result === 'object') {
      return sendJson(res, result);
    }

    // No response & no payload → internal error (helps debugging)
    return sendJson(res, { error: 'Handler did not send a response' }, 500);
  } catch (err) {
    console.error('[API error] path:', handlerPath, err);
    // Guard against double‑send – if the handler already wrote something we don't touch it.
    if (!res.headersSent) return sendJson(res, { error: err.message || 'Internal server error' }, 500);
  }
};

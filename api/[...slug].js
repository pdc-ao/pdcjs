// =============================================================
// api/[...slug].js – ONE catch‑all Vercel Function
// -------------------------------------------------------------
// * Resolves any /api/* request to a handler that lives **outside**
//   the /api folder (archived‑api/, src/... etc.).
// * Parses JSON bodies and adds tiny Express‑style shims
//   (res.status, res.json) so legacy handlers keep working.
// * Protects against double‑sending (res.headersSent).
// * Keeps the Hobby‑plan limit: ONLY THIS file lives in /api.
// =============================================================

const fs   = require('fs');
const path = require('path');
const url  = require('url');

// -------------------------------------------------
// 1️⃣ Tiny JSON helper (same as every other API file)
// -------------------------------------------------
function json(res, payload, status = 200) {
  // If the response was already sent, just ignore – prevents
  // “ERR_HTTP_HEADERS_SENT”.
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// -------------------------------------------------
// 2️⃣ CORS helper (required for front‑end calls)
// -------------------------------------------------
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
// 3️⃣ Parse a JSON body (used by legacy handlers)
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
// 4️⃣ Helpers that walk external folders & match patterns
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
function matchPattern(pattern, segs) {
  if (pattern.length !== segs.length) return { matched: false };
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const s = segs[i];
    if (p.startsWith('[') && p.endsWith(']')) {
      params[p.slice(1, -1)] = s;
    } else if (p !== s) {
      return { matched: false };
    }
  }
  return { matched: true, params };
}

// -------------------------------------------------
// 5️⃣ Resolve the correct handler file
// -------------------------------------------------
function resolveHandler(segments) {
  const apiRoot = path.join(__dirname); // /api folder (where this file lives)

  // ---------- fast‑path – files that already sit inside /api ----------
  const first = segments[0] || '';
  const tryCandidates = [];

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

  // ---------- fallback – look in external folders (archived‑api, etc.) ----------
  const externalBases = [
    path.join(__dirname, '..', 'archived-api'), // ← your historic folder
    // Add more roots here if you create a new “handlers” folder, e.g.
    // path.join(__dirname, '..', 'src', 'api-handlers')
  ];

  for (const base of externalBases) {
    const allJs = getAllJsFiles(base);
    // longest (most specific) pattern first
    const sorted = allJs.sort((a, b) => {
      const al = pathToPattern(a, base).length;
      const bl = pathToPattern(b, base).length;
      return bl - al;
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
// 6️⃣ Execute a handler (CommonJS or ESM)
// -------------------------------------------------
async function executeHandler(mod, req, res, params) {
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
// 7️⃣ Main exported Vercel handler
// -------------------------------------------------
module.exports = async function (req, res) {
  // ----------- CORS & pre‑flight ------------
  setCors(res);
  if (req.method === 'OPTIONS') return (res.statusCode = 200), res.end();

  // ----------- Parse URL ----------
  const parsed   = url.parse(req.url || '');
  const clean    = (parsed.pathname || '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+/, '');
  const segments = clean ? clean.split('/').filter(Boolean) : [];

  // keep old compatibility for legacy code that used _slugArray
  req._slugArray = segments;

  // ----------- Body parsing for JSON (POST/PUT/PATCH) ----------
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      req.body = await parseJsonBody(req);
    } catch (e) {
      // malformed JSON
      return json(res, { error: 'Invalid JSON body' }, 400);
    }
  }

  // ----------- Tiny Express‑style shims ----------
  // Some old handlers do `res.status(...).json(...)`.
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code;
      return this; // allow chaining
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (payload) {
      // if a previous handler already ended the response, just ignore
      return json(this, payload, this.statusCode || 200);
    };
  }

  // ----------- Resolve the handler ----------
  const resolved = resolveHandler(segments);
  if (!resolved) return json(res, { error: 'Not found' }, 404);

  const { file: handlerPath, params } = resolved;

  try {
    // ----------- Load the module (CommonJS preferred) ----------
    let mod;
    try {
      mod = require(handlerPath); // fast sync require
    } catch (e) {
      // If the file is an ES‑module fall back to dynamic import
      mod = await import(handlerPath);
    }

    // ----------- Execute ----------
    const result = await executeHandler(mod, req, res, params);

    // If the handler already sent a response, stop here.
    if (res.headersSent) return;

    // If the handler returned a plain object/array, send it as JSON.
    if (result !== null && result !== undefined && typeof result === 'object') {
      return json(res, result);
    }

    // No response & no payload → internal error (helps debugging)
    return json(res, { error: 'Handler did not send a response' }, 500);
  } catch (err) {
    console.error('[API error] path:', handlerPath, err);
    // Guard against double‑send
    if (!res.headersSent) return json(res, { error: err.message || 'Internal server error' }, 500);
  }
};

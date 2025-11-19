// api/[...slug].js
// --------------------------------------------------------------
// A single catch‑all Vercel Function that resolves *any* API
// route, including the historic "archived‑api" files that have
// unconventional names like src_app_api_*_route.js.
// --------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const url = require('url');

// ------- 1️⃣ Helpers -------------------------------------------------
function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// CORS – Vercel static assets call the API from the same origin,
// but we still need to answer pre‑flight requests.
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

// Parse body to JSON (used by both CommonJS & ESM handlers)
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

// Build a list of *all* .js files under a directory (cached at cold start)
let cachedFileList = null;
function getAllJsFiles(baseDir) {
  if (cachedFileList) return cachedFileList;
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walk(full));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(full);
      }
    }
    return files;
  };
  cachedFileList = walk(baseDir);
  return cachedFileList;
}

// Turn a filesystem path into a pattern array (e.g. "payments/transactions/[id]/events.js")
function pathToPattern(fullPath, rootDir) {
  const rel = path.relative(rootDir, fullPath); // e.g. "payments/transactions/[id]/events.js"
  const withoutExt = rel.replace(/\.js$/i, '');
  return withoutExt.split(path.sep); // array of segments
}

// Try to match request segments against a pattern.
// Returns { matched: true, params: {...} } or { matched: false }
function matchPattern(patternSegments, requestSegments) {
  if (patternSegments.length !== requestSegments.length) return { matched: false };
  const params = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const pat = patternSegments[i];
    const seg = requestSegments[i];
    if (pat.startsWith('[') && pat.endsWith(']')) {
      // wildcard – store without brackets
      const key = pat.slice(1, -1);
      params[key] = seg;
    } else if (pat !== seg) {
      return { matched: false };
    }
  }
  return { matched: true, params };
}

// -------------------------------------------------
// 2️⃣ Resolve the correct handler file
// -------------------------------------------------
function resolveHandler(segments) {
  // -------------------------------------------------
  // 1️⃣  Look in the *new* api folder first (the same rules you already had)
  // -------------------------------------------------
  const apiRoot = path.join(__dirname);   // <-- this is the physical folder api/
  const tryCandidates = [];

  // -----------------------------------------------------------------
  // a) Direct file: api/<first>.js
  // b) Folder + index.js: api/<first>/index.js
  // c) Special mapping for products, auth, orders (kept from your original code)
  // -----------------------------------------------------------------
  const first = segments[0] || '';
  if (first === 'products') {
    if (segments.length === 2) {
      tryCandidates.push(path.join(apiRoot, 'products', '[id].js'));
    } else {
      tryCandidates.push(path.join(apiRoot, 'products', 'index.js'));
    }
  } else if (first === 'auth') {
    if (segments[1]) {
      tryCandidates.push(path.join(apiRoot, 'auth', `${segments[1]}.js`));
    }
  } else if (first === 'orders') {
    tryCandidates.push(path.join(apiRoot, 'orders', 'index.js'));
  } else {
    // generic attempts (e.g. /messages → api/messages/index.js)
    tryCandidates.push(path.join(apiRoot, `${first}.js`));
    tryCandidates.push(path.join(apiRoot, first, 'index.js'));
  }

  // If any of the candidates exist we are done – this is the fastest path.
  for (const p of tryCandidates) {
    if (fs.existsSync(p)) return { file: p, params: {} };
  }

  // -------------------------------------------------
  // 2️⃣  Fall‑back to external folders (archived‑api *or* the new handlers folder)
  // -------------------------------------------------
  // Add every base you want the resolver to search here.
  const externalBases = [
    // Legacy fallback that already existed
    path.join(__dirname, '..', 'archived-api'),

    // 👉 NEW: the folder where you moved *all* real handlers
    //    (you can rename it to whatever you like – just keep the same path here)
    path.join(__dirname, '..', 'src', 'api-handlers')
  ];

  // Walk **each** external base, collect every .js file, and try to match it.
  for (const base of externalBases) {
    // Build a flat list of every .js file under this base (cached on first use)
    const allJs = getAllJsFiles(base);

    // Sort so the most‑specific pattern wins (longer path = more specific)
    const sorted = allJs.sort((a, b) => {
      const aLen = pathToPattern(a, base).length;
      const bLen = pathToPattern(b, base).length;
      return bLen - aLen;           // descending
    });

    // Try each file – the first match wins
    for (const filePath of sorted) {
      const pattern = pathToPattern(filePath, base); // e.g. ['messages', 'index']
      const { matched, params } = matchPattern(pattern, segments);
      if (matched) {
        return { file: filePath, params };
      }
    }
  }

  // -------------------------------------------------
  // 3️⃣ Nothing matched → let the caller return a 404
  // -------------------------------------------------
  return null;
}

// -------------------------------------------------
// 3️⃣ Execute a handler (CommonJS or ESM)
// -------------------------------------------------
async function executeHandler(mod, req, res, params) {
  // Attach params to the request object (the original code expected `req._slugArray`, we add `req.params` as well)
  req.params = params || {};

  // 1️⃣ If the module itself is a function (CommonJS default export)
  if (typeof mod === 'function') {
    return mod(req, res);
  }
  if (mod && typeof mod.default === 'function') {
    return mod.default(req, res);
  }

  // 2️⃣ If the module exports verb‑specific functions (GET, POST, …)
  const method = req.method.toUpperCase();
  if (mod && typeof mod[method] === 'function') {
    return mod[method](req, res);
  }

  // 3️⃣ If the module exports an object with a `handler` field (some older files do this)
  if (mod && typeof mod.handler === 'function') {
    return mod.handler(req, res);
  }

  // If we get here, we don’t know how to call the module.
  return null;
}

// -------------------------------------------------
// 4️⃣ Main exported Vercel handler
// -------------------------------------------------
module.exports = async function (req, res) {
  // ----------- CORS & OPTIONS -------------
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.statusCode = 200, res.end();
  }

  // ----------- Parse URL ------------------
  const parsed = url.parse(req.url || '');
  const cleanPath = (parsed.pathname || '').replace(/^\/api\/?/, '').replace(/^\/+/, '');
  const segments = cleanPath ? cleanPath.split('/').filter(Boolean) : [];

  // Store original slug (kept for backward compatibility with some old handlers)
  req._slugArray = segments;

  // ----------- Resolve handler -------------
  const resolved = resolveHandler(segments);
  if (!resolved) {
    return sendJson(res, { error: 'Not found' }, 404);
  }

  const { file: handlerPath, params } = resolved;

  try {
    // ----------- Load the module -----------
    // Prefer CommonJS `require` (fast) – fallback to dynamic `import` for ESM files.
    let mod;
    try {
      mod = require(handlerPath);
    } catch (e) {
      // If require fails because the file is ESM, use import()
      mod = await import(handlerPath);
    }

    // ----------- Execute it -----------------
    const result = await executeHandler(mod, req, res, params);
    if (result !== null && result !== undefined) {
      // handler already wrote to `res`
      return;
    }

    // If handler returned something that is plain JSON, send it.
    if (typeof result === 'object') {
      return sendJson(res, result);
    }

    // If we reach here, the handler didn't respond.
    return sendJson(res, { error: 'Handler did not send a response' }, 500);
  } catch (err) {
    console.error('[API error] path:', handlerPath, err);
    return sendJson(res, { error: err.message || 'Internal server error' }, 500);
  }
};

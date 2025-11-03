// Consolidated catch-all API to reduce Vercel function count.
// Place this at api/[...slug].js (root-level api folder).
// It delegates requests to existing handler modules under api/*
// Supports:
// - CommonJS style modules that export module.exports = async (req,res)
// - ESM-style modules that export named handlers like GET/POST (will be invoked using the Request object fallback)

const path = require('path');
const url = require('url');

function tryCallCommonJs(mod, req, res) {
  // mod may be { default: fn } for CommonJS when imported via dynamic import; but here we require directly
  if (typeof mod === 'function') {
    return mod(req, res);
  }
  if (mod && typeof mod.default === 'function') {
    return mod.default(req, res);
  }
  return null;
}

async function tryCallEsm(mod, method, req, res) {
  // ESM handlers might export async function GET(request) { ... }
  // Create a minimal Request-like object for ESM handlers (Request API)
  const requestLike = {
    url: req.url,
    headers: req.headers,
    method: req.method,
    json: async () => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    },
    formData: async () => {
      // Not implemented for multipart in this catch-all; handlers that need formData should be adapted.
      throw new Error('formData not supported in consolidated catch-all');
    }
  };

  const fn = mod && (mod[method] || mod[method.toUpperCase()]);
  if (typeof fn === 'function') {
    try {
      const result = await fn(requestLike, { params: { slug: req._slugArray } });
      // If handler returned a NextResponse-like object, attempt to send JSON if appropriate
      if (result && typeof result.json === 'function') {
        // NextResponse-like: serialize JSON
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(await result.json()));
        return true;
      }
      // If handler returned plain object or array, send as JSON
      if (result && (typeof result === 'object' || Array.isArray(result))) {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result));
        return true;
      }
    } catch (err) {
      console.error('[catch-all -> ESM handler error]', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message || 'handler error' }));
      return true;
    }
  }
  return false;
}

function sendJson(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function (req, res) {
  // path segments after /api/
  const parsed = url.parse(req.url || '');
  const base = parsed.pathname || '';
  // remove leading "/api/" or leading '/'
  const rel = base.replace(/^\/api\/?/, '').replace(/^\/+/, '');
  const segments = rel === '' ? [] : rel.split('/').filter(Boolean);

  // keep on req so ESM fallback can see it
  req._slugArray = segments;

  // map first segment to handler
  const first = segments[0] || '';
  let handlerPath;

  // Special mapping rules for routes with [id] files:
  if (first === 'products') {
    if (segments.length === 2) {
      handlerPath = path.join(__dirname, 'products', '[id].js');
    } else {
      handlerPath = path.join(__dirname, 'products', 'index.js');
    }
  } else if (first === 'auth') {
    // /api/auth/login or /api/auth/register
    if (segments[1]) {
      handlerPath = path.join(__dirname, 'auth', `${segments[1]}.js`);
    } else {
      // fallback to listing or error
      handlerPath = null;
    }
  } else if (first === 'orders') {
    handlerPath = path.join(__dirname, 'orders', 'index.js');
  } else {
    // fallback: try to load a file at api/<first>/index.js or api/<first>.js
    const tryIndex = path.join(__dirname, first, 'index.js');
    const tryTop = path.join(__dirname, `${first}.js`);
    // prefer directory index
    handlerPath = tryIndex;
    try {
      require.resolve(handlerPath);
    } catch (e1) {
      try {
        require.resolve(tryTop);
        handlerPath = tryTop;
      } catch (e2) {
        handlerPath = null;
      }
    }
  }

  if (!handlerPath) {
    return sendJson(res, { error: 'Not found' }, 404);
  }

  // Attempt require (CommonJS)
  try {
    const mod = require(handlerPath);

    // If module is an express-style handler (module.exports = async (req,res))
    const invoked = tryCallCommonJs(mod, req, res);
    if (invoked !== null) return invoked;

    // If module has named handlers (unlikely for CommonJS here), try by method name
    const methodName = req.method.toUpperCase();
    if (mod && typeof mod[methodName] === 'function') {
      return mod[methodName](req, res);
    }
  } catch (err) {
    // require failed; try dynamic import (ESM) as a fallback
    // We'll continue to ESM import below.
  }

  // Fallback: dynamic import (ESM-style modules)
  try {
    const mod = await import(handlerPath);
    const used = await tryCallEsm(mod, req.method, req, res);
    if (used) return;
  } catch (err) {
    console.error('[catch-all import error]', err);
    return sendJson(res, { error: 'Handler load error' }, 500);
  }

  // If we reach here, we couldn't handle it
  return sendJson(res, { error: 'Handler could not process request' }, 500);
};
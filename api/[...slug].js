// Consolidated catch-all API to reduce Vercel function count.
// Place this at api/[...slug].js (root-level api folder).
// It delegates requests to existing handler modules under api/* or archived-api/*
// Supports:
// - CommonJS style modules that export module.exports = async (req,res)
// - ESM-style modules that export named handlers like GET/POST (will be invoked using the Request object fallback)

const path = require('path');
const url = require('url');

function tryCallCommonJs(mod, req, res) {
  if (typeof mod === 'function') {
    return mod(req, res);
  }
  if (mod && typeof mod.default === 'function') {
    return mod.default(req, res);
  }
  return null;
}

async function tryCallEsm(mod, method, req, res) {
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
      throw new Error('formData not supported in consolidated catch-all');
    }
  };

  const fn = mod && (mod[method] || mod[method.toUpperCase()]);
  if (typeof fn === 'function') {
    try {
      const result = await fn(requestLike, { params: { slug: req._slugArray } });
      if (result && typeof result.json === 'function') {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(await result.json()));
        return true;
      }
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
  const parsed = url.parse(req.url || '');
  const base = parsed.pathname || '';
  const rel = base.replace(/^\/api\/?/, '').replace(/^\/+/, '');
  const segments = rel === '' ? [] : rel.split('/').filter(Boolean);

  req._slugArray = segments;

  const first = segments[0] || '';
  let handlerPath;

  // Special mapping rules
  if (first === 'products') {
    if (segments.length === 2) {
      handlerPath = path.join(__dirname, 'products', '[id].js');
    } else {
      handlerPath = path.join(__dirname, 'products', 'index.js');
    }
  } else if (first === 'auth') {
    if (segments[1]) {
      handlerPath = path.join(__dirname, 'auth', `${segments[1]}.js`);
    } else {
      handlerPath = null;
    }
  } else if (first === 'orders') {
    handlerPath = path.join(__dirname, 'orders', 'index.js');
  } else {
    // try inside api/
    const tryIndex = path.join(__dirname, first, 'index.js');
    const tryTop = path.join(__dirname, `${first}.js`);
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

    // NEW: fallback to archived-api if not found
    if (!handlerPath) {
      const externalBases = [
        path.join(__dirname, '..', 'archived-api'),
        path.join(__dirname, '..', 'lib', 'api-handlers')
      ];
      for (const base of externalBases) {
        const candidates = [
          path.join(base, first, 'index.js'),
          path.join(base, `${first}.js`),
          path.join(base, `${first}.route.js`),
          path.join(base, `${first}.index.js`)
        ];
        for (const candidate of candidates) {
          try {
            require.resolve(candidate);
            handlerPath = candidate;
            break;
          } catch (err) {}
        }
        if (handlerPath) break;
      }
    }
  }

  if (!handlerPath) {
    return sendJson(res, { error: 'Not found' }, 404);
  }

  try {
    const mod = require(handlerPath);
    const invoked = tryCallCommonJs(mod, req, res);
    if (invoked !== null) return invoked;
    const methodName = req.method.toUpperCase();
    if (mod && typeof mod[methodName] === 'function') {
      return mod[methodName](req, res);
    }
  } catch (err) {
    // fallback to dynamic import
  }

  try {
    const mod = await import(handlerPath);
    const used = await tryCallEsm(mod, req.method, req, res);
    if (used) return;
  } catch (err) {
    console.error('[catch-all import error]', err);
    return sendJson(res, { error: 'Handler load error' }, 500);
  }

  return sendJson(res, { error: 'Handler could not process request' }, 500);
};

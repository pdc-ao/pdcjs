// =============================================================
// src/index.js – ONE catch‑all Vercel Function
// -------------------------------------------------------------
// Routes all incoming requests to the correct handler in /src.
// Keeps Hobby plan limit: only this file is deployed as a function.
// =============================================================

const url = require('url');

// Helpers
function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Main handler
module.exports = async function (req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const parsed = url.parse(req.url || '');
  const pathname = parsed.pathname || '/';
  const segments = pathname.replace(/^\/+/, '').split('/');

  // Express‑style shims
  res.status = code => { res.statusCode = code; return res; };
  res.json = payload => json(res, payload, res.statusCode || 200);

  // Routing
  try {
    if (segments[0] === 'api') {
      switch (segments[1]) {
        case 'storage':
          return require('./storage')(req, res);
        case 'facilities':
          return require('./facilities')(req, res);
        case 'transformation':
          return require('./transformation')(req, res);
        case 'transport':
          return require('./transport')(req, res);
        case 'production':
          return require('./production')(req, res);
        case 'notifications':
          return require('./notifications')(req, res);
        case 'messages':
          return require('./messages')(req, res);
        case 'admin':
          return require('./admin')(req, res);
        case 'auth':
          if (segments[2] === 'login') return require('./auth/login')(req, res);
          if (segments[2] === 'register') return require('./auth/register')(req, res);
          break;
        case 'documents':
          if (segments[2] === 'upload') return require('./documents/upload')(req, res);
          break;
        default:
          return res.status(404).json({ error: 'Unknown API route' });
      }
    }

    // Root route
    if (pathname === '/' || pathname === '') {
      res.statusCode = 200;
      return res.end('API root is alive');
    }

    // Favicon
    if (pathname === '/favicon.ico') {
      res.statusCode = 204; // no content
      return res.end();
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[Router error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

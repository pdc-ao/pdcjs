// =============================================================
// src/index.js – ONE catch‑all Vercel Function (fixed syntax)
// -------------------------------------------------------------
// Resolves any /api/* request to a handler inside src/ or archived-api/
// =============================================================

const fs = require('fs');
const path = require('path');
const url = require('url');

// ------------------------------------------------------------------
// JSON helper
// ------------------------------------------------------------------
function json(res, payload, status = 200) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

// ------------------------------------------------------------------
// CORS helper
// ------------------------------------------------------------------
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ------------------------------------------------------------------
// Parse JSON body
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
// Main exported Vercel handler
// ------------------------------------------------------------------
module.exports = async function (req, res) {
  // ---------- CORS & pre‑flight ----------
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // ---------- Parse the incoming URL ----------
  const parsed = url.parse(req.url || '');
  const clean = (parsed.pathname || '')
    .replace(/^\/api\/?/, '')
    .replace(/^\/+/, '');
  const slugArray = clean ? clean.split('/').filter(Boolean) : [];

  req._slugArray = slugArray;

  // ---------- Body parsing ----------
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      req.body = await parseJsonBody(req);
    } catch (e) {
      return json(res, { error: 'Invalid JSON body' }, 400);
    }
  }

  // ---------- Express‑style shims ----------
  if (typeof res.status !== 'function') {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (payload) {
      return json(this, payload, this.statusCode || 200);
    };
  }

  // ----------------------------------------------------------------
  // Try internal handler (src/)
  // ----------------------------------------------------------------
  let internalFile = path.join(process.cwd(), 'src', ...slugArray);
  if (fs.existsSync(internalFile) && fs.statSync(internalFile).isDirectory()) {
    internalFile = path.join(internalFile, 'index.js');
  } else if (!internalFile.endsWith('.js')) {
    internalFile = internalFile + '.js';
  }

  console.log('[API] try internal ->', internalFile);
  if (fs.existsSync(internalFile)) {
    try {
      const mod = require(internalFile);
      if (typeof mod === 'function') return mod(req, res);
      if (mod?.default instanceof Function) return mod.default(req, res);
      if (mod?.handler instanceof Function) return mod.handler(req, res);
      if (mod?.[req.method] instanceof Function) return mod[req.method](req, res);
      return json(res, { error: 'Handler did not send a response' }, 500);
    } catch (e) {
      console.error('[API] internal load error', e);
      return json(res, { error: 'Failed to load internal handler' }, 500);
    }
  }

  // ----------------------------------------------------------------
  // Fallback external handler (archived-api/)
  // ----------------------------------------------------------------
  let externalFile = path.join(process.cwd(), 'archived-api', ...slugArray);
  if (fs.existsSync(externalFile) && fs.statSync(externalFile).isDirectory()) {
    externalFile = path.join(externalFile, 'index.js');
  } else if (!externalFile.endsWith('.js')) {
    externalFile = externalFile + '.js';
  }

  console.log('[API] try external ->', externalFile);
  if (fs.existsSync(externalFile)) {
    try {
      const mod = require(externalFile);
      if (typeof mod === 'function') return mod(req, res);
      if (mod?.default instanceof Function) return mod.default(req, res);
      if (mod?.handler instanceof Function) return mod.handler(req, res);
      if (mod?.[req.method] instanceof Function) return mod[req.method](req, res);
      return json(res, { error: 'Handler did not send a response' }, 500);
    } catch (e) {
      console.error('[API] external load error', e);
      return json(res, { error: 'Failed to load external handler' }, 500);
    }
  }

  // ----------------------------------------------------------------
  // Nothing matched → 404
  // ----------------------------------------------------------------
  return json(res, { error: 'Not found' }, 404);
}; // <-- This closing brace was likely missing

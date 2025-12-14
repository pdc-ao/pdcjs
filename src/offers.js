// ---------------------------------------------------------------------------
// src/offers.js – Offers (Serviços) API
// ---------------------------------------------------------------------------
// End‑points:
//   POST /api/offers → create a new offering (service)
//   GET  /api/offers → list all offerings (optional, for debugging)
// ---------------------------------------------------------------------------

/* --------------------------------------------------------------
   1️⃣  Imports – NOTE the correct path is "../lib/…" because
   this file lives in src/ (one folder below the project root).
   -------------------------------------------------------------- */
   const prisma = require('../lib/prisma');          // ← corrected
   const { verifyToken } = require('../lib/jwt');   // ← corrected
   require('dotenv').config();                        // loads JWT secret, DB URL, etc.
   
   /* --------------------------------------------------------------
      2️⃣  Tiny JSON helper (same as other API files)
      -------------------------------------------------------------- */
   function json(res, payload, status = 200) {
     res.statusCode = status;
     res.setHeader('Content-Type', 'application/json; charset=utf-8');
     res.end(JSON.stringify(payload));
   }
   
   /* -----------------------------------------------------------------
      3️⃣  Main exported handler – Vercel calls it with (req, res)
      ----------------------------------------------------------------- */
   module.exports = async (req, res) => {
     // --------------------------------------------------------------
     // CORS (already added by the global catch‑all, but keep for safety)
     // --------------------------------------------------------------
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
   
     if (req.method === 'OPTIONS') return res.end();
   
     // --------------------------------------------------------------
     // 1️⃣  Authenticate – required for both POST and GET
     // --------------------------------------------------------------
     const authHeader = req.headers.authorization || '';
     const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
     if (!token) return json(res, { error: 'Missing token' }, 401);
   
     let payload;
     try {
       payload = verifyToken(token);          // must contain at least { userId }
     } catch (e) {
       return json(res, { error: 'Invalid token' }, 401);
     }
     const userId = payload.userId;           // will become the `ownerId`
   
     // --------------------------------------------------------------
     // 2️⃣  POST /api/offers – create a new offering
     // --------------------------------------------------------------
     if (req.method === 'POST' && req.url === '/api/offers') {
       // ---- Parse JSON body (same pattern you used elsewhere) ----
       let body;
       try {
         body = await new Promise((resolve, reject) => {
           let raw = '';
           req.on('data', chunk => (raw += chunk));
           req.on('end', () => {
             try {
               resolve(raw ? JSON.parse(raw) : {});
             } catch (e) {
               reject(e);
             }
           });
           req.on('error', reject);
         });
       } catch (_) {
         return json(res, { error: 'Invalid JSON body' }, 400);
       }
   
       // ---- Validate required fields ---------------------------------
       const { title, description, status } = body;
       if (!title || !description) {
         return json(res, { error: 'title & description are required' }, 400);
       }
   
       // ---- Create the offering (the DB model only knows title,
       //      description and ownerId) ---------------------------------
       try {
         const newOffering = await prisma.offering.create({
           data: {
             title,
             description,
             ownerId: userId,
           },
           // Return the generated id so the UI can show it if needed
           select: { id: true, title: true, description: true, ownerId: true },
         });
   
         // The front‑end expects a `status` field, even though it isn’t stored
         // in the DB. We simply echo back what the client sent (default “Ativo”).
         const result = {
           id: newOffering.id,
           title: newOffering.title,
           description: newOffering.description,
           status: status || 'Ativo',
           ownerId: newOffering.ownerId,
         };
   
         return json(res, result, 201); // 201 – Created
       } catch (e) {
         console.error('[api/offers] DB error →', e);
         // Duplicate‑key (e.g. same title) → 409 Conflict
         if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
         return json(res, { error: 'Server error while creating offering' }, 500);
       }
     }
   
     // --------------------------------------------------------------
     // 3️⃣  GET /api/offers – list all offerings (optional, for debugging)
     // --------------------------------------------------------------
     if (req.method === 'GET' && req.url === '/api/offers') {
       try {
         const all = await prisma.offering.findMany({
           select: { id: true, title: true, description: true, ownerId: true },
           orderBy: { createdAt: 'desc' },
         });
         return json(res, { data: all });
       } catch (e) {
         console.error('[api/offers] GET error →', e);
         return json(res, { error: 'Server error while fetching offerings' }, 500);
       }
     }
   
     // --------------------------------------------------------------
     // 4️⃣  Anything else → 405 Method Not Allowed
     // --------------------------------------------------------------
     return json(res, { error: 'Method not allowed' }, 405);
   };
   
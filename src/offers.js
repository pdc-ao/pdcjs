// ---------------------------------------------------------------------------
// src/offers.js – Offers (Serviços) API
// ---------------------------------------------------------------------------
// End‑points:
//   POST /api/offers → create a new offering (service)
//   GET  /api/offers → list all offerings (optional, for debugging)
// ---------------------------------------------------------------------------

/* --------------------------------------------------------------
   1️⃣  Imports – the same pattern used everywhere else in the project
   -------------------------------------------------------------- */
   const prisma = require('../../lib/prisma');           // ← two levels up from src/
   const { verifyToken } = require('../../lib/jwt');    // ← same
   require('dotenv').config();                         // loads JWT secret, DB URL, etc.
   
   /* --------------------------------------------------------------
      2️⃣  Tiny JSON helper (identical to the other API files)
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
     /* --------------------------------------------------------------
        CORS – the global catch‑all already adds these headers,
        but we keep them for safety.
        -------------------------------------------------------------- */
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
   
     if (req.method === 'OPTIONS') return res.end();
   
     /* --------------------------------------------------------------
        4️⃣  Authenticate – required for both POST and GET
        -------------------------------------------------------------- */
     const authHeader = req.headers.authorization || '';
     const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
     if (!token) return json(res, { error: 'Missing token' }, 401);
   
     let payload;
     try {
       payload = verifyToken(token);          // must contain at least { userId }
     } catch (e) {
       return json(res, { error: 'Invalid token' }, 401);
     }
     const userId = payload.userId;            // will become the `ownerId`
   
     /* --------------------------------------------------------------
        5️⃣  POST /api/offers – create a new offering
        -------------------------------------------------------------- */
     if (req.method === 'POST' && req.url === '/api/offers') {
       // ---- Parse the JSON body (the global catch‑all already does this,
       //      but we keep a tiny manual version for robustness) ----
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
   
       // ---- Required fields (title & description) --------------------
       const { title, description, status } = body;
       if (!title || !description) {
         return json(res, { error: 'title & description are required' }, 400);
       }
   
       // ---- Create the offering (only title, description, ownerId exist in the schema)
       try {
         const newOffering = await prisma.offering.create({
           data: {
             title,
             description,
             ownerId: userId,            // link to the logged‑in user
           },
           // Return the generated id as well – helpful for the UI
           select: { id: true, title: true, description: true, ownerId: true },
         });
   
         // --------------------------------------------------------------
         // The UI expects a `status` field, but the DB model does not have one.
         // We simply echo back the status the client sent (default = "Ativo").
         // If you later add a `status` column, replace the line below with
         // `status: status ?? 'Ativo'` inside `data: { … }`.
         // --------------------------------------------------------------
         const result = {
           id: newOffering.id,
           title: newOffering.title,
           description: newOffering.description,
           status: status || 'Ativo',
           ownerId: newOffering.ownerId,
         };
   
         return json(res, result, 201);   // 201 – Created
       } catch (e) {
         console.error('[api/offers] DB error →', e);
         // Unique‑constraint violation (e.g. duplicate title) → 409
         if (e.code === 'P2002') return json(res, { error: 'Duplicate entry' }, 409);
         return json(res, { error: 'Server error while creating offering' }, 500);
       }
     }
   
     /* --------------------------------------------------------------
        6️⃣  GET /api/offers – list all offerings (optional)
        -------------------------------------------------------------- */
     if (req.method === 'GET' && req.url === '/api/offers') {
       try {
         const all = await prisma.offering.findMany({
           select: { id: true, title: true, description: true, ownerId: true },
           orderBy: { createdAt: 'desc' },
         });
         // The UI (if you ever call it) will receive an array under `data`
         return json(res, { data: all });
       } catch (e) {
         console.error('[api/offers] GET error →', e);
         return json(res, { error: 'Server error while fetching offerings' }, 500);
       }
     }
   
     /* --------------------------------------------------------------
        7️⃣  Anything else → 405 Method Not Allowed
        -------------------------------------------------------------- */
     return json(res, { error: 'Method not allowed' }, 405);
   };
   
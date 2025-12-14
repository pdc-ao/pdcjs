/* -------------------------------------------------------------------------
   js/dashboard.js – shared client‑side helpers (ESM)
   -------------------------------------------------------------------------
   Functions already used throughout the app:
   - getSession, logout, renderUserInfo
   - fetchJSON, escapeHtml
   - renderProductCard, showToast
   -------------------------------------------------------------------------
   Added for the Procurement demo (localStorage based):
   - getData(key)                → read a JSON array from localStorage
   - addItem(key, item)          → push a new object into that array
   - updateItem(key, id, patch)  → shallow‑merge changes into an existing item
   ------------------------------------------------------------------------- */

/* -------------------------------------------------------------
   1️⃣ Session & UI helpers (unchanged)
   ------------------------------------------------------------- */
   export function getSession() {
    try {
      const raw = localStorage.getItem('pdc_user_data');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('getSession parse error', e);
      return null;
    }
  }
  
  export function logout() {
    localStorage.removeItem('pdc_user_data');
    localStorage.removeItem('pdc_auth_token');
    location.href = 'auth.html';
  }
  
  export function renderUserInfo(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      const user = getSession();
      if (!user) {
        el.innerHTML = 'Nenhuma sessão encontrada. <a href="auth.html">Entrar</a>';
      } else {
        el.textContent = `${user.name || user.email} — ${user.role || ''}`;
      }
    } catch (e) {
      console.error('renderUserInfo', e);
    }
  }
  
  /* -------------------------------------------------------------
     2️⃣ Fetch helper (unchanged)
     ------------------------------------------------------------- */
  export async function fetchJSON(url, opts = {}) {
    const headers = new Headers(opts.headers || {});
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const token = localStorage.getItem('pdc_auth_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  
    const res = await fetch(url, { ...opts, headers });
  
    if (!res.ok) {
      let body = null;
      try { body = await res.json(); } catch (_) { body = null; }
      const err = new Error(body?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
  
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }
  
  /* -------------------------------------------------------------
     3️⃣ Misc helpers (unchanged)
     ------------------------------------------------------------- */
  export function escapeHtml(str) {
    return String(str || '').replace(
      /[&<>"']/g,
      s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
    );
  }
  
  /* -------------------------------------------------------------
     4️⃣ UI block helpers (unchanged)
     ------------------------------------------------------------- */
  export function renderProductCard(p) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div>
        <h3 class="card-title">${escapeHtml(p.title)}</h3>
        <p class="muted">${escapeHtml(p.category || '')}</p>
        <p class="card-desc">${escapeHtml(p.description || '')}</p>
      </div>
      <div class="card-footer">
        <div class="price">${p.pricePerUnit} ${escapeHtml(p.currency || 'AOA')}</div>
        <a class="btn btn-sm btn-primary" href="product-detail.html?id=${encodeURIComponent(p.id)}">Ver Detalhes</a>
      </div>
    `;
    return el;
  }
  
  /* -------------------------------------------------------------
     5️⃣ Toast helper (unchanged)
     ------------------------------------------------------------- */
  export function showToast(message, type = 'info', timeout = 3500) {
    try {
      let toast = document.getElementById('pdc_toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pdc_toast';
        toast.style.position = 'fixed';
        toast.style.right = '16px';
        toast.style.bottom = '16px';
        toast.style.zIndex = 99999;
        document.body.appendChild(toast);
      }
      const node = document.createElement('div');
      node.style.background = type === 'error'
        ? '#dc3545'
        : (type === 'success' ? '#28a745' : '#333');
      node.style.color = '#fff';
      node.style.padding = '8px 12px';
      node.style.borderRadius = '6px';
      node.style.marginTop = '8px';
      node.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
      node.textContent = message;
      toast.appendChild(node);
      setTimeout(() => node.remove(), timeout);
    } catch (e) {
      console.log('toast', message);
    }
  }
  
  /* -------------------------------------------------------------
     6️⃣ PROCUREMENT DEMO STORAGE HELPERS
     -------------------------------------------------------------
     All three helpers work with a JSON array stored in `localStorage`
     under a chosen key (e.g. “pdc_procurements_demo”). They are pure
     client‑side utilities – no network requests.
     ------------------------------------------------------------- */
  export function getData(key) {
    const raw = localStorage.getItem(key);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn(`getData(${key}) JSON parse error`, e);
      return [];
    }
  }
  
  /**
   * Add a new object to the array stored under `key`.
   * The function guards against duplicate `id`s – if an item with the same
   * `id` already exists it silently ignores the call.
   */
  export function addItem(key, item) {
    if (!item || typeof item !== 'object') {
      console.warn('addItem – invalid item', item);
      return;
    }
    const arr = getData(key);
  
    // ---- Prevent accidental double‑clicks that would create the same ID ----
    if (arr.some(it => it.id === item.id)) {
      console.warn(`addItem – item with id ${item.id} already exists – skipping`);
      return;
    }
  
    arr.push(item);
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.error(`addItem(${key}) failed`, e);
    }
  }
  
  /**
   * Update a stored object that matches `id`.
   * `patch` is a shallow object with the fields you want to change.
   */
  export function updateItem(key, id, patch) {
    if (!id) {
      console.warn('updateItem – missing id');
      return;
    }
    const arr = getData(key);
    const idx = arr.findIndex(it => it.id === id);
    if (idx === -1) {
      console.warn(`updateItem – item with id ${id} not found`);
      return;
    }
    // shallow merge
    arr[idx] = { ...arr[idx], ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.error(`updateItem(${key}) failed`, e);
    }
  }
  
  /* -------------------------------------------------------------------------
     End of file – all exported helpers are now available for any page that
     does:
     import {
       getSession,
       logout,
       renderUserInfo,
       fetchJSON,
       escapeHtml,
       renderProductCard,
       showToast,
       getData,
       addItem,
       updateItem
     } from './js/dashboard.js';
     ------------------------------------------------------------------------- */
  
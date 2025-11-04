/**
 * ESM API client for the project.
 * Import from pages that use `type="module"`, e.g.:
 *   import API, { login, getProducts } from './js/api-client.js';
 *
 * - Exports a full set of functions covering auth, products, orders, payments,
 *   wallet, messages, facilities, storage, transport, documents and admin endpoints.
 * - Uses a robust fetchJSON implementation that:
 *   - Attaches Bearer token from localStorage automatically
 *   - Preserves FormData uploads (does not set Content-Type for FormData)
 *   - Returns parsed JSON when available
 *   - On 401 it clears session and redirects to auth page (with redirect param)
 *
 * NOTE: adapt endpoint paths if your server uses different routes (this client
 * assumes the server API sits under /api and the endpoints described in the repo).
 */

const API_BASE = '/api';
const TOKEN_KEY = 'pdc_auth_token';
const USER_KEY = 'pdc_user_data';

function safeParse(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
function setToken(token) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
}
function setUser(user) {
  try { if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY); } catch (e) {}
}
function logoutAndRedirect(redirectTo) {
  setUser(null);
  setToken(null);
  const redirect = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
  window.location.href = `/auth.html${redirect}`;
}

/**
 * fetchJSON: central HTTP helper
 * - url: full path or endpoint relative to API_BASE
 * - opts: fetch options, may include body as object (will be stringified), or FormData (sent raw)
 */
export async function fetchJSON(url, opts = {}) {
  const fullUrl = url.startsWith('http') ? url : (API_BASE + url);
  const token = getToken();

  const headers = new Headers(opts.headers || {});
  const method = (opts.method || 'GET').toUpperCase();
  let body = opts.body;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body && typeof body === 'object') {
    // assume JSON
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(fullUrl, { method, headers, body, credentials: opts.credentials || 'same-origin' });

  const text = await res.text();
  const data = safeParse(text);

  if (res.status === 401) {
    // Unauthorized: clear session and redirect to login preserving current path
    logoutAndRedirect(window.location.pathname + window.location.search);
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  // return parsed JSON when present, otherwise text
  if (data !== null) return data;
  return text;
}

// ---- Auth ----
export async function login(email, password) {
  const data = await fetchJSON('/auth/login', { method: 'POST', body: { email, password } });
  if (data?.token && data?.user) {
    setToken(data.token);
    setUser(data.user);
  }
  return data;
}
export async function register(payload) {
  // payload: { email, password, name, role, ... }
  const data = await fetchJSON('/auth/register', { method: 'POST', body: payload });
  if (data?.token && data?.user) {
    setToken(data.token);
    setUser(data.user);
  }
  return data;
}
export function logout() {
  setToken(null);
  setUser(null);
  // Optionally call server logout endpoint if exists:
  // fetchJSON('/auth/logout', { method: 'POST' }).catch(()=>{});
  window.location.href = '/auth.html';
}
export function getCurrentUser() { return getUser(); }
export function getAuthToken() { return getToken(); }

// ---- Products ----
export function listProducts(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/products?${qs}`);
}
export function getProduct(id) {
  return fetchJSON(`/products/${encodeURIComponent(id)}`);
}
export function createProduct(payload) {
  return fetchJSON('/products', { method: 'POST', body: payload });
}
export function updateProduct(id, payload) {
  return fetchJSON(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
}
export function deleteProduct(id) {
  return fetchJSON(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---- Orders ----
export function listOrders(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/orders?${qs}`);
}
export function createOrder(payload) {
  return fetchJSON('/orders', { method: 'POST', body: payload });
}
export function updateOrderStatus(id, status) {
  return fetchJSON(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

// ---- Payments / Escrow / Transactions ----
export function listTransactions(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/payments/transactions?${qs}`);
}
export function getTransaction(id) {
  return fetchJSON(`/payments/transactions/${encodeURIComponent(id)}`);
}
export function actOnTransaction(id, action) {
  return fetchJSON(`/payments/transactions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { action } });
}
export function getTransactionEvents(id) {
  return fetchJSON(`/payments/transactions/${encodeURIComponent(id)}/events`);
}

// ---- Wallet ----
export function getWallet() { return fetchJSON('/wallet'); }
export function getWalletTransactions() { return fetchJSON('/wallet/transactions'); }
export function creditWallet(amount, meta = {}) { return fetchJSON('/wallet/credit', { method: 'POST', body: { amount, meta } }); }
export function debitWallet(amount, meta = {}) { return fetchJSON('/wallet/debit', { method: 'POST', body: { amount, meta } }); }

// ---- Messages ----
export function listMessages(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/messages?${qs}`);
}
export function sendMessage(payload) {
  // payload: { receiverId, messageContent, conversationId? }
  return fetchJSON('/messages', { method: 'POST', body: payload });
}

// ---- Documents / Uploads ----
export async function uploadDocument(formData /* FormData */) {
  // must not set Content-Type for FormData; fetchJSON handles FormData but here we explicitly do it
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(API_BASE + '/documents/upload', { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const text = await res.text();
    const body = safeParse(text);
    const err = new Error((body && (body.error || body.message)) || res.statusText || `HTTP ${res.status}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  const txt = await res.text();
  const data = safeParse(txt);
  return data !== null ? data : txt;
}

// ---- Facilities / Storage / Transport ----
export function listFacilities(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJSON(`/facilities?${qs}`);
}
export function getFacility(id) { return fetchJSON(`/facilities/${encodeURIComponent(id)}`); }
export function createFacility(payload) { return fetchJSON('/facilities', { method: 'POST', body: payload }); }
export function updateFacility(id, payload) { return fetchJSON(`/facilities/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload }); }

export function listStorage(params = {}) { const qs = new URLSearchParams(params).toString(); return fetchJSON(`/storage?${qs}`); }
export function getStorage(id) { return fetchJSON(`/storage/${encodeURIComponent(id)}`); }
export function createStorage(payload) { return fetchJSON('/storage', { method: 'POST', body: payload }); }

export function listTransport(params = {}) { const qs = new URLSearchParams(params).toString(); return fetchJSON(`/transport?${qs}`); }
export function getTransport(id) { return fetchJSON(`/transport/${encodeURIComponent(id)}`); }
export function requestTransport(payload) { return fetchJSON('/transport', { method: 'POST', body: payload }); }

// ---- Admin endpoints ----
export function adminListUsers(params = {}) { const qs = new URLSearchParams(params).toString(); return fetchJSON(`/admin/users?${qs}`); }
export function adminSuspendUser(id) { return fetchJSON(`/admin/users/${encodeURIComponent(id)}/suspend`, { method: 'POST' }); }
export function adminListVerifications(params = {}) { const qs = new URLSearchParams(params).toString(); return fetchJSON(`/admin/verification?${qs}`); }
export function adminPatchVerification(id, status, notes = '') { return fetchJSON(`/admin/verification/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status, notes } }); }

// ---- Utility ----
export function ensureAuthOrRedirect() {
  if (!getToken()) {
    const redirect = window.location.pathname + window.location.search;
    window.location.href = `/auth.html?redirect=${encodeURIComponent(redirect)}`;
    return false;
  }
  return true;
}

// Default export: convenience API object
const API = {
  // auth
  login, register, logout, getCurrentUser: getUser, getAuthToken: getToken,
  // products
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  // orders
  listOrders, createOrder, updateOrderStatus,
  // payments
  listTransactions, getTransaction, actOnTransaction, getTransactionEvents,
  // wallet
  getWallet, getWalletTransactions, creditWallet, debitWallet,
  // messages
  listMessages, sendMessage,
  // documents
  uploadDocument,
  // facilities/storage/transport
  listFacilities, getFacility, createFacility, updateFacility,
  listStorage, getStorage, createStorage,
  listTransport, getTransport, requestTransport,
  // admin
  adminListUsers, adminSuspendUser, adminListVerifications, adminPatchVerification,
  // helpers
  fetchJSON, ensureAuthOrRedirect
};

export default API;
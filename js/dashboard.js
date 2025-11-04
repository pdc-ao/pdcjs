// Client helpers (ESM) used by pages that import with `type="module"`

export function getSession() {
  try {
    const raw = localStorage.getItem('pdc_user_data');
    if (!raw) return null;
    return JSON.parse(raw);
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
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// Small helpers that pages can use temporarily; for production pages you should call the API instead
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
    node.style.background = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#333');
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
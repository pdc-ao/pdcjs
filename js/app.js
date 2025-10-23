(function () {
  'use strict';

  // --- Config ---
  const CONFIG = {
    API_BASE_URL: '/api',
    TOKEN_KEY: 'pdc_auth_token',
    USER_KEY: 'pdc_user_data'
  };

  // --- App State ---
  const AppState = {
    user: null,
    isAuthenticated: false,

    init() {
      const token = localStorage.getItem(CONFIG.TOKEN_KEY);
      const user = localStorage.getItem(CONFIG.USER_KEY);
      if (token && user) {
        this.user = JSON.parse(user);
        this.isAuthenticated = true;
      }
    },

    saveUser(user, token) {
      this.user = user;
      this.isAuthenticated = true;
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    },

    clearUser() {
      this.user = null;
      this.isAuthenticated = false;
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
    },

    getToken() {
      return localStorage.getItem(CONFIG.TOKEN_KEY);
    }
  };

  // --- Fetch Wrapper ---
  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(json?.error || res.statusText);
      return json;
    } catch (err) {
      if (res.ok) return text;
      throw err;
    }
  }

  // --- API ---
  const API = {
    async request(endpoint, options = {}) {
      const token = AppState.getToken();
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetchJSON(`${CONFIG.API_BASE_URL}${endpoint}`, { ...options, headers });
    },

    getProducts(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/products?${qs}`);
    },

    getWallet() {
      return this.request('/wallet');
    },

    getOrders(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/orders?${qs}`);
    }
  };

  // --- UI ---
  const UI = {
    showToast(msg, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = msg;
      Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: type === 'error' ? '#ef4444' : '#10b981',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        zIndex: 9999
      });
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  // --- Validator ---
  const Validator = {
    required(v) { return v.trim() !== ''; },
    email(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  };

  // --- Helpers ---
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function getDemoSession() {
    return AppState.user || { id: 'demo-user', name: 'Demo Produtor' };
  }

  function renderSimpleGrid(containerId, products) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';
    if (!products || products.length === 0) {
      grid.innerHTML = '<div class="muted">Nenhum produto encontrado.</div>';
      return;
    }
    products.forEach(p => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h3>${escapeHtml(p.title || '—')}</h3>
        <p class="muted">${escapeHtml((p.description || '').slice(0, 100))}</p>
        <div class="card-footer">
          <span class="price">${escapeHtml(String(p.pricePerUnit || '—'))} ${escapeHtml(p.currency || 'AOA')}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // --- Expose globally if needed ---
  window.PDC = { AppState, API, UI, Validator };
  window.getDemoSession = getDemoSession;
  window.renderSimpleGrid = renderSimpleGrid;

  // --- Init ---
  AppState.init();
})();

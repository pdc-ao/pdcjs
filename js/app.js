// js/app.js
(function () {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    API_BASE_URL: '/api',
    STORAGE_KEY: 'pdc_app_state',
    TOKEN_KEY: 'pdc_auth_token',
    USER_KEY: 'pdc_user_data'
  };

  // --- App State ---
  const AppState = {
    user: null,
    isAuthenticated: false,
    currentPage: '',

    init() {
      const token = localStorage.getItem(CONFIG.TOKEN_KEY);
      const userData = localStorage.getItem(CONFIG.USER_KEY);
      if (token && userData) {
        this.user = JSON.parse(userData);
        this.isAuthenticated = true;
      }
    },

    saveUser(userData, token) {
      this.user = userData;
      this.isAuthenticated = true;
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(userData));
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
  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(json?.error || res.statusText || 'Erro');
      return json;
    } catch (err) {
      if (res.ok) return text;
      throw err;
    }
  }

  // --- API Service ---
  const API = {
    async request(endpoint, options = {}) {
      const token = AppState.getToken();
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetchJSON(`${CONFIG.API_BASE_URL}${endpoint}`, { ...options, headers });
    },

    login(email, password) {
      return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },
    register(userData) {
      return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
    },
    logout() {
      return this.request('/auth/logout', { method: 'POST' });
    },

    getProducts(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/products?${qs}`);
    },
    getProduct(id) {
      return this.request(`/products/${id}`);
    },
    createProduct(data) {
      return this.request('/products', { method: 'POST', body: JSON.stringify(data) });
    },
    updateProduct(id, data) {
      return this.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteProduct(id) {
      return this.request(`/products/${id}`, { method: 'DELETE' });
    },

    getOrders(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/orders?${qs}`);
    },
    createOrder(data) {
      return this.request('/orders', { method: 'POST', body: JSON.stringify(data) });
    },
    updateOrderStatus(id, status) {
      return this.request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    },

    getWallet() {
      return this.request('/wallet');
    },
    getTransactions() {
      return this.request('/wallet/transactions');
    },
    addFunds(amount, method) {
      return this.request('/wallet/add-funds', { method: 'POST', body: JSON.stringify({ amount, method }) });
    },
    withdraw(amount, method) {
      return this.request('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, method }) });
    },

    getMessages() {
      return this.request('/messages');
    },
    sendMessage(recipientId, content) {
      return this.request('/messages', { method: 'POST', body: JSON.stringify({ recipientId, content }) });
    },

    getStorageUnits() {
      return this.request('/storage-units');
    },
    bookStorage(unitId, startDate, endDate) {
      return this.request('/storage/book', { method: 'POST', body: JSON.stringify({ unitId, startDate, endDate }) });
    },

    getTransportOffers() {
      return this.request('/transport-offers');
    },
    requestTransport(orderData) {
      return this.request('/transport/request', { method: 'POST', body: JSON.stringify(orderData) });
    },

    getFacilities() {
      return this.request('/facilities');
    },
    createFacility(data) {
      return this.request('/facilities', { method: 'POST', body: JSON.stringify(data) });
    }
  };

  // --- UI Utilities ---
  const UI = {
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      Object.assign(toast.style, {
        position: 'fixed', top: '20px', right: '20px',
        padding: '15px 20px', borderRadius: '8px',
        backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
        color: 'white', zIndex: '10000',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out'
      });
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },
    formatCurrency(amount, currency = 'AOA') {
      return new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(amount);
    },
    formatDate(date) {
      return new Intl.DateTimeFormat('pt-AO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(date));
    },
    escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };

  // --- Form Validator ---
  const Validator = {
    email(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); },
    required(v) { return v.trim() !== ''; },
    minLength(v, l) { return v.length >= l; },
    phone(v) { return /^\+?[\d\s\-()]+$/.test(v); },
    validateForm(form) {
      const errors = [];
      const inputs = form.querySelectorAll('[data-validate]');
      inputs.forEach(input => {
        const rules = input.dataset.validate.split('|');
        const value = input.value;
        rules.forEach(rule => {
          const [name, param] = rule.split(':');
          if (name === 'required' && !this.required(value)) errors.push(`${input.name} é obrigatório`);
          if (name === 'email' && !this.email(value)) errors.push(`${input.name} deve ser um email válido`);
          if (name === 'minLength' && !this.minLength(value, parseInt(param))) errors.push(`${input.name} precisa de pelo menos ${param} caracteres`);
        });
      });
      return { valid: errors.length === 0, errors };
    }
  };

  // --- Router ---
  const Router = {
    init() {
      window.addEventListener('popstate', () => this.handleRoute());
      document.addEventListener('click', (e) => {
        if (e.target.matches('[data-link]')) {
          e.preventDefault();
          this.navigate(e.target.getAttribute('href'));
        }
      });
      this.handleRoute();
    },
    navigate(path) {
      window.history.pushState({}, '', path);
      this.handleRoute();
    },
    handleRoute() {
      const path = window.location.pathname;
      AppState.currentPage = path;
      const protectedPages = ['/dashboard', '/orders', '/wallet', '/messages'];
      if (protectedPages.some(p => path.startsWith(p)) && !AppState.isAuthenticated) {
        window.location.href = '/auth.html?redirect=' + encodeURIComponent(path);
      }
    }
  };

  // --- Initialization ---
  AppState.init();
  Router.init();

  // --- Expose globally ---
  window.PDC = { CONFIG, AppState, API, UI, Validator, Router };
})();

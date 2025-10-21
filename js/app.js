// Unified Application Entry Point
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    API_BASE_URL: '/api',
    STORAGE_KEY: 'pdc_app_state',
    TOKEN_KEY: 'pdc_auth_token',
    USER_KEY: 'pdc_user_data'
  };

  // --- State Management ---
  const AppState = {
    user: null,
    isAuthenticated: false,
    currentPage: '',

    init() {
      this.loadFromStorage();
    },

    loadFromStorage() {
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

  // --- Generic fetch wrapper ---
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

    // Auth
    login(email, password) {
      return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },
    register(userData) {
      return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
    },
    logout() {
      return this.request('/auth/logout', { method: 'POST' });
    },

    // Products
    getProducts(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/products?${qs}`);
    },
    getProduct(id) { return this.request(`/products/${id}`); },
    createProduct(data) { return this.request('/products', { method: 'POST', body: JSON.stringify(data) }); },
    updateProduct(id, data) { return this.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    deleteProduct(id) { return this.request(`/products/${id}`, { method: 'DELETE' }); },

    // Orders
    getOrders(filters = {}) {
      const qs = new URLSearchParams(filters).toString();
      return this.request(`/orders?${qs}`);
    },
    createOrder(data) { return this.request('/orders', { method: 'POST', body: JSON.stringify(data) }); },
    updateOrderStatus(id, status) { return this.request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },

    // Wallet
    getWallet() { return this.request('/wallet'); },
    getTransactions() { return this.request('/wallet/transactions'); },
    addFunds(amount, method) { return this.request('/wallet/add-funds', { method: 'POST', body: JSON.stringify({ amount, method }) }); },
    withdraw(amount, method) { return this.request('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, method }) }); },

    // Messages
    getMessages() { return this.request('/messages'); },
    sendMessage(recipientId, content) { return this.request('/messages', { method: 'POST', body: JSON.stringify({ recipientId, content }) }); },

    // Storage
    getStorageUnits() { return this.request('/storage-units'); },
    bookStorage(unitId, startDate, endDate) { return this.request('/storage/book', { method: 'POST', body: JSON.stringify({ unitId, startDate, endDate }) }); },

    // Transport
    getTransportOffers() { return this.request('/transport-offers'); },
    requestTransport(orderData) { return this.request('/transport/request', { method: 'POST', body: JSON.stringify(orderData) }); },

    // Facilities
    getFacilities() { return this.request('/facilities'); },
    createFacility(data) { return this.request('/facilities', { method: 'POST', body: JSON.stringify(data) }); }
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
    showLoader() { /* ... same as before ... */ },
    hideLoader() { const l = document.getElementById('global-loader'); if (l) l.remove(); },
    formatCurrency(amount, currency = 'USD') { return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount); },
    formatDate(date) { return new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date)); },
    debounce(func, wait) { let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>func(...args),wait);} }
  };

  // --- Form Validation ---
  const Validator = {
    email(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);},
    required(v){return v.trim()!=='';},
    minLength(v,l){return v.length>=l;},
    phone(v){return /^\+?[\d\s\-()]+$/.test(v);},
    validateForm(form){
      const errors=[]; const inputs=form.querySelectorAll('[data-validate]');
      inputs.forEach(input=>{
        const rules=input.dataset.validate.split('|'); const value=input.value;
        rules.forEach(rule=>{
          const [name,param]=rule.split(':');
          if(name==='required'&&!this.required(value)) errors.push(`${input.name} is required`);
          if(name==='email'&&!this.email(value)) errors.push(`${input.name} must be a valid email`);
          if(name==='minLength'&&!this.minLength(value,parseInt(param))) errors.push(`${input.name} must be at least ${param} characters`);
        });
      });
      return {valid:errors.length===0,errors};
    }
  };

  // --- Extra Helpers (from your minimal file) ---
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function loadProducts() {
    const grid=document.getElementById('productsGrid');
    const page=window.products// Unified Application Entry Point
      (function() {
        'use strict';

        // Configuration
        const CONFIG = {
          API_BASE_URL: '/api',
          STORAGE_KEY: 'pdc_app_state',
          TOKEN_KEY: 'pdc_auth_token',
          USER_KEY: 'pdc_user_data'
        };

        // --- State Management ---
        const AppState = {
          user: null,
          isAuthenticated: false,
          currentPage: '',

          init() {
            this.loadFromStorage();
          },

          loadFromStorage() {
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

        // --- Generic fetch wrapper ---
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

          // Auth
          login(email, password) {
            return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
          },
          register(userData) {
            return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
          },
          logout() {
            return this.request('/auth/logout', { method: 'POST' });
          },

          // Products
          getProducts(filters = {}) {
            const qs = new URLSearchParams(filters).toString();
            return this.request(`/products?${qs}`);
          },
          getProduct(id) { return this.request(`/products/${id}`); },
          createProduct(data) { return this.request('/products', { method: 'POST', body: JSON.stringify(data) }); },
          updateProduct(id, data) { return this.request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
          deleteProduct(id) { return this.request(`/products/${id}`, { method: 'DELETE' }); },

          // Orders
          getOrders(filters = {}) {
            const qs = new URLSearchParams(filters).toString();
            return this.request(`/orders?${qs}`);
          },
          createOrder(data) { return this.request('/orders', { method: 'POST', body: JSON.stringify(data) }); },
          updateOrderStatus(id, status) { return this.request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },

          // Wallet
          getWallet() { return this.request('/wallet'); },
          getTransactions() { return this.request('/wallet/transactions'); },
          addFunds(amount, method) { return this.request('/wallet/add-funds', { method: 'POST', body: JSON.stringify({ amount, method }) }); },
          withdraw(amount, method) { return this.request('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount, method }) }); },

          // Messages
          getMessages() { return this.request('/messages'); },
          sendMessage(recipientId, content) { return this.request('/messages', { method: 'POST', body: JSON.stringify({ recipientId, content }) }); },

          // Storage
          getStorageUnits() { return this.request('/storage-units'); },
          bookStorage(unitId, startDate, endDate) { return this.request('/storage/book', { method: 'POST', body: JSON.stringify({ unitId, startDate, endDate }) }); },

          // Transport
          getTransportOffers() { return this.request('/transport-offers'); },
          requestTransport(orderData) { return this.request('/transport/request', { method: 'POST', body: JSON.stringify(orderData) }); },

          // Facilities
          getFacilities() { return this.request('/facilities'); },
          createFacility(data) { return this.request('/facilities', { method: 'POST', body: JSON.stringify(data) }); }
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
          showLoader() { /* ... same as before ... */ },
          hideLoader() { const l = document.getElementById('global-loader'); if (l) l.remove(); },
          formatCurrency(amount, currency = 'USD') { return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount); },
          formatDate(date) { return new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date)); },
          debounce(func, wait) { let t; return (...args)=>{clearTimeout(t); t=setTimeout(()=>func(...args),wait);} }
        };

        // --- Form Validation ---
        const Validator = {
          email(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);},
          required(v){return v.trim()!=='';},
          minLength(v,l){return v.length>=l;},
          phone(v){return /^\+?[\d\s\-()]+$/.test(v);},
          validateForm(form){
            const errors=[]; const inputs=form.querySelectorAll('[data-validate]');
            inputs.forEach(input=>{
              const rules=input.dataset.validate.split('|'); const value=input.value;
              rules.forEach(rule=>{
                const [name,param]=rule.split(':');
                if(name==='required'&&!this.required(value)) errors.push(`${input.name} is required`);
                if(name==='email'&&!this.email(value)) errors.push(`${input.name} must be a valid email`);
                if(name==='minLength'&&!this.minLength(value,parseInt(param))) errors.push(`${input.name} must be at least ${param} characters`);
              });
            });
            return {valid:errors.length===0,errors};
          }
        };

        // --- Extra Helpers (from your minimal file) ---
        function escapeHtml(s) {
          if (!s) return '';
          return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        async function loadProducts() {
          const grid=document.getElementById('productsGrid');
          const page=window.products

          // --- Extra Helpers for Producer Dashboard ---

          function getDemoSession() {
            // For demo mode: return a fake user if none in AppState
            return PDC.AppState.user || { id: "demo-user", name: "Demo Produtor" };
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
      <p class="muted">${escapeHtml((p.description || '').slice(0,100))}</p>
      <div class="card-footer">
        <span class="price">${escapeHtml(String(p.pricePerUnit || '—'))} ${escapeHtml(p.currency || 'AOA')}</span>
      </div>
    `;
              grid.appendChild(card);
            });
          }

// Expose globally
          window.getDemoSession = getDemoSession;
          window.renderSimpleGrid = renderSimpleGrid;

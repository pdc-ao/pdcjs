// Minimal, robust auth script for auth.html (non-module)
// Handles tab switching, login and register via /api/auth endpoints
(function () {
  'use strict';

  const SELECTORS = {
    loginTabBtns: '.tab-btn',
    authPanels: '.auth-panel',
    loginForm: '#loginForm',
    registerForm: '#registerForm',
    loginError: '#loginError',
    registerError: '#registerError',
    yearAuth: '#yearAuth'
  };

  // Utility: safe fetch wrapper for JSON responses
  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin'
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
    if (!res.ok) {
      const message = (json && (json.error || json.message)) || res.statusText || `HTTP ${res.status}`;
      const err = new Error(message);
      err.status = res.status; err.body = json;
      throw err;
    }
    return json;
  }

  // Tab switching
  function initTabs() {
    const tabs = document.querySelectorAll(SELECTORS.loginTabBtns);
    const panels = document.querySelectorAll(SELECTORS.authPanels);
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        const panel = document.getElementById(target);
        if (panel) panel.classList.remove('hidden');
      });
    });
  }

  // Login handler
  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const errEl = document.querySelector(SELECTORS.loginError);
    if (errEl) { errEl.textContent = ''; }

    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');

    if (!email || !password) {
      if (errEl) errEl.textContent = 'Preencha todos os campos';
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const old = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }

    try {
      const json = await postJson('/api/auth/login', { email, password });
      if (!json || !json.token || !json.user) throw new Error('Resposta inválida do servidor');
      localStorage.setItem('pdc_auth_token', json.token);
      localStorage.setItem('pdc_user_data', JSON.stringify(json.user));
      const redirect = new URLSearchParams(window.location.search).get('redirect') || 'dashboard.html';
      window.location.href = redirect;
    } catch (err) {
      if (err.status === 401) {
        if (errEl) errEl.textContent = 'Credenciais inválidas';
      } else {
        if (errEl) errEl.textContent = err.message || 'Erro ao conectar';
      }
      console.error('[auth login]', err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  // Register handler
  async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const errEl = document.querySelector(SELECTORS.registerError);
    if (errEl) { errEl.textContent = ''; }

    const fd = new FormData(form);
    const type = fd.get('regType') || 'person';
    const password = String(fd.get('password') || '');
    const confirm = String(fd.get('confirmPassword') || '');
    if (password !== confirm) {
      if (errEl) errEl.textContent = 'Senhas não coincidem';
      return;
    }
    const email = String(fd.get('email') || '').trim();
    if (!email || !password) {
      if (errEl) errEl.textContent = 'Email e senha são obrigatórios';
      return;
    }

    const payload = type === 'person' ? {
      email,
      password,
      name: (fd.get('fullName') || '').trim(),
      role: fd.get('role') || undefined
    } : {
      email,
      password,
      name: (fd.get('companyName') || '').trim(),
      role: fd.get('role') || undefined,
      contactPerson: (fd.get('contactPerson') || '').trim()
    };

    const btn = form.querySelector('button[type="submit"]');
    const old = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; }

    try {
      const json = await postJson('/api/auth/register', payload);
      if (!json || !json.token || !json.user) throw new Error('Resposta inválida do servidor');
      localStorage.setItem('pdc_auth_token', json.token);
      localStorage.setItem('pdc_user_data', JSON.stringify(json.user));
      window.location.href = 'dashboard.html';
    } catch (err) {
      if (errEl) errEl.textContent = err.message || 'Erro ao registar';
      console.error('[auth register]', err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  }

  // Wire forms and init
  function initForms() {
    const loginForm = document.querySelector(SELECTORS.loginForm);
    const registerForm = document.querySelector(SELECTORS.registerForm);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
  }

  // Reg type toggle
  function initRegTypeToggle() {
    const radios = document.querySelectorAll('input[name="regType"]');
    const personFields = document.getElementById('personFields');
    const companyFields = document.getElementById('companyFields');
    if (!radios.length || !personFields || !companyFields) return;
    function setRequired(container, v) {
      container.querySelectorAll('input, select').forEach(el => {
        if (v) el.setAttribute('required', 'required'); else el.removeAttribute('required');
      });
    }
    function toggle(type) {
      if (type === 'person') {
        personFields.style.display = 'block';
        companyFields.style.display = 'none';
        setRequired(personFields, true);
        setRequired(companyFields, false);
      } else {
        personFields.style.display = 'none';
        companyFields.style.display = 'block';
        setRequired(personFields, false);
        setRequired(companyFields, true);
      }
    }
    radios.forEach(r => r.addEventListener('change', () => toggle(r.value)));
    toggle('person');
  }

  // Init on DOM ready
  function init() {
    try {
      const y = document.getElementById('yearAuth'); if (y) y.textContent = new Date().getFullYear();
      initTabs();
      initRegTypeToggle();
      initForms();
    } catch (e) {
      console.error('[auth init]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
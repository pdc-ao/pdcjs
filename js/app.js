// Minimal helper utilities for the static UI.
// No build step required. Plain fetch usage, minimal error handling.

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Generic fetch wrapper returning JSON or throwing
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(json?.error || res.statusText || 'Erro');
    return json;
  } catch (err) {
    // if parse fails but status ok, return raw text
    if (res.ok) return text;
    throw err;
  }
}

// products page loader (used by products.html)
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  const page = window.productsPageState?.page || 1;
  const limit = window.productsPageState?.limit || 12;
  const search = document.getElementById('searchInput')?.value || '';
  const category = document.getElementById('categorySelect')?.value || '';

  if (!grid) return;
  grid.innerHTML = '<div class="loading">Carregando...</div>';

  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (search) params.set('search', search);
  if (category) params.set('category', category);

  try {
    const data = await fetchJSON('/api/products?' + params.toString());
    const products = data.products || data.data || [];
    renderProductGrid(grid, products);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo && data.pagination) {
      pageInfo.textContent = `Página ${data.pagination.page} de ${data.pagination.totalPages}`;
    }
  } catch (err) {
    grid.innerHTML = `<div class="loading">Erro ao carregar produtos: ${escapeHtml(err.message)}</div>`;
  }
}

function renderProductGrid(grid, products) {
  grid.innerHTML = '';
  if (!Array.isArray(products) || products.length === 0) {
    grid.innerHTML = '<div class="muted">Nenhum produto encontrado.</div>';
    return;
  }
  products.forEach(p => {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <div>
        <h3 class="card-title">${escapeHtml(p.title || '—')}</h3>
        <p class="card-desc">${escapeHtml((p.description||'').slice(0,140))}</p>
        <div class="card-meta"><span class="badge">${escapeHtml(p.category||'')}</span> <span class="muted">${p.producer?.fullName || ''}</span></div>
      </div>
      <div class="card-footer">
        <div class="price">${escapeHtml(String(p.pricePerUnit || '—'))} ${escapeHtml(p.currency||'AOA')}</div>
        <div class="actions"><a class="btn btn-sm btn-primary" href="product.html?id=${encodeURIComponent(p.id)}">Ver</a></div>
      </div>
    `;
    grid.appendChild(el);
  });
}

// small helper that other pages can call
window.fetchJSON = fetchJSON;
window.loadProducts = loadProducts;
window.escapeHtml = escapeHtml;

// Producer Dashboard Logic
(function() {
  'use strict';

  // Check authentication
  if (!PDC.AppState.isAuthenticated) {
    window.location.href = '/auth.html';
    return;
  }

  // Display user name
  document.getElementById('userName').textContent =
    PDC.AppState.user.fullName || PDC.AppState.user.username;

  // Logout handler
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (confirm('Deseja realmente sair?')) {
      try {
        await PDC.API.logout();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        PDC.AppState.clearUser();
        window.location.href = '/';
      }
    }
  });

  // Section navigation
  window.showSection = function(sectionName) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
      section.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.classList.remove('active');
    });

    document.getElementById(`${sectionName}Section`).style.display = 'block';
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    // Load section data
    loadSectionData(sectionName);
  };

  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      showSection(section);
    });
  });

  // Load section data
  async function loadSectionData(section) {
    switch(section) {
      case 'overview':
        await loadOverview();
        break;
      case 'products':
        await loadProducts();
        break;
      case 'orders':
        await loadOrders();
        break;
      case 'wallet':
        await loadWallet();
        break;
      case 'messages':
        await loadMessages();
        break;
      case 'profile':
        await loadProfile();
        break;
    }
  }

  // Load Overview Data
  async function loadOverview() {
    try {
      const [products, orders, wallet] = await Promise.all([
        PDC.API.getProducts({ producerId: PDC.AppState.user.id }),
        PDC.API.getOrders({ sellerId: PDC.AppState.user.id }),
        PDC.API.getWallet()
      ]);

      // Update stats
      document.getElementById('totalProducts').textContent =
        (products.data || products).filter(p => p.status === 'Active').length;
      document.getElementById('totalOrders').textContent =
        (orders.data || orders).length;

      const totalRevenue = (orders.data || orders)
        .filter(o => o.orderStatus === 'Delivered')
        .reduce((sum, o) => sum + o.totalAmount, 0);
      document.getElementById('totalRevenue').textContent =
        `${totalRevenue.toFixed(2)} ${orders[0]?.currency || 'AOA'}`;

      document.getElementById('walletBalance').textContent =
        `${parseFloat(wallet.balance || 0).toFixed(2)} AOA`;

      // Recent orders
      renderRecentOrders((orders.data || orders).slice(0, 5));

    } catch (error) {
      console.error('Error loading overview:', error);
      PDC.UI.showToast('Erro ao carregar dados', 'error');
    }
  }

  function renderRecentOrders(orders) {
    const container = document.getElementById('recentOrders');

    if (orders.length === 0) {
      container.innerHTML = '<p class="text-center p-3">Nenhum pedido ainda</p>';
      return;
    }

    container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>#${order.id.slice(0, 8)}</td>
                            <td>${order.buyer?.fullName || order.buyer?.username || 'Cliente'}</td>
                            <td>${order.totalAmount} ${order.currency}</td>
                            <td><span class="badge badge-${getStatusBadge(order.orderStatus)}">
                                ${order.orderStatus}
                            </span></td>
                            <td>${PDC.UI.formatDate(order.orderDate)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
  }

  function getStatusBadge(status) {
    const badges = {
      'Pending': 'warning',
      'Confirmed': 'info',
      'InTransit': 'info',
      'Delivered': 'success',
      'Cancelled': 'danger'
    };
    return badges[status] || 'info';
  }

  // Load Products
  async function loadProducts() {
    try {
      const response = await PDC.API.getProducts({
        producerId: PDC.AppState.user.id
      });
      const products = response.data || response;

      renderProductsTable(products);
    } catch (error) {
      console.error('Error loading products:', error);
      PDC.UI.showToast('Erro ao carregar produtos', 'error');
    }
  }

  function renderProductsTable(products) {
    const container = document.getElementById('productsTable');

    if (products.length === 0) {
      container.innerHTML = `
                <div class="text-center p-4">
                    <p>Você ainda não tem produtos cadastrados</p>
                    <button class="btn btn-primary mt-2" onclick="openProductModal()">
                        Criar Primeiro Produto
                    </button>
                </div>
            `;
      return;
    }

    container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Estoque</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td>
                                <strong>${product.title}</strong>
                                <br>
                                <small>${product.description.substring(0, 50)}...</small>
                            </td>
                            <td>${product.category}</td>
                            <td>${product.pricePerUnit} ${product.currency}/${product.unitOfMeasure}</td>
                            <td>${product.quantityAvailable} ${product.unitOfMeasure}</td>
                            <td>
                                <span class="badge badge-${product.status === 'Active' ? 'success' : 'danger'}">
                                    ${product.status}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline" onclick="editProduct('${product.id}')">
                                    Editar
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">
                                    Excluir
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
  }

  // Load Orders
  async function loadOrders() {
    try {
      const response = await PDC.API.getOrders({
        sellerId: PDC.AppState.user.id
      });
      const orders = response.data || response;

      renderOrdersTable(orders);
    } catch (error) {
      console.error('Error loading orders:', error);
      PDC.UI.showToast('Erro ao carregar pedidos', 'error');
    }
  }

  function renderOrdersTable(orders) {
    const container = document.getElementById('ordersTable');

    if (orders.length === 0) {
      container.innerHTML = '<p class="text-center p-4">Nenhum pedido ainda</p>';
      return;
    }

    container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>ID Pedido</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Pagamento</th>
                        <th>Data</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>#${order.id.slice(0, 8)}</td>
                            <td>${order.buyer?.fullName || order.buyer?.username}</td>
                            <td>${order.totalAmount} ${order.currency}</td>
                            <td>
                                <span class="badge badge-${getStatusBadge(order.orderStatus)}">
                                    ${order.orderStatus}
                                </span>
                            </td>
                            <td>
                                <span class="badge badge-${order.paymentStatus === 'Paid' ? 'success' : 'warning'}">
                                    ${order.paymentStatus}
                                </span>
                            </td>
                            <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="viewOrder('${order.id}')">
                                    Ver
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
  }

  // Order status filter
  document.getElementById('orderStatusFilter')?.addEventListener('change', async (e) => {
    const status = e.target.value;
    try {
      const filters = { sellerId: PDC.AppState.user.id };
      if (status) filters.status = status;

      const response = await PDC.API.getOrders(filters);
      renderOrdersTable(response.data || response);
    } catch (error) {
      console.error('Error filtering orders:', error);
    }
  });

  // Load Wallet
  async function loadWallet() {
    try {
      const [wallet, transactions] = await Promise.all([
        PDC.API.getWallet(),
        PDC.API.getTransactions()
      ]);

      document.getElementById('walletBalanceDetail').textContent =
        `${parseFloat(wallet.balance || 0).toFixed(2)} AOA`;

      renderTransactions(transactions.slice(0, 10));
    } catch (error) {
      console.error('Error loading wallet:', error);
      PDC.UI.showToast('Erro ao carregar carteira', 'error');
    }
  }

  function renderTransactions(transactions) {
    const container = document.getElementById('recentTransactions');

    if (transactions.length === 0) {
      container.innerHTML = '<p class="text-center p-3">Nenhuma transação</p>';
      return;
    }

    container.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${transactions.map(tx => `
                    <div class="p-2 border-bottom">
                        <div class="d-flex justify-between">
                            <span><strong>${tx.type || 'Transação'}</strong></span>
                            <span class="${tx.amount > 0 ? 'text-success' : 'text-danger'}">
                                ${tx.amount > 0 ? '+' : ''}${tx.amount} AOA
                            </span>
                        </div>
                        <small class="text-muted">${PDC.UI.formatDate(tx.createdAt)}</small>
                    </div>
                `).join('')}
            </div>
        `;
  }

  // Load Messages
  async function loadMessages() {
    try {
      const messages = await PDC.API.getMessages();
      renderConversations(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      PDC.UI.showToast('Erro ao carregar mensagens', 'error');
    }
  }

  function renderConversations(messages) {
    const container = document.getElementById('conversationsList');

    if (messages.length === 0) {
      container.innerHTML = '<p class="text-center p-3">Nenhuma mensagem</p>';
      return;
    }

    // Group by conversation
    const conversations = {};
    messages.forEach(msg => {
      if (!conversations[msg.conversationId]) {
        conversations[msg.conversationId] = [];
      }
      conversations[msg.conversationId].push(msg);
    });

    container.innerHTML = Object.keys(conversations).map(convId => {
      const msgs = conversations[convId];
      const lastMsg = msgs[msgs.length - 1];
      return `
                <div class="p-2 border-bottom" style="cursor: pointer;"
                     onclick="loadConversation('${convId}')">
                    <strong>${lastMsg.sender?.username || 'Usuário'}</strong>
                    <p class="text-muted mb-0" style="font-size: 0.875rem;">
                        ${lastMsg.messageContent.substring(0, 50)}...
                    </p>
                </div>
            `;
    }).join('');
  }

  window.loadConversation = async function(conversationId) {
    try {
      const response = await PDC.API.request(`/messages?conversationId=${conversationId}`);
      const messages = response.messages || response;

      const container = document.getElementById('messageArea');
      container.innerHTML = `
                <div style="height: 400px; overflow-y: auto; padding: 1rem;">
                    ${messages.map(msg => `
                        <div class="mb-3 ${msg.senderId === PDC.AppState.user.id ? 'text-right' : ''}">
                            <div class="d-inline-block p-2 rounded"
                                 style="background: ${msg.senderId === PDC.AppState.user.id ? '#10b981' : '#e5e7eb'};
                                        color: ${msg.senderId === PDC.AppState.user.id ? 'white' : 'black'};
                                        max-width: 70%;">
                                ${msg.messageContent}
                            </div>
                            <div style="font-size: 0.75rem; color: #6b7280;">
                                ${new Date(msg.sentAt).toLocaleTimeString()}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="d-flex gap-2 mt-3">
                    <input type="text" id="messageInput" class="form-control"
                           placeholder="Digite sua mensagem...">
                    <button class="btn btn-primary" onclick="sendMessage('${conversationId}')">
                        Enviar
                    </button>
                </div>
            `;
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  window.sendMessage = async function(conversationId) {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content) return;

    try {
      // Extract recipient from conversation
      await PDC.API.sendMessage(conversationId, content);
      input.value = '';
      loadConversation(conversationId);
      PDC.UI.showToast('Mensagem enviada', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      PDC.UI.showToast('Erro ao enviar mensagem', 'error');
    }
  };

  // Load Profile
  async function loadProfile() {
    const form = document.getElementById('profileForm');
    const user = PDC.AppState.user;

    form.elements.fullName.value = user.fullName || '';
    form.elements.email.value = user.email || '';
    form.elements.phoneNumber.value = user.phoneNumber || '';
    form.elements.city.value = user.city || '';
    form.elements.addressLine1.value = user.addressLine1 || '';

    // Verification status
    const verificationBadge = {
      'VERIFIED': '<span class="badge badge-success">Verificado</span>',
      'PENDING': '<span class="badge badge-warning">Pendente</span>',
      'REJECTED': '<span class="badge badge-danger">Rejeitado</span>'
    };

    document.getElementById('verificationStatus').innerHTML = `
            ${verificationBadge[user.verificationStatus] || verificationBadge.PENDING}
            <p class="mt-2">
                ${user.verificationStatus === 'VERIFIED'
      ? 'Sua conta está verificada!'
      : 'Complete a verificação para ter mais visibilidade'}
            </p>
        `;
  }

  // Profile form handler
  document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      PDC.UI.showLoader();
      await PDC.API.request(`/users/${PDC.AppState.user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });

      // Update local state
      PDC.AppState.user = { ...PDC.AppState.user, ...data };
      localStorage.setItem(PDC.CONFIG.USER_KEY, JSON.stringify(PDC.AppState.user));

      PDC.UI.showToast('Perfil atualizado com sucesso', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      PDC.UI.showToast('Erro ao atualizar perfil', 'error');
    } finally {
      PDC.UI.hideLoader();
    }
  });

  // Product Modal Functions
  window.openProductModal = function() {
    document.getElementById('productModal').classList.add('active');
  };

  window.closeProductModal = function() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('productForm').reset();
  };

  // Product form handler
  document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    data.producerId = PDC.AppState.user.id;
    data.status = 'Active';
    data.currency = 'AOA';
    data.pricePerUnit = parseFloat(data.pricePerUnit);
    data.quantityAvailable = parseFloat(data.quantityAvailable);

    try {
      PDC.UI.showLoader();
      await PDC.API.createProduct(data);
      PDC.UI.showToast('Produto criado com sucesso', 'success');
      closeProductModal();
      loadProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      PDC.UI.showToast('Erro ao criar produto', 'error');
    } finally {
      PDC.UI.hideLoader();
    }
  });

  window.deleteProduct = async function(productId) {
    if (!confirm('Deseja realmente excluir este produto?')) return;

    try {
      PDC.UI.showLoader();
      await PDC.API.deleteProduct(productId);
      PDC.UI.showToast('Produto excluído', 'success');
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      PDC.UI.showToast('Erro ao excluir produto', 'error');
    } finally {
      PDC.UI.hideLoader();
    }
  };

  window.editProduct = function(productId) {
    // TODO: Implement edit functionality
    PDC.UI.showToast('Funcionalidade em desenvolvimento', 'info');
  };

  window.viewOrder = function(orderId) {
    window.location.href = `/order.html?id=${orderId}`;
  };

  window.openAddFundsModal = function() {
    PDC.UI.showToast('Funcionalidade em desenvolvimento', 'info');
  };

  window.openWithdrawModal = function() {
    PDC.UI.showToast('Funcionalidade em desenvolvimento', 'info');
  };

  // Initial load
  loadOverview();
})();

(function () {
  const API = {
    orders: '/api/orders',
    orderStatus: function (orderNumber) { return '/api/orders/' + orderNumber + '/status'; },
    summary: '/api/admin/summary',
    products: '/api/admin/products',
    product: function (id) { return '/api/admin/products/' + encodeURIComponent(id); },
    contacts: '/api/admin/contacts?limit=100'
  };
  const ADMIN_KEY_STORAGE = 'adminApiKey';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getAdminKeyFromUrl() {
    const url = new URL(window.location.href);
    const key = url.searchParams.get('key');
    if (!key) {
      return '';
    }

    localStorage.setItem(ADMIN_KEY_STORAGE, key);
    return key;
  }

  function getAdminKey() {
    return getAdminKeyFromUrl() || localStorage.getItem(ADMIN_KEY_STORAGE) || '';
  }

  function getAdminHeaders(withJson) {
    const headers = {};
    const key = getAdminKey();
    if (key) {
      headers['x-admin-key'] = key;
    }
    if (withJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  async function apiRequest(url, options) {
    const response = await fetch(url, options || {});
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Неверный ключ администратора.');
      }

      let serverMessage = '';
      try {
        const payload = await response.json();
        serverMessage = payload.message || '';
      } catch (_error) {
        serverMessage = '';
      }

      throw new Error(serverMessage || ('HTTP ' + response.status));
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function formatPrice(value) {
    return Number(value || 0).toLocaleString('ru-RU') + ' ₽';
  }

  function statusLabel(value) {
    if (value === 'in-progress') return 'В работе';
    if (value === 'completed') return 'Завершён';
    return 'Новый';
  }

  function setStatusMessage(message, isError) {
    const node = document.getElementById('adminStatus');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? '#ff95a7' : '#9fe0c7';
  }

  function setAuthStatus(message, isError) {
    const node = document.getElementById('adminAuthStatus');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? '#ff95a7' : '#9fe0c7';
  }

  function getProductFormPayload() {
    const description = (document.getElementById('productDescription').value || '')
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(Boolean);

    const specs = (document.getElementById('productSpecs').value || '')
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(Boolean);

    return {
      id: document.getElementById('productId').value.trim(),
      name: document.getElementById('productName').value.trim(),
      shortDescription: document.getElementById('productShortDescription').value.trim(),
      price: Number(document.getElementById('productPrice').value || 0),
      image: document.getElementById('productImage').value.trim(),
      isFeatured: document.getElementById('productIsFeatured').checked,
      description: description,
      specs: specs
    };
  }

  function resetProductForm() {
    document.getElementById('productMode').value = 'create';
    document.getElementById('productId').value = '';
    document.getElementById('productId').disabled = false;
    document.getElementById('productName').value = '';
    document.getElementById('productShortDescription').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('productIsFeatured').checked = false;
    document.getElementById('productDescription').value = '';
    document.getElementById('productSpecs').value = '';
    document.getElementById('productSubmitBtn').textContent = 'Добавить товар';
  }

  function fillProductForm(product) {
    document.getElementById('productMode').value = 'edit';
    document.getElementById('productId').value = product.id || '';
    document.getElementById('productId').disabled = true;
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productShortDescription').value = product.shortDescription || '';
    document.getElementById('productPrice').value = Number(product.price || 0);
    document.getElementById('productImage').value = product.image || '';
    document.getElementById('productIsFeatured').checked = Boolean(product.isFeatured);
    document.getElementById('productDescription').value = Array.isArray(product.description) ? product.description.join('\n') : '';
    document.getElementById('productSpecs').value = Array.isArray(product.specs) ? product.specs.join('\n') : '';
    document.getElementById('productSubmitBtn').textContent = 'Сохранить товар';
  }

  async function fetchOrders() {
    return apiRequest(API.orders, { headers: getAdminHeaders(false) });
  }

  async function updateOrderStatus(orderNumber, status) {
    await apiRequest(API.orderStatus(orderNumber), {
      method: 'PATCH',
      headers: getAdminHeaders(true),
      body: JSON.stringify({ status: status })
    });
  }

  async function fetchSummary() {
    return apiRequest(API.summary, { headers: getAdminHeaders(false) });
  }

  async function fetchProducts() {
    return apiRequest(API.products, { headers: getAdminHeaders(false) });
  }

  async function fetchContacts() {
    return apiRequest(API.contacts, { headers: getAdminHeaders(false) });
  }

  async function createProduct(payload) {
    await apiRequest(API.products, {
      method: 'POST',
      headers: getAdminHeaders(true),
      body: JSON.stringify(payload)
    });
  }

  async function updateProduct(productId, payload) {
    await apiRequest(API.product(productId), {
      method: 'PUT',
      headers: getAdminHeaders(true),
      body: JSON.stringify(payload)
    });
  }

  async function deleteProduct(productId) {
    await apiRequest(API.product(productId), {
      method: 'DELETE',
      headers: getAdminHeaders(false)
    });
  }

  function renderSummary(summary) {
    document.getElementById('summaryOrders').textContent = String(summary.orders || 0);
    document.getElementById('summaryProducts').textContent = String(summary.products || 0);
    document.getElementById('summaryContacts').textContent = String(summary.contacts || 0);
    document.getElementById('summaryReviews').textContent = String(summary.reviews || 0);
  }

  function renderOrders(orders) {
    const root = document.getElementById('ordersList');
    if (!root) return;

    root.innerHTML = '';

    if (!orders.length) {
      root.innerHTML = '<div class="orders-empty">Заказов пока нет</div>';
      return;
    }

    orders.forEach(function (order) {
      const card = document.createElement('article');
      card.className = 'order-card';
      const orderStatus = order.status || 'new';
      const created = order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '-';
      const total = order.pricing && order.pricing.total ? order.pricing.total : 0;

      const itemsHtml = (order.items || []).map(function (item) {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        return '<li>' + escapeHtml(item.name || 'Товар') + ' — ' + qty + ' шт. x ' + formatPrice(price) + '</li>';
      }).join('');

      card.innerHTML =
        '<div class="order-top">' +
          '<h3 class="order-title">Заказ #' + order.orderNumber + '</h3>' +
          '<span class="status-badge ' + orderStatus + '">' + statusLabel(orderStatus) + '</span>' +
        '</div>' +
        '<div class="order-meta">' +
          '<div><strong>Клиент:</strong> ' + escapeHtml(order.customer ? order.customer.name : '-') + '</div>' +
          '<div><strong>Телефон:</strong> ' + escapeHtml(order.customer ? order.customer.phone : '-') + '</div>' +
          '<div><strong>Создан:</strong> ' + created + '</div>' +
          '<div><strong>Итого:</strong> ' + formatPrice(total) + '</div>' +
        '</div>' +
        '<ul class="order-items">' + itemsHtml + '</ul>' +
        '<div class="order-actions">' +
          '<select data-order="' + order.orderNumber + '">' +
            '<option value="new"' + (orderStatus === 'new' ? ' selected' : '') + '>Новый</option>' +
            '<option value="in-progress"' + (orderStatus === 'in-progress' ? ' selected' : '') + '>В работе</option>' +
            '<option value="completed"' + (orderStatus === 'completed' ? ' selected' : '') + '>Завершён</option>' +
          '</select>' +
          '<button type="button" data-action="save" data-order="' + order.orderNumber + '">Сохранить статус</button>' +
        '</div>';

      root.appendChild(card);
    });

    bindStatusActions();
  }

  function renderProducts(products) {
    const root = document.getElementById('productsList');
    if (!root) return;

    root.innerHTML = '';
    if (!products.length) {
      root.innerHTML = '<div class="orders-empty">Товаров пока нет</div>';
      return;
    }

    products.forEach(function (product) {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.innerHTML =
        '<div class="product-top">' +
          '<h4>' + escapeHtml(product.name) + '</h4>' +
          '<span class="product-id">' + escapeHtml(product.id) + '</span>' +
        '</div>' +
        '<p class="product-desc">' + escapeHtml(product.shortDescription || '') + '</p>' +
        '<div class="product-meta">' +
          '<span><strong>Цена:</strong> ' + formatPrice(product.price) + '</span>' +
          '<span><strong>Изображение:</strong> ' + escapeHtml(product.image || '') + '</span>' +
          '<span><strong>Рекомендованный:</strong> ' + (product.isFeatured ? 'Да' : 'Нет') + '</span>' +
        '</div>' +
        '<div class="product-actions">' +
          '<button type="button" data-action="edit-product" data-id="' + escapeHtml(product.id) + '">Редактировать</button>' +
          '<button type="button" data-action="delete-product" data-id="' + escapeHtml(product.id) + '" class="btn-danger">Удалить</button>' +
        '</div>';

      root.appendChild(card);
    });

    bindProductCardActions(products);
  }

  function renderContacts(contacts) {
    const root = document.getElementById('contactsList');
    if (!root) return;
    root.innerHTML = '';

    if (!contacts.length) {
      root.innerHTML = '<div class="orders-empty">Обращений пока нет</div>';
      return;
    }

    contacts.forEach(function (contact) {
      const card = document.createElement('article');
      card.className = 'contact-card';
      const created = contact.created_at ? new Date(contact.created_at).toLocaleString('ru-RU') : '-';
      card.innerHTML =
        '<div class="contact-top">' +
          '<h4>' + escapeHtml(contact.name || 'Без имени') + '</h4>' +
          '<span>' + created + '</span>' +
        '</div>' +
        '<div class="contact-meta">' +
          '<div><strong>Телефон:</strong> ' + escapeHtml(contact.phone || '-') + '</div>' +
          '<div><strong>Email:</strong> ' + escapeHtml(contact.email || '-') + '</div>' +
        '</div>' +
        '<p class="contact-message">' + escapeHtml(contact.message || '') + '</p>';
      root.appendChild(card);
    });
  }

  function bindStatusActions() {
    document.querySelectorAll('button[data-action="save"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const orderNumber = this.dataset.order;
        const select = document.querySelector('select[data-order="' + orderNumber + '"]');
        if (!select) return;

        try {
          await updateOrderStatus(orderNumber, select.value);
          setStatusMessage('Статус заказа #' + orderNumber + ' обновлён.', false);
          await loadOrders();
        } catch (error) {
          console.error(error);
          setStatusMessage(error.message || 'Ошибка обновления статуса.', true);
        }
      });
    });
  }

  function bindProductCardActions(products) {
    document.querySelectorAll('button[data-action="edit-product"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const product = products.find(function (item) { return item.id === button.dataset.id; });
        if (!product) return;
        fillProductForm(product);
        setStatusMessage('Режим редактирования: ' + product.name, false);
      });
    });

    document.querySelectorAll('button[data-action="delete-product"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const productId = button.dataset.id;
        const confirmed = window.confirm('Удалить товар ' + productId + '?');
        if (!confirmed) return;

        try {
          await deleteProduct(productId);
          setStatusMessage('Товар удалён: ' + productId, false);
          await loadProducts();
          await loadSummary();
        } catch (error) {
          console.error(error);
          setStatusMessage(error.message || 'Не удалось удалить товар', true);
        }
      });
    });
  }

  function bindTabs() {
    const buttons = Array.from(document.querySelectorAll('[data-tab]'));
    const panels = {
      orders: document.getElementById('tab-orders'),
      products: document.getElementById('tab-products'),
      contacts: document.getElementById('tab-contacts')
    };

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        const tabName = button.dataset.tab;
        buttons.forEach(function (btn) { btn.classList.remove('active'); });
        Object.keys(panels).forEach(function (name) {
          panels[name].classList.toggle('active', name === tabName);
        });
        button.classList.add('active');
      });
    });
  }

  function bindAuthControls() {
    const input = document.getElementById('adminKeyInput');
    const saveButton = document.getElementById('saveAdminKeyBtn');
    const clearButton = document.getElementById('clearAdminKeyBtn');

    input.value = getAdminKey();

    saveButton.addEventListener('click', function () {
      const value = input.value.trim();
      if (!value) {
        setAuthStatus('Введите ключ перед сохранением.', true);
        return;
      }

      localStorage.setItem(ADMIN_KEY_STORAGE, value);
      setAuthStatus('Ключ сохранён. Обновите данные кнопкой выше.', false);
    });

    clearButton.addEventListener('click', function () {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
      input.value = '';
      setAuthStatus('Ключ удалён.', false);
    });
  }

  function bindProductForm() {
    const form = document.getElementById('productForm');
    const resetBtn = document.getElementById('productResetBtn');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const mode = document.getElementById('productMode').value;
      const payload = getProductFormPayload();

      try {
        if (mode === 'edit') {
          await updateProduct(payload.id, payload);
          setStatusMessage('Товар обновлён: ' + payload.name, false);
        } else {
          await createProduct(payload);
          setStatusMessage('Товар добавлен: ' + payload.name, false);
        }

        resetProductForm();
        await loadProducts();
        await loadSummary();
      } catch (error) {
        console.error(error);
        setStatusMessage(error.message || 'Не удалось сохранить товар', true);
      }
    });

    resetBtn.addEventListener('click', function () {
      resetProductForm();
      setStatusMessage('Форма товара сброшена.', false);
    });
  }

  async function loadSummary() {
    const summary = await fetchSummary();
    renderSummary(summary);
  }

  async function loadOrders() {
    const orders = await fetchOrders();
    renderOrders(orders);
  }

  async function loadProducts() {
    const products = await fetchProducts();
    renderProducts(products);
  }

  async function loadContacts() {
    const contacts = await fetchContacts();
    renderContacts(contacts);
  }

  async function refreshAll() {
    try {
      setStatusMessage('Загрузка данных админ-панели...', false);
      await Promise.all([loadSummary(), loadOrders(), loadProducts(), loadContacts()]);
      setStatusMessage('Данные загружены.', false);
      setAuthStatus('Вход выполнен. Ключ принят.', false);
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || 'Не удалось загрузить данные.', true);
      setAuthStatus(error.message || 'Проверьте ключ администратора.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindAuthControls();
    bindTabs();
    bindProductForm();

    document.getElementById('refreshBtn').addEventListener('click', refreshAll);
    refreshAll();
  });
})();

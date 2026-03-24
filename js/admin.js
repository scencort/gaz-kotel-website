(function () {
  const API_URL = '/api/orders';
  const ADMIN_KEY_STORAGE = 'adminApiKey';

  function getAdminKeyFromUrl() {
    const url = new URL(window.location.href);
    const key = url.searchParams.get('key');
    if (key) {
      localStorage.setItem(ADMIN_KEY_STORAGE, key);
      url.searchParams.delete('key');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return key;
    }

    return '';
  }

  function getAdminHeaders() {
    const keyFromUrl = getAdminKeyFromUrl();
    const key = keyFromUrl || localStorage.getItem(ADMIN_KEY_STORAGE) || '';
    return key ? { 'x-admin-key': key } : {};
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

  async function fetchOrders() {
    const response = await fetch(API_URL, {
      headers: getAdminHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Требуется ключ администратора');
      }
      throw new Error('Не удалось загрузить заказы');
    }

    return response.json();
  }

  async function updateOrderStatus(orderNumber, status) {
    const response = await fetch(API_URL + '/' + orderNumber + '/status', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAdminHeaders()),
      body: JSON.stringify({ status: status })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Требуется ключ администратора');
      }
      throw new Error('Не удалось обновить статус');
    }
  }

  function ensureAdminKey() {
    const key = localStorage.getItem(ADMIN_KEY_STORAGE);
    if (key) {
      return;
    }

    const entered = window.prompt('Введите ключ администратора (x-admin-key), если включена защита API:', '');
    if (entered) {
      localStorage.setItem(ADMIN_KEY_STORAGE, entered.trim());
    }
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
        return '<li>' + (item.name || 'Товар') + ' — ' + qty + ' шт. x ' + formatPrice(price) + '</li>';
      }).join('');

      card.innerHTML =
        '<div class="order-top">' +
          '<h3 class="order-title">Заказ #' + order.orderNumber + '</h3>' +
          '<span class="status-badge ' + orderStatus + '">' + statusLabel(orderStatus) + '</span>' +
        '</div>' +
        '<div class="order-meta">' +
          '<div><strong>Клиент:</strong> ' + (order.customer ? order.customer.name : '-') + '</div>' +
          '<div><strong>Телефон:</strong> ' + (order.customer ? order.customer.phone : '-') + '</div>' +
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

  function bindStatusActions() {
    document.querySelectorAll('button[data-action="save"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const orderNumber = this.dataset.order;
        const select = document.querySelector('select[data-order="' + orderNumber + '"]');
        if (!select) {
          return;
        }

        try {
          await updateOrderStatus(orderNumber, select.value);
          setStatusMessage('Статус заказа #' + orderNumber + ' обновлён.', false);
          await loadOrders();
        } catch (error) {
          console.error(error);
          setStatusMessage('Ошибка обновления статуса.', true);
        }
      });
    });
  }

  async function loadOrders() {
    try {
      setStatusMessage('Загрузка заказов...', false);
      const orders = await fetchOrders();
      renderOrders(orders);
      setStatusMessage('Заказы загружены: ' + orders.length, false);
    } catch (error) {
      console.error(error);
      setStatusMessage('Не удалось загрузить заказы.', true);
      renderOrders([]);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureAdminKey();

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadOrders);
    }

    loadOrders();
  });
})();

(function () {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const ORDER_API_URL = '/api/orders';
  const DELIVERY_FEE = 700;
  const FREE_DELIVERY_FROM = 80000;
  const PROMOS = {
    TEPLO10: 10,
    GAZ5: 5
  };
  let appliedPromo = null;

  function formatPrice(value) {
    return Number(value).toLocaleString('ru-RU') + ' ₽';
  }

  function showStatus(message, isError) {
    const status = document.getElementById('order-status');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#c62828' : '#2e7d32';
  }

  function showPromoStatus(message, isError) {
    const status = document.getElementById('promoStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#c62828' : '#66d2a4';
  }

  function getItemMeta(item) {
    const productsMap = window.PRODUCTS_MAP || {};
    const product = productsMap[item.id] || null;
    return {
      name: item.name || (product ? product.name : 'Без названия'),
      image: product ? product.image : '',
      shortDescription: product ? product.shortDescription : 'Товар из корзины'
    };
  }

  function renderCart() {
    const container = document.getElementById('cart-container');
    const totalDisplay = document.getElementById('cart-total');
    container.innerHTML = '';

    if (!cart.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-message';
      empty.textContent = 'Корзина пуста';
      container.appendChild(empty);
      renderSummary();
      return;
    }

    cart.forEach(function (item, index) {
      const safePrice = Number(item.price) || 0;
      const safeQuantity = Number(item.quantity) || 1;
      const sum = safePrice * safeQuantity;
      const meta = getItemMeta(item);

      const card = document.createElement('div');
      card.className = 'cart-item';

      const media = document.createElement('div');
      media.className = 'item-media';

      if (meta.image) {
        const thumb = document.createElement('img');
        thumb.src = meta.image;
        thumb.alt = meta.name;
        thumb.loading = 'lazy';
        media.appendChild(thumb);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'item-image-placeholder';
        placeholder.textContent = 'Нет фото';
        media.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'item-info';

      const title = document.createElement('h3');
      title.textContent = meta.name;
      info.appendChild(title);

      const description = document.createElement('p');
      description.className = 'item-description';
      description.textContent = meta.shortDescription;
      info.appendChild(description);

      const price = document.createElement('p');
      price.textContent = 'Цена: ' + formatPrice(safePrice);
      info.appendChild(price);

      const lineTotal = document.createElement('p');
      lineTotal.textContent = 'Сумма: ' + formatPrice(sum);
      info.appendChild(lineTotal);

      const controls = document.createElement('div');
      controls.className = 'item-controls';

      const qtyControl = document.createElement('div');
      qtyControl.className = 'qty-control';

      const decrementButton = document.createElement('button');
      decrementButton.type = 'button';
      decrementButton.className = 'qty-btn';
      decrementButton.textContent = '−';
      decrementButton.addEventListener('click', function () {
        updateQuantity(index, safeQuantity - 1);
      });

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = String(safeQuantity);
      qtyInput.addEventListener('change', function () {
        updateQuantity(index, this.value);
      });

      const incrementButton = document.createElement('button');
      incrementButton.type = 'button';
      incrementButton.className = 'qty-btn';
      incrementButton.textContent = '+';
      incrementButton.addEventListener('click', function () {
        updateQuantity(index, safeQuantity + 1);
      });

      qtyControl.appendChild(decrementButton);
      qtyControl.appendChild(qtyInput);
      qtyControl.appendChild(incrementButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'remove-btn';
      removeButton.textContent = 'Удалить';
      removeButton.addEventListener('click', function () {
        removeItem(index);
      });

      controls.appendChild(qtyControl);
      controls.appendChild(removeButton);
      card.appendChild(media);
      card.appendChild(info);
      card.appendChild(controls);
      container.appendChild(card);
    });

    renderSummary();
  }

  function calculateSummary() {
    const subtotal = cart.reduce(function (sum, item) {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      return sum + price * quantity;
    }, 0);

    const discountPercent = appliedPromo ? (PROMOS[appliedPromo] || 0) : 0;
    const discount = Math.round(subtotal * (discountPercent / 100));
    const discountedSubtotal = subtotal - discount;
    const delivery = discountedSubtotal >= FREE_DELIVERY_FROM || !cart.length ? 0 : DELIVERY_FEE;
    const total = discountedSubtotal + delivery;

    return {
      subtotal: subtotal,
      discountPercent: discountPercent,
      discount: discount,
      delivery: delivery,
      total: total
    };
  }

  function renderSummary() {
    const totalDisplay = document.getElementById('cart-total');
    if (!totalDisplay) return;

    const summary = calculateSummary();
    const discountLabel = summary.discount > 0
      ? '- ' + formatPrice(summary.discount) + ' (' + summary.discountPercent + '%)'
      : formatPrice(0);
    const deliveryLabel = summary.delivery === 0 ? 'Бесплатно' : formatPrice(summary.delivery);

    totalDisplay.innerHTML =
      '<h3 class="summary-title">Сводка заказа</h3>' +
      '<div class="summary-row"><span>Товары</span><strong>' + formatPrice(summary.subtotal) + '</strong></div>' +
      '<div class="summary-row"><span>Скидка</span><strong>' + discountLabel + '</strong></div>' +
      '<div class="summary-row"><span>Доставка</span><strong>' + deliveryLabel + '</strong></div>' +
      '<div class="summary-row total"><span>Итого к оплате</span><strong>' + formatPrice(summary.total) + '</strong></div>';
  }

  function updateQuantity(index, newQty) {
    const qty = parseInt(newQty, 10);
    if (qty < 1 || isNaN(qty)) {
      removeItem(index);
      return;
    }

    cart[index].quantity = qty;
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
  }

  function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCart();
  }

  function generateOrderNumber() {
    const lastOrder = localStorage.getItem('lastOrderNumber');
    const newOrder = lastOrder ? parseInt(lastOrder, 10) + 1 : 1001;
    localStorage.setItem('lastOrderNumber', String(newOrder));
    return newOrder;
  }

  function buildOrderMessage(orderNumber, customer) {
    let message = 'Новый заказ #' + orderNumber + '\n\n';
    message += 'Имя: ' + customer.name + '\n';
    message += 'Телефон: ' + customer.phone + '\n';
    message += 'Email: ' + customer.email;
    if (customer.telegram) {
      message += '\nTelegram: ' + customer.telegram;
    }
    message += '\n\nТовары:\n';

    let total = 0;
    cart.forEach(function (item) {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const sum = price * quantity;
      total += sum;
      message += '- ' + item.name + ' — ' + quantity + ' шт. x ' + formatPrice(price) + ' = ' + formatPrice(sum) + '\n';
    });

    const summary = calculateSummary();
    message += '\nСумма товаров: ' + formatPrice(total);
    if (summary.discount > 0) {
      message += '\nСкидка (' + summary.discountPercent + '%): -' + formatPrice(summary.discount);
    }
    message += '\nДоставка: ' + (summary.delivery === 0 ? 'Бесплатно' : formatPrice(summary.delivery));
    message += '\nИтого: ' + formatPrice(summary.total);
    return message;
  }

  function bindPromoCode() {
    const applyButton = document.getElementById('applyPromoBtn');
    const promoInput = document.getElementById('promoCode');
    if (!applyButton || !promoInput) {
      return;
    }

    applyButton.addEventListener('click', function () {
      const code = promoInput.value.trim().toUpperCase();

      if (!code) {
        appliedPromo = null;
        showPromoStatus('Промокод очищен.', false);
        renderSummary();
        return;
      }

      if (!PROMOS[code]) {
        appliedPromo = null;
        showPromoStatus('Промокод не найден.', true);
        renderSummary();
        return;
      }

      appliedPromo = code;
      showPromoStatus('Промокод ' + code + ' применён: скидка ' + PROMOS[code] + '%.', false);
      renderSummary();
    });
  }

  function bindOrderSubmit() {
    const checkoutButton = document.getElementById('checkout-btn');
    if (!checkoutButton) {
      return;
    }

    checkoutButton.addEventListener('click', async function () {
      const name = document.getElementById('name').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const email = document.getElementById('email').value.trim();
      const telegram = document.getElementById('telegram').value.trim();

      if (!name || !phone || !email) {
        showStatus('Пожалуйста, заполните все обязательные поля.', true);
        return;
      }

      if (!cart.length) {
        showStatus('Корзина пуста.', true);
        return;
      }

      const orderNumber = generateOrderNumber();
      const customer = { name: name, phone: phone, email: email, telegram: telegram };
      const message = buildOrderMessage(orderNumber, customer);
      const summary = calculateSummary();

      try {
        const response = await fetch(ORDER_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: orderNumber,
            customer: customer,
            items: cart,
            pricing: {
              promoCode: appliedPromo,
              discountPercent: summary.discountPercent,
              subtotal: summary.subtotal,
              discount: summary.discount,
              delivery: summary.delivery,
              total: summary.total
            }
          })
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }

        showStatus('Заказ успешно отправлен.', false);
        localStorage.setItem('lastOrderSuccess', JSON.stringify({
          orderNumber: orderNumber,
          total: summary.total,
          customerName: customer.name
        }));
        localStorage.removeItem('cart');
        appliedPromo = null;
        renderCart();
        document.getElementById('order-form').reset();
        window.location.href = 'thank-you.html';
      } catch (error) {
        console.error('Ошибка отправки заказа:', error);
        showStatus('Не удалось отправить заказ на сервер. Скопируйте детали заказа ниже и отправьте менеджеру.', true);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(message);
            showStatus('Сервер недоступен. Детали заказа скопированы в буфер обмена.', true);
          } catch (copyError) {
            console.error('Ошибка копирования заказа:', copyError);
          }
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();
    bindPromoCode();
    bindOrderSubmit();
  });
})();

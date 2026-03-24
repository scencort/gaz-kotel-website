(function () {
  const FAVORITES_KEY = 'favorites';
  const FAVORITES_API_URL = '/api/favorites';
  const clientId = window.getClientId ? window.getClientId() : 'anonymous';

  function getLocalFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch (_error) {
      return [];
    }
  }

  function saveLocalFavorites(ids) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function getFavorites() {
    try {
      const response = await fetch(FAVORITES_API_URL + '?clientId=' + encodeURIComponent(clientId));
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const ids = await response.json();
      saveLocalFavorites(ids);
      return ids;
    } catch (_error) {
      return getLocalFavorites();
    }
  }

  async function removeFavorite(productId) {
    try {
      const response = await fetch(
        FAVORITES_API_URL + '/' + encodeURIComponent(productId) + '?clientId=' + encodeURIComponent(clientId),
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
    } catch (_error) {
      const favorites = getLocalFavorites().filter(function (itemId) {
        return itemId !== productId;
      });
      saveLocalFavorites(favorites);
    }
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    const messageNode = document.getElementById('toastMessage');
    if (!toast || !messageNode) {
      return;
    }

    messageNode.textContent = message;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 2200);
  }

  function addToCart(product) {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(function (item) {
      return item.id === product.id;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      });
    }

    localStorage.setItem('cart', JSON.stringify(cart));
    showToast(product.name + ' добавлен в корзину');
  }

  async function renderFavorites() {
    const list = document.getElementById('favoritesList');
    if (!list) {
      return;
    }

    const favoriteIds = await getFavorites();
    list.innerHTML = '';

    if (!favoriteIds.length) {
      list.innerHTML = '<div class="favorite-empty">У вас пока нет избранных товаров. Добавьте их из каталога.</div>';
      return;
    }

    favoriteIds.forEach(function (id, index) {
      const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[id] : null;
      if (!product) {
        return;
      }

      const safeId = encodeURIComponent(product.id || '');
      const safeName = escapeHtml(product.name || 'Без названия');
      const safeDescription = escapeHtml(product.shortDescription || '');
      const safeImage = escapeHtml(product.image || '');

      const card = document.createElement('article');
      card.className = 'favorite-item';
      card.setAttribute('data-aos', 'zoom-in');
      card.setAttribute('data-aos-delay', String(index * 40));
      card.innerHTML =
        '<img loading="lazy" decoding="async" src="' + safeImage + '" alt="' + safeName + '">' +
        '<h3>' + safeName + '</h3>' +
        '<p>' + safeDescription + '</p>' +
        '<div class="favorite-price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>' +
        '<div class="favorite-actions">' +
          '<a class="btn btn-details" href="product.html?id=' + safeId + '">Открыть карточку</a>' +
          '<button class="btn btn-cart" data-role="add" data-id="' + safeId + '">В корзину</button>' +
          '<button class="btn btn-favorite active" data-role="remove" data-id="' + safeId + '">Убрать из избранного</button>' +
        '</div>';

      list.appendChild(card);
    });

    bindActions();
  }

  function bindActions() {
    document.querySelectorAll('[data-role="add"]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[id] : null;
        if (!product) {
          return;
        }

        addToCart(product);
      });
    });

    document.querySelectorAll('[data-role="remove"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const id = this.dataset.id;
        await removeFavorite(id);
        await renderFavorites();
        showToast('Товар удалён из избранного');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderFavorites();
    if (window.AOS) {
      setTimeout(function () {
        window.AOS.refresh();
      }, 100);
    }
  });

  window.addEventListener('products:updated', function () {
    renderFavorites();
  });
})();

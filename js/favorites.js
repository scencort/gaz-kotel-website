(function () {
  const FAVORITES_KEY = 'favorites';

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    } catch (_error) {
      return [];
    }
  }

  function saveFavorites(ids) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
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

  function renderFavorites() {
    const list = document.getElementById('favoritesList');
    if (!list) {
      return;
    }

    const favoriteIds = getFavorites();
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

      const card = document.createElement('article');
      card.className = 'favorite-item';
      card.setAttribute('data-aos', 'zoom-in');
      card.setAttribute('data-aos-delay', String(index * 40));
      card.innerHTML =
        '<img src="' + product.image + '" alt="' + product.name + '">' +
        '<h3>' + product.name + '</h3>' +
        '<p>' + product.shortDescription + '</p>' +
        '<div class="favorite-price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>' +
        '<div class="favorite-actions">' +
          '<a class="btn btn-details" href="product.html?id=' + product.id + '">Открыть карточку</a>' +
          '<button class="btn btn-cart" data-role="add" data-id="' + product.id + '">В корзину</button>' +
          '<button class="btn btn-favorite active" data-role="remove" data-id="' + product.id + '">Убрать из избранного</button>' +
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
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        const favorites = getFavorites().filter(function (itemId) {
          return itemId !== id;
        });

        saveFavorites(favorites);
        renderFavorites();
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
})();

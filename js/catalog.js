(function () {
  const products = window.PRODUCTS || [];
  const FAVORITES_KEY = 'favorites';
  const state = {
    search: '',
    maxPrice: '',
    maxPower: '',
    maxArea: '',
    sort: 'popular'
  };
  let quickViewProductId = null;

  function parseSpecValue(specs, keyword) {
    const line = specs.find(function (entry) {
      return entry.toLowerCase().indexOf(keyword) !== -1;
    });

    if (!line) {
      return 0;
    }

    const match = line.match(/(\d+[\.,]?\d*)/);
    if (!match) {
      return 0;
    }

    return parseFloat(match[1].replace(',', '.'));
  }

  function getFavoritesSet() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
      return new Set(raw);
    } catch (_error) {
      return new Set();
    }
  }

  function saveFavorites(set) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(set)));
  }

  function filterAndSortProducts() {
    const query = state.search.toLowerCase();

    let filtered = products.filter(function (product) {
      const maxPrice = state.maxPrice ? Number(state.maxPrice) : Infinity;
      if (product.price > maxPrice) {
        return false;
      }

      const power = parseSpecValue(product.specs, 'мощность');
      const maxPower = state.maxPower ? Number(state.maxPower) : Infinity;
      if (state.maxPower === '100') {
        if (power <= 35) {
          return false;
        }
      } else if (power > maxPower) {
        return false;
      }

      const area = parseSpecValue(product.specs, 'площадь обогрева');
      const maxArea = state.maxArea ? Number(state.maxArea) : Infinity;
      if (state.maxArea === '999') {
        if (area <= 300) {
          return false;
        }
      } else if (area > maxArea) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        product.name,
        product.shortDescription,
        (product.specs || []).join(' ')
      ].join(' ').toLowerCase();

      return haystack.indexOf(query) !== -1;
    });

    if (state.sort === 'priceAsc') {
      filtered.sort(function (a, b) { return a.price - b.price; });
    } else if (state.sort === 'priceDesc') {
      filtered.sort(function (a, b) { return b.price - a.price; });
    } else if (state.sort === 'nameAsc') {
      filtered.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
    }

    return filtered;
  }

  function renderProducts() {
    const productList = document.getElementById('productList');
    productList.innerHTML = '';

    if (!products.length) {
      productList.innerHTML = '<p>Каталог временно недоступен. Обновите страницу.</p>';
      return;
    }

    const list = filterAndSortProducts();

    if (!list.length) {
      productList.innerHTML = '<div class="product-empty">По выбранным параметрам ничего не найдено. Попробуйте изменить фильтры.</div>';
      return;
    }

    const favorites = getFavoritesSet();

    list.forEach(function (product, index) {
      const productCard = document.createElement('div');
      productCard.className = 'product';
      productCard.setAttribute('data-aos', 'zoom-in');
      productCard.setAttribute('data-aos-delay', String(index * 50));
      const isFavorite = favorites.has(product.id);

      productCard.innerHTML =
        '<img src="' + product.image + '" alt="' + product.name + '">' +
        '<h3>' + product.name + '</h3>' +
        '<p>' + product.shortDescription + '</p>' +
        '<div class="price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>' +
        '<div class="product-actions">' +
          '<a href="product.html?id=' + product.id + '" class="btn btn-details">Подробнее</a>' +
          '<button class="btn btn-details btn-quick" data-id="' + product.id + '">Быстрый просмотр</button>' +
          '<button class="btn btn-favorite' + (isFavorite ? ' active' : '') + '" data-id="' + product.id + '">' + (isFavorite ? 'В избранном' : 'В избранное') + '</button>' +
          '<button class="btn btn-cart" data-id="' + product.id + '" data-name="' + product.name + '" data-price="' + product.price + '">В корзину</button>' +
        '</div>';

      productList.appendChild(productCard);
    });

    attachCartHandlers();
    attachFavoriteHandlers();
    bindQuickViewButtons();
  }

  function attachFavoriteHandlers() {
    document.querySelectorAll('.btn-favorite').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        const favorites = getFavoritesSet();
        const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[id] : null;

        if (favorites.has(id)) {
          favorites.delete(id);
          this.classList.remove('active');
          this.textContent = 'В избранное';
          showToast('Удалено из избранного');
        } else {
          favorites.add(id);
          this.classList.add('active');
          this.textContent = 'В избранном';
          showToast((product ? product.name : 'Товар') + ' добавлен в избранное');
        }

        saveFavorites(favorites);
      });
    });
  }

  function openQuickView(productId) {
    const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[productId] : null;
    const quickView = document.getElementById('quickView');
    const quickImage = document.getElementById('quickImage');
    const quickTitle = document.getElementById('quickViewTitle');
    const quickDescription = document.getElementById('quickDescription');
    const quickPrice = document.getElementById('quickPrice');
    const quickDetailsLink = document.getElementById('quickDetailsLink');

    if (!product || !quickView || !quickImage || !quickTitle || !quickDescription || !quickPrice || !quickDetailsLink) {
      return;
    }

    quickViewProductId = productId;
    quickImage.src = product.image;
    quickImage.alt = product.name;
    quickTitle.textContent = product.name;
    quickDescription.textContent = product.shortDescription;
    quickPrice.textContent = product.price.toLocaleString('ru-RU') + ' ₽';
    quickDetailsLink.href = 'product.html?id=' + product.id;
    quickView.classList.add('open');
    quickView.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeQuickView() {
    const quickView = document.getElementById('quickView');
    if (!quickView) {
      return;
    }

    quickView.classList.remove('open');
    quickView.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function bindQuickViewButtons() {
    document.querySelectorAll('.btn-quick').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        openQuickView(id);
      });
    });
  }

  function bindQuickViewStaticActions() {
    const quickClose = document.getElementById('quickClose');
    const quickBackdrop = document.getElementById('quickViewBackdrop');
    const quickAddBtn = document.getElementById('quickAddBtn');

    if (quickClose) {
      quickClose.addEventListener('click', closeQuickView);
    }

    if (quickBackdrop) {
      quickBackdrop.addEventListener('click', closeQuickView);
    }

    if (quickAddBtn) {
      quickAddBtn.addEventListener('click', function () {
        const product = quickViewProductId && window.PRODUCTS_MAP ? window.PRODUCTS_MAP[quickViewProductId] : null;
        if (!product) {
          return;
        }

        addToCart(product.id, product.name, product.price);
        closeQuickView();
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeQuickView();
      }
    });
  }

  function bindCatalogControls() {
    const searchInput = document.getElementById('searchInput');
    const priceFilter = document.getElementById('priceFilter');
    const powerFilter = document.getElementById('powerFilter');
    const areaFilter = document.getElementById('areaFilter');
    const sortSelect = document.getElementById('sortSelect');
    const resetFilters = document.getElementById('resetFilters');

    if (!searchInput || !priceFilter || !powerFilter || !areaFilter || !sortSelect || !resetFilters) {
      return;
    }

    searchInput.addEventListener('input', function () {
      state.search = this.value.trim();
      renderProducts();
    });

    priceFilter.addEventListener('change', function () {
      state.maxPrice = this.value;
      renderProducts();
    });

    powerFilter.addEventListener('change', function () {
      state.maxPower = this.value;
      renderProducts();
    });

    areaFilter.addEventListener('change', function () {
      state.maxArea = this.value;
      renderProducts();
    });

    sortSelect.addEventListener('change', function () {
      state.sort = this.value;
      renderProducts();
    });

    resetFilters.addEventListener('click', function () {
      state.search = '';
      state.maxPrice = '';
      state.maxPower = '';
      state.maxArea = '';
      state.sort = 'popular';

      searchInput.value = '';
      priceFilter.value = '';
      powerFilter.value = '';
      areaFilter.value = '';
      sortSelect.value = 'popular';

      renderProducts();
    });
  }

  function attachCartHandlers() {
    document.querySelectorAll('.btn-cart').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = this.dataset.id;
        const name = this.dataset.name;
        const price = parseInt(this.dataset.price, 10);

        addToCart(id, name, price);
      });
    });
  }

  function addToCart(id, name, price) {
    try {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      const existing = cart.find(function (item) {
        return item.id === id;
      });

      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ id: id, name: name, price: price, quantity: 1 });
      }

      localStorage.setItem('cart', JSON.stringify(cart));

      updateCartBadge();
      showToast(name + ' добавлен в корзину!');
    } catch (error) {
      console.error('Ошибка при добавлении в корзину:', error);
      showToast('Ошибка! Попробуйте снова.', false);
    }
  }

  function updateCartBadge() {
    try {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      const totalItems = cart.reduce(function (sum, item) {
        return sum + item.quantity;
      }, 0);
      const badge = document.getElementById('cartBadge');

      if (badge) {
        badge.textContent = String(totalItems);
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
      }
    } catch (error) {
      console.error('Ошибка при обновлении счётчика:', error);
    }
  }

  function showToast(message, isSuccess) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const success = typeof isSuccess === 'boolean' ? isSuccess : true;

    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.style.backgroundColor = success ? '#4caf50' : '#f44336';
      toast.classList.add('show');

      setTimeout(function () {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindQuickViewStaticActions();
    bindCatalogControls();
    renderProducts();
    updateCartBadge();

    if (window.AOS) {
      setTimeout(function () {
        window.AOS.refresh();
      }, 100);
    }
  });
})();

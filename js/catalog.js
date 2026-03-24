(function () {
  const FAVORITES_KEY = 'favorites';
  const FAVORITES_API_URL = '/api/favorites';
  const PRODUCTS_PER_PAGE = 6;
  const clientId = window.getClientId ? window.getClientId() : 'anonymous';
  const state = {
    search: '',
    maxPrice: '',
    maxPower: '',
    maxArea: '',
    series: '',
    chamber: '',
    sort: 'popular',
    page: 1
  };
  let quickViewProductId = null;
  let favoritesCache = new Set();

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

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSpecLine(specs, keyword) {
    return (specs || []).find(function (entry) {
      return entry.toLowerCase().indexOf(keyword) !== -1;
    }) || '';
  }

  function getSeriesFromName(name) {
    const value = String(name || '').toLowerCase();
    if (value.indexOf('аогв') !== -1) {
      return 'aogv';
    }

    if (value.indexOf('ишма') !== -1) {
      return 'ishma';
    }

    return '';
  }

  function getFavoritesSet() {
    return new Set(favoritesCache);
  }

  function saveFavorites(set) {
    favoritesCache = new Set(set);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(set)));
  }

  async function syncFavoritesFromApi() {
    try {
      const response = await fetch(FAVORITES_API_URL + '?clientId=' + encodeURIComponent(clientId));
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const ids = await response.json();
      const set = new Set(Array.isArray(ids) ? ids : []);
      saveFavorites(set);
      return set;
    } catch (_error) {
      try {
        const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
        const set = new Set(raw);
        saveFavorites(set);
        return set;
      } catch (_fallbackError) {
        const empty = new Set();
        saveFavorites(empty);
        return empty;
      }
    }
  }

  async function addFavoriteToApi(productId) {
    const response = await fetch(FAVORITES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId, productId: productId })
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
  }

  async function removeFavoriteFromApi(productId) {
    const response = await fetch(
      FAVORITES_API_URL + '/' + encodeURIComponent(productId) + '?clientId=' + encodeURIComponent(clientId),
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
  }

  function filterAndSortProducts() {
    const products = window.PRODUCTS || [];
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

      if (state.series && getSeriesFromName(product.name) !== state.series) {
        return false;
      }

      if (state.chamber) {
        const chamberLine = getSpecLine(product.specs, 'тип камеры сгорания').toLowerCase();
        const isOpen = chamberLine.indexOf('открытая') !== -1;
        const isClosed = chamberLine.indexOf('закрытая') !== -1;

        if ((state.chamber === 'open' && !isOpen) || (state.chamber === 'closed' && !isClosed)) {
          return false;
        }
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
    } else if (state.sort === 'nameDesc') {
      filtered.sort(function (a, b) { return b.name.localeCompare(a.name, 'ru'); });
    } else if (state.sort === 'powerAsc') {
      filtered.sort(function (a, b) {
        return parseSpecValue(a.specs || [], 'мощность') - parseSpecValue(b.specs || [], 'мощность');
      });
    } else if (state.sort === 'powerDesc') {
      filtered.sort(function (a, b) {
        return parseSpecValue(b.specs || [], 'мощность') - parseSpecValue(a.specs || [], 'мощность');
      });
    } else if (state.sort === 'areaAsc') {
      filtered.sort(function (a, b) {
        return parseSpecValue(a.specs || [], 'площадь обогрева') - parseSpecValue(b.specs || [], 'площадь обогрева');
      });
    } else if (state.sort === 'areaDesc') {
      filtered.sort(function (a, b) {
        return parseSpecValue(b.specs || [], 'площадь обогрева') - parseSpecValue(a.specs || [], 'площадь обогрева');
      });
    }

    return filtered;
  }

  function renderProducts() {
    const productList = document.getElementById('productList');
    const pagination = document.getElementById('catalogPagination');
    productList.innerHTML = '';
    const products = window.PRODUCTS || [];

    if (!products.length) {
      productList.innerHTML = '<p>Каталог временно недоступен. Обновите страницу.</p>';
      if (pagination) {
        pagination.innerHTML = '';
      }
      return;
    }

    const list = filterAndSortProducts();
    const totalPages = Math.max(1, Math.ceil(list.length / PRODUCTS_PER_PAGE));

    if (state.page > totalPages) {
      state.page = totalPages;
    }

    const startIndex = (state.page - 1) * PRODUCTS_PER_PAGE;
    const visibleList = list.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);

    if (!list.length) {
      productList.innerHTML = '<div class="product-empty">По выбранным параметрам ничего не найдено. Попробуйте изменить фильтры.</div>';
      if (pagination) {
        pagination.innerHTML = '';
      }
      return;
    }

    const favorites = getFavoritesSet();

    visibleList.forEach(function (product, index) {
      const productCard = document.createElement('div');
      productCard.className = 'product';
      productCard.setAttribute('data-aos', 'zoom-in');
      productCard.setAttribute('data-aos-delay', String(index * 50));
      const isFavorite = favorites.has(product.id);
      const safeId = encodeURIComponent(product.id || '');
      const safeName = escapeHtml(product.name || 'Без названия');
      const safeDescription = escapeHtml(product.shortDescription || '');
      const safeImage = escapeHtml(product.image || '');

      productCard.innerHTML =
        '<img src="' + safeImage + '" alt="' + safeName + '">' +
        '<h3>' + safeName + '</h3>' +
        '<p>' + safeDescription + '</p>' +
        '<div class="price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>' +
        '<div class="product-actions">' +
          '<a href="product.html?id=' + safeId + '" class="btn btn-details">Подробнее</a>' +
          '<button class="btn btn-details btn-quick" data-id="' + safeId + '">Быстрый просмотр</button>' +
          '<button class="btn btn-favorite' + (isFavorite ? ' active' : '') + '" data-id="' + safeId + '">' + (isFavorite ? 'В избранном' : 'В избранное') + '</button>' +
          '<button class="btn btn-cart" data-id="' + safeId + '" data-name="' + safeName + '" data-price="' + product.price + '">В корзину</button>' +
        '</div>';

      productList.appendChild(productCard);
    });

    attachCartHandlers();
    attachFavoriteHandlers();
    bindQuickViewButtons();
    renderPagination(totalPages, list.length);
  }

  function getPaginationItems(totalPages, currentPage) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, function (_item, index) {
        return index + 1;
      });
    }

    const pages = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) {
      pages.push('...');
    }

    for (let page = left; page <= right; page += 1) {
      pages.push(page);
    }

    if (right < totalPages - 1) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  }

  function renderPagination(totalPages, totalItems) {
    const pagination = document.getElementById('catalogPagination');
    if (!pagination) {
      return;
    }

    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    const items = getPaginationItems(totalPages, state.page);
    const prevDisabled = state.page <= 1 ? ' disabled' : '';
    const nextDisabled = state.page >= totalPages ? ' disabled' : '';

    pagination.innerHTML =
      '<button class="pagination-btn" data-page="' + (state.page - 1) + '"' + prevDisabled + '>Назад</button>' +
      '<div class="pagination-pages">' +
      items.map(function (item) {
        if (item === '...') {
          return '<span class="pagination-ellipsis">...</span>';
        }

        const activeClass = item === state.page ? ' active' : '';
        return '<button class="pagination-btn pagination-num' + activeClass + '" data-page="' + item + '">' + item + '</button>';
      }).join('') +
      '</div>' +
      '<button class="pagination-btn" data-page="' + (state.page + 1) + '"' + nextDisabled + '>Далее</button>' +
      '<p class="pagination-meta">Страница ' + state.page + ' из ' + totalPages + ' • Товаров: ' + totalItems + '</p>';
  }

  function bindPaginationControls() {
    const pagination = document.getElementById('catalogPagination');
    if (!pagination) {
      return;
    }

    pagination.addEventListener('click', function (event) {
      const target = event.target.closest('.pagination-btn');
      if (!target || target.disabled) {
        return;
      }

      const page = Number(target.dataset.page || 1);
      if (!Number.isFinite(page) || page < 1 || page === state.page) {
        return;
      }

      state.page = page;
      renderProducts();

      const top = document.querySelector('.catalog-controls');
      if (top) {
        top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function attachFavoriteHandlers() {
    document.querySelectorAll('.btn-favorite').forEach(function (button) {
      button.addEventListener('click', async function () {
        const id = this.dataset.id;
        const favorites = getFavoritesSet();
        const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[id] : null;

        if (favorites.has(id)) {
          try {
            await removeFavoriteFromApi(id);
            favorites.delete(id);
            this.classList.remove('active');
            this.textContent = 'В избранное';
            showToast('Удалено из избранного');
          } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            favorites.delete(id);
            this.classList.remove('active');
            this.textContent = 'В избранное';
            showToast('Сохранено локально (без сервера)');
          }
        } else {
          try {
            await addFavoriteToApi(id);
            favorites.add(id);
            this.classList.add('active');
            this.textContent = 'В избранном';
            showToast((product ? product.name : 'Товар') + ' добавлен в избранное');
          } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
            favorites.add(id);
            this.classList.add('active');
            this.textContent = 'В избранном';
            showToast('Сохранено локально (без сервера)');
          }
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
    const seriesFilter = document.getElementById('seriesFilter');
    const chamberFilter = document.getElementById('chamberFilter');
    const sortSelect = document.getElementById('sortSelect');
    const resetFilters = document.getElementById('resetFilters');

    if (!searchInput || !priceFilter || !powerFilter || !areaFilter || !seriesFilter || !chamberFilter || !sortSelect || !resetFilters) {
      return;
    }

    searchInput.addEventListener('input', function () {
      state.search = this.value.trim();
      state.page = 1;
      renderProducts();
    });

    priceFilter.addEventListener('change', function () {
      state.maxPrice = this.value;
      state.page = 1;
      renderProducts();
    });

    powerFilter.addEventListener('change', function () {
      state.maxPower = this.value;
      state.page = 1;
      renderProducts();
    });

    areaFilter.addEventListener('change', function () {
      state.maxArea = this.value;
      state.page = 1;
      renderProducts();
    });

    seriesFilter.addEventListener('change', function () {
      state.series = this.value;
      state.page = 1;
      renderProducts();
    });

    chamberFilter.addEventListener('change', function () {
      state.chamber = this.value;
      state.page = 1;
      renderProducts();
    });

    sortSelect.addEventListener('change', function () {
      state.sort = this.value;
      state.page = 1;
      renderProducts();
    });

    resetFilters.addEventListener('click', function () {
      state.search = '';
      state.maxPrice = '';
      state.maxPower = '';
      state.maxArea = '';
      state.series = '';
      state.chamber = '';
      state.sort = 'popular';
      state.page = 1;

      searchInput.value = '';
      priceFilter.value = '';
      powerFilter.value = '';
      areaFilter.value = '';
      seriesFilter.value = '';
      chamberFilter.value = '';
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
    bindPaginationControls();
    syncFavoritesFromApi().then(function () {
      renderProducts();
    });
    updateCartBadge();

    if (window.AOS) {
      setTimeout(function () {
        window.AOS.refresh();
      }, 100);
    }
  });

  window.addEventListener('products:updated', function () {
    renderProducts();
  });
})();

(function () {
  const PRODUCTS_API_URL = '/api/products';

  function applyProducts(data) {
    const list = Array.isArray(data) ? data : [];
    window.PRODUCTS = list;
    window.PRODUCTS_MAP = list.reduce(function (acc, product) {
      acc[product.id] = product;
      return acc;
    }, {});
    window.dispatchEvent(new CustomEvent('products:updated', { detail: { count: list.length } }));
  }
  // Источник данных каталога - только PostgreSQL через backend API.
  applyProducts([]);

  fetch(PRODUCTS_API_URL)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    })
    .then(function (remoteProducts) {
      applyProducts(remoteProducts);
    })
    .catch(function (error) {
      console.warn('Не удалось загрузить товары из API. Каталог будет пуст до восстановления backend/БД.', error);
    });
})();

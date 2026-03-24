(function () {
  let currentProductId = null;

  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  function bindBackButton() {
    const backButton = document.getElementById('backButton');
    if (!backButton) {
      return;
    }

    backButton.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'catalog.html';
      }
    });
  }

  function renderProduct(productId) {
    const container = document.getElementById('product-container');
    const product = window.PRODUCTS_MAP ? window.PRODUCTS_MAP[productId] : null;

    if (!product) {
      container.innerHTML = '<p class="error-message">Ошибка: продукт не найден.</p>';
      return;
    }

    const imagePath = product.image;
    const formattedPrice = product.price.toLocaleString('ru-RU') + ' ₽';

    const descriptionHtml = product.description.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('');

    const specsHtml = product.specs.map(function (item) {
      return '<li>' + item + '</li>';
    }).join('');

    container.innerHTML =
      '<button type="button" class="back-button" id="backButton">Назад</button>' +
      '<img src="' + imagePath + '" alt="' + product.name + '" />' +
      '<h2>' + product.name + '</h2>' +
      descriptionHtml +
      '<ul>' + specsHtml + '</ul>' +
      '<strong>Цена: ' + formattedPrice + '</strong>';

    bindBackButton();

    document.title = 'Газ-Котёл | ' + product.name;
  }

  document.addEventListener('DOMContentLoaded', function () {
    currentProductId = getQueryParam('id');
    if (!currentProductId) {
      document.getElementById('product-container').innerHTML = '<p class="error-message">Ошибка: не указан продукт.</p>';
      return;
    }

    renderProduct(currentProductId);
  });

  window.addEventListener('products:updated', function () {
    if (currentProductId) {
      renderProduct(currentProductId);
    }
  });
})();

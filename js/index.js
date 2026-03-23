(function () {
  function renderHighlights() {
    const featuredIds = ['boiler1', 'boiler5', 'boiler10'];
    const highlightList = document.getElementById('highlightList');

    if (!highlightList || !window.PRODUCTS_MAP) {
      return;
    }

    highlightList.innerHTML = '';

    featuredIds.forEach(function (id, index) {
      const product = window.PRODUCTS_MAP[id];
      if (!product) {
        return;
      }

      const card = document.createElement('a');
      card.href = 'product.html?id=' + product.id;
      card.className = 'highlight-product';
      card.setAttribute('data-aos', 'zoom-in');
      card.setAttribute('data-aos-delay', String(250 + index * 100));
      card.innerHTML =
        '<img src="' + product.image + '" alt="' + product.name + '">' +
        '<h3>' + product.name + '</h3>' +
        '<p>' + product.shortDescription + '</p>' +
        '<div class="price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>';

      highlightList.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHighlights();
    if (window.AOS) {
      window.AOS.refresh();
    }
  });
})();

(function () {
  const REVIEWS_API_URL = '/api/reviews';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
      const safeId = encodeURIComponent(product.id || '');
      const safeName = escapeHtml(product.name || 'Без названия');
      const safeImage = escapeHtml(product.image || '');
      const safeDescription = escapeHtml(product.shortDescription || '');
      card.innerHTML =
        '<img loading="lazy" decoding="async" src="' + safeImage + '" alt="' + safeName + '">' +
        '<h3>' + safeName + '</h3>' +
        '<p>' + safeDescription + '</p>' +
        '<div class="price">' + product.price.toLocaleString('ru-RU') + ' ₽</div>';
      card.href = 'product.html?id=' + safeId;

      highlightList.appendChild(card);
    });
  }

  function setReviewStatus(message, isError) {
    const node = document.getElementById('reviewStatus');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? '#ff98a9' : '#9fe0c7';
  }

  function renderReviews(reviews) {
    const root = document.getElementById('reviewsList');
    if (!root) {
      return;
    }

    root.innerHTML = '';
    if (!Array.isArray(reviews) || !reviews.length) {
      root.innerHTML = '<article class="review-card"><h3>Пока нет отзывов</h3><p>Станьте первым, кто оставит отзыв.</p></article>';
      return;
    }

    reviews.forEach(function (review) {
      const rating = Number(review.rating || 0);
      const safeRating = rating >= 1 && rating <= 5 ? rating : 5;
      const card = document.createElement('article');
      card.className = 'review-card';
      card.innerHTML =
        '<h3>' + escapeHtml(review.author || 'Гость') + '</h3>' +
        '<p>' + escapeHtml(review.content || '') + '</p>' +
        '<span>Оценка: ' + safeRating + '/5</span>';
      root.appendChild(card);
    });
  }

  async function loadReviews() {
    try {
      const response = await fetch(REVIEWS_API_URL + '?limit=9');
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const reviews = await response.json();
      renderReviews(reviews);
    } catch (_error) {
      renderReviews([]);
    }
  }

  function bindReviewForm() {
    const form = document.getElementById('reviewForm');
    if (!form) {
      return;
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const author = (document.getElementById('reviewAuthor').value || '').trim();
      const content = (document.getElementById('reviewContent').value || '').trim();
      const rating = Number(document.getElementById('reviewRating').value || 5);

      if (!author || !content) {
        setReviewStatus('Заполните имя и текст отзыва.', true);
        return;
      }

      try {
        const response = await fetch(REVIEWS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: author, content: content, rating: rating })
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }

        form.reset();
        setReviewStatus('Спасибо! Отзыв добавлен.', false);
        await loadReviews();
      } catch (_error) {
        setReviewStatus('Не удалось отправить отзыв. Попробуйте позже.', true);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderHighlights();
    bindReviewForm();
    loadReviews();
    if (window.AOS) {
      window.AOS.refresh();
    }
  });

  window.addEventListener('products:updated', function () {
    renderHighlights();
  });
})();

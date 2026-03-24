(function () {
  function parseSpecValue(specs, keyword) {
    const line = (specs || []).find(function (entry) {
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

  function formatPower(value) {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function getRecommendedProductsByPower(targetPower, minPower, maxPower) {
    const products = (window.PRODUCTS || []).map(function (product) {
      return {
        product: product,
        power: parseSpecValue(product.specs || [], 'мощность')
      };
    }).filter(function (entry) {
      return entry.power > 0;
    });

    const inRange = products.filter(function (entry) {
      return entry.power >= minPower && entry.power <= maxPower;
    });

    const pool = inRange.length ? inRange : products;
    return pool
      .sort(function (a, b) {
        return Math.abs(a.power - targetPower) - Math.abs(b.power - targetPower);
      })
      .slice(0, 3);
  }

  function bindPowerCalculator() {
    const areaInput = document.getElementById('calcArea');
    const ceilingSelect = document.getElementById('calcCeiling');
    const insulationSelect = document.getElementById('calcInsulation');
    const climateSelect = document.getElementById('calcClimate');
    const reserveSelect = document.getElementById('calcReserve');
    const submitButton = document.getElementById('calcSubmit');
    const resetButton = document.getElementById('calcReset');
    const resultNode = document.getElementById('calcResult');
    const hintNode = document.getElementById('calcHint');
    const modelsNode = document.getElementById('calcModels');

    if (!areaInput || !ceilingSelect || !insulationSelect || !climateSelect || !reserveSelect || !submitButton || !resetButton || !resultNode || !hintNode || !modelsNode) {
      return;
    }

    function clearResult() {
      resultNode.querySelector('.faq-calc-result-main').textContent = 'Заполните параметры и нажмите «Рассчитать».';
      hintNode.textContent = '';
      modelsNode.innerHTML = '';
    }

    submitButton.addEventListener('click', function () {
      const area = Number(areaInput.value);
      const ceiling = Number(ceilingSelect.value || 2.7);
      const insulation = Number(insulationSelect.value || 1);
      const climate = Number(climateSelect.value || 1);
      const reserve = Number(reserveSelect.value || 0.15);

      if (!Number.isFinite(area) || area <= 0) {
        resultNode.querySelector('.faq-calc-result-main').textContent = 'Введите корректную площадь дома.';
        hintNode.textContent = 'Например: 120';
        modelsNode.innerHTML = '';
        return;
      }

      const ceilingFactor = ceiling / 2.7;
      const basePower = (area / 10) * ceilingFactor * insulation * climate;
      const recommended = basePower * (1 + reserve);
      const minPower = recommended * 0.9;
      const maxPower = recommended * 1.1;

      resultNode.querySelector('.faq-calc-result-main').textContent =
        'Рекомендуемая мощность: ' + formatPower(recommended) + ' кВт';
      hintNode.textContent =
        'Оптимальный диапазон: ' + formatPower(minPower) + '–' + formatPower(maxPower) + ' кВт.';

      const suggested = getRecommendedProductsByPower(recommended, minPower, maxPower);
      if (!suggested.length) {
        modelsNode.innerHTML = '<div class="faq-calc-model">Подходящие модели не найдены. Попробуйте изменить параметры расчета.</div>';
        return;
      }

      modelsNode.innerHTML = suggested.map(function (entry) {
        const product = entry.product;
        return '<div class="faq-calc-model">' +
          '<a href="product.html?id=' + product.id + '">' + product.name + '</a>' +
          '<span>' + formatPower(entry.power) + ' кВт</span>' +
          '</div>';
      }).join('');
    });

    resetButton.addEventListener('click', function () {
      areaInput.value = '';
      ceilingSelect.value = '2.7';
      insulationSelect.value = '1';
      climateSelect.value = '1';
      reserveSelect.value = '0.15';
      clearResult();
    });
  }

  function bindDeliveryCalculator() {
    const zoneSelect = document.getElementById('deliveryZone');
    const distanceInput = document.getElementById('deliveryDistance');
    const liftSelect = document.getElementById('deliveryLift');
    const urgencySelect = document.getElementById('deliveryUrgency');
    const serviceSelect = document.getElementById('deliveryService');
    const submitButton = document.getElementById('deliverySubmit');
    const resetButton = document.getElementById('deliveryReset');
    const resultNode = document.getElementById('deliveryResult');
    const hintNode = document.getElementById('deliveryHint');

    if (!zoneSelect || !distanceInput || !liftSelect || !urgencySelect || !serviceSelect || !submitButton || !resetButton || !resultNode || !hintNode) {
      return;
    }

    function clearResult() {
      resultNode.querySelector('.faq-calc-result-main').textContent = 'Укажите параметры доставки и нажмите «Рассчитать доставку».';
      hintNode.textContent = '';
    }

    submitButton.addEventListener('click', function () {
      const zone = zoneSelect.value;
      const distance = Number(distanceInput.value || 0);
      const lift = Number(liftSelect.value || 0);
      const urgency = Number(urgencySelect.value || 0);
      const service = Number(serviceSelect.value || 0);

      if (!Number.isFinite(distance) || distance < 0) {
        resultNode.querySelector('.faq-calc-result-main').textContent = 'Введите корректное расстояние в километрах.';
        hintNode.textContent = 'Пример: 15';
        return;
      }

      let base = 900;
      if (zone === 'near') {
        base = 1500;
      } else if (zone === 'far') {
        base = 2300;
      }

      const kmRate = zone === 'city' ? 35 : 55;
      const distancePart = distance * kmRate;
      const subtotal = base + distancePart + lift + urgency + service;
      const minTotal = Math.max(0, Math.round(subtotal * 0.95));
      const maxTotal = Math.max(minTotal, Math.round(subtotal * 1.1));

      resultNode.querySelector('.faq-calc-result-main').textContent =
        'Ориентировочная стоимость доставки: ' + minTotal.toLocaleString('ru-RU') + '–' + maxTotal.toLocaleString('ru-RU') + ' ₽';

      hintNode.textContent =
        'Включены: зона, расстояние, подъем, срочность и дополнительные услуги. Точную сумму подтвердит менеджер.';
    });

    resetButton.addEventListener('click', function () {
      zoneSelect.value = 'city';
      distanceInput.value = '';
      liftSelect.value = '0';
      urgencySelect.value = '0';
      serviceSelect.value = '0';
      clearResult();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindPowerCalculator();
    bindDeliveryCalculator();
  });
})();

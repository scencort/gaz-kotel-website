(function () {
  document.addEventListener('DOMContentLoaded', function () {
    const metaNode = document.getElementById('orderMeta');
    const messageNode = document.getElementById('thankMessage');
    if (!metaNode || !messageNode) {
      return;
    }

    const raw = localStorage.getItem('lastOrderSuccess');
    if (!raw) {
      metaNode.innerHTML = '<div>Номер заказа: будет присвоен после оформления</div>';
      return;
    }

    try {
      const order = JSON.parse(raw);
      const orderNumber = order.orderNumber || '-';
      const customerName = order.customerName || 'Клиент';
      const total = Number(order.total || 0).toLocaleString('ru-RU') + ' ₽';

      messageNode.textContent = customerName + ', ваш заказ успешно оформлен.';
      metaNode.innerHTML =
        '<div><strong>Номер заказа:</strong> #' + orderNumber + '</div>' +
        '<div><strong>Сумма к оплате:</strong> ' + total + '</div>' +
        '<div><strong>Статус:</strong> принят в обработку</div>';
    } catch (error) {
      console.error('Ошибка чтения данных заказа:', error);
      metaNode.innerHTML = '<div>Заказ оформлен. Подробности доступны в письме/звонке менеджера.</div>';
    }
  });
})();

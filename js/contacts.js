(function () {
  const CONTACTS_API_URL = '/api/contacts';

  function bindContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) {
      return;
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      try {
        const response = await fetch(CONTACTS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }

        alert('Спасибо за обращение! Мы свяжемся с вами в ближайшее время.');
        form.reset();
      } catch (error) {
        console.error('Ошибка отправки формы:', error);
        alert('Не удалось отправить сообщение. Попробуйте позже.');
      }
    });
  }

  function bindPhoneMask() {
    const phoneInput = document.getElementById('phone');
    if (!phoneInput) {
      return;
    }

    phoneInput.addEventListener('input', function (e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 0) {
        if (value[0] === '8') value = '7' + value.slice(1);
        if (value[0] !== '7') value = '7' + value;
      }

      let formatted = '+7';
      if (value.length > 1) {
        formatted += ' (' + value.substring(1, 4);
      }
      if (value.length >= 5) {
        formatted += ') ' + value.substring(4, 7);
      }
      if (value.length >= 8) {
        formatted += '-' + value.substring(7, 9);
      }
      if (value.length >= 10) {
        formatted += '-' + value.substring(9, 11);
      }

      e.target.value = formatted;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindContactForm();
    bindPhoneMask();
  });
})();

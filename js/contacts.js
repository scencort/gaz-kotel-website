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

  function updateWorktimeStatus() {
    const statusNode = document.getElementById('worktimeStatus');
    const hourHand = document.getElementById('worktimeHourHand');
    const minuteHand = document.getElementById('worktimeMinuteHand');
    if (!statusNode) {
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentMinutes = hour * 60 + minute;
    const start = 8 * 60;
    const end = 22 * 60;
    const isOpen = currentMinutes >= start && currentMinutes < end;

    if (hourHand) {
      const hourAngle = ((hour % 12) + minute / 60) * 30;
      hourHand.style.transform = 'translateX(-50%) rotate(' + hourAngle + 'deg)';
    }

    if (minuteHand) {
      const minuteAngle = minute * 6;
      minuteHand.style.transform = 'translateX(-50%) rotate(' + minuteAngle + 'deg)';
    }

    statusNode.classList.remove('open', 'closed');
    if (isOpen) {
      statusNode.textContent = 'Сейчас открыто до 22:00';
      statusNode.classList.add('open');
    } else {
      statusNode.textContent = 'Сейчас закрыто. Откроемся в 08:00';
      statusNode.classList.add('closed');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindContactForm();
    bindPhoneMask();
    updateWorktimeStatus();
    setInterval(updateWorktimeStatus, 60000);
  });
})();

(function () {
  const TRANSITION_MS = 260;

  function markPageReady() {
    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
    });
  }

  function bindPageTransitions() {
    const currentOrigin = window.location.origin;

    document.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        if (link.target === '_blank') return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        let url;
        try {
          url = new URL(link.href);
        } catch (_error) {
          return;
        }

        if (url.origin !== currentOrigin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;

        event.preventDefault();
        document.body.classList.add('is-leaving');

        setTimeout(function () {
          window.location.href = link.href;
        }, TRANSITION_MS);
      });
    });
  }

  function injectMobileMenuButton() {
    const header = document.querySelector('header');
    const nav = document.querySelector('header nav');
    if (!header || !nav || document.querySelector('.menu-toggle')) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-toggle';
    button.setAttribute('aria-label', 'Открыть меню');
    button.setAttribute('aria-controls', 'site-nav');
    button.setAttribute('aria-expanded', 'false');

    if (!nav.id) {
      nav.id = 'site-nav';
    }

    const icon = document.createElement('span');
    icon.className = 'menu-icon';
    button.appendChild(icon);

    button.addEventListener('click', function () {
      const isOpen = document.body.classList.toggle('menu-open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      button.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
    });

    header.appendChild(button);
  }

  function bindResponsiveMenuAutoClose() {
    const nav = document.querySelector('header nav');
    if (!nav) return;

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        document.body.classList.remove('menu-open');
        const toggle = document.querySelector('.menu-toggle');
        if (toggle) {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', 'Открыть меню');
        }
      });
    });
  }

  function setupFormMicroInteractions() {
    const fields = document.querySelectorAll('input, textarea');
    if (!fields.length) return;

    fields.forEach(function (field) {
      field.addEventListener('blur', function () {
        if (!field.value) {
          field.classList.remove('field-valid', 'field-invalid');
          return;
        }

        if (field.checkValidity()) {
          field.classList.add('field-valid');
          field.classList.remove('field-invalid');
        } else {
          field.classList.add('field-invalid');
          field.classList.remove('field-valid');
        }
      });

      field.addEventListener('input', function () {
        if (!field.classList.contains('field-invalid')) {
          return;
        }

        if (field.checkValidity()) {
          field.classList.add('field-valid');
          field.classList.remove('field-invalid');
        }
      });
    });
  }

  function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav a').forEach(function (link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === currentPage) {
        link.classList.add('active');
      }
    });
  }

  function initAOS() {
    if (!window.AOS) {
      return;
    }

    window.AOS.init({
      duration: 800,
      once: true
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    markPageReady();
    injectMobileMenuButton();
    setActiveNavLink();
    bindResponsiveMenuAutoClose();
    bindPageTransitions();
    setupFormMicroInteractions();
    initAOS();
  });
})();

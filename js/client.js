(function () {
  const CLIENT_KEY = 'clientId';

  function ensureClientId() {
    let id = localStorage.getItem(CLIENT_KEY);
    if (id) {
      return id;
    }

    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      id = window.crypto.randomUUID();
    } else {
      id = 'client-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    }

    localStorage.setItem(CLIENT_KEY, id);
    return id;
  }

  window.getClientId = ensureClientId;
})();

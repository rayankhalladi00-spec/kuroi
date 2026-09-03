/* Chargé en tête de page, avant le rendu : applique le thème immédiatement,
   sinon la page clignote en sombre avant de passer en clair.
   La politique de sécurité interdit les scripts en ligne, d'où ce fichier. */
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('kuroi-theme');
  } catch (e) {
    /* navigation privée ou stockage bloqué : on retombe sur les préférences système */
  }

  var theme =
    stored ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

  document.documentElement.setAttribute('data-theme', theme);
})();

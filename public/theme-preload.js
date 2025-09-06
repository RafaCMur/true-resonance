(function() {
  try {
    var theme = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', theme || 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

// Applies saved or system theme immediately on page load
(function () {
  try {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || theme === 'theme-light') {
      document.documentElement.classList[theme === 'dark' ? 'add' : 'remove']('dark');
    } else if (theme === 'system' || theme === null) {
      var prefers = false;
      try { prefers = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch(e) {}
      document.documentElement.classList[prefers ? 'add' : 'remove']('dark');
    }
  } catch (e) {
    /* ignore */
  }
})();

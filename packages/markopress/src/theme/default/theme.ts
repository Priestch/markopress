declare const document: any;
declare const localStorage: any;
declare const window: any;

/**
 * MarkoPress Default Theme - Client-side Scripts
 * Handles dark mode, sidebar, and other interactive features
 */

declare global {
  interface Window {
    MarkoPressTheme?: {
      toggleDarkMode: () => void;
      toggleSidebar: () => void;
    };
  }
}

(function() {
  'use strict';

  // Dark Mode Toggle
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const DARK_MODE_KEY = 'theme';

  function initDarkMode() {
    const currentTheme = localStorage.getItem(DARK_MODE_KEY) || 'light';
    if (currentTheme === 'dark') {
      document.body.classList.add('dark-mode');
      if (darkModeToggle) {
        darkModeToggle.textContent = '☀️';
      }
    }
  }

  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    if (darkModeToggle) {
      darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    }
    localStorage.setItem(DARK_MODE_KEY, isDarkMode ? 'dark' : 'light');
  }

  // Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');

  function toggleSidebar() {
    if (sidebar) {
      sidebar.classList.toggle('open');
    }
  }

  // Initialize
  function init() {
    // Dark mode
    if (darkModeToggle) {
      initDarkMode();
      darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    // Sidebar
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', toggleSidebar);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose utilities globally
  window.MarkoPressTheme = {
    toggleDarkMode,
    toggleSidebar,
  };

  console.log('[MarkoPress Theme] Initialized');
})();

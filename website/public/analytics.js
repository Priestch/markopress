/**
 * Analytics Integration for MarkoPress
 *
 * Configure your analytics provider by setting environment variables:
 * - GOOGLE_ANALYTICS_ID: Your Google Analytics 4 measurement ID (e.g., G-XXXXXXXXXX)
 * - PLAUSIBLE_DOMAIN: Your Plausible Analytics domain
 * - UMAMI_WEBSITE_ID: Your Umami website ID
 */

(function() {
  // Google Analytics 4
  const gaId = ''; // Set via environment or hardcode your ID

  if (gaId) {
    // Load Google Analytics
    (function() {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', gaId);
    })();

    console.log('[Analytics] Google Analytics initialized with ID:', gaId);
  }

  // Plausible Analytics
  const plausibleDomain = ''; // Set via environment

  if (plausibleDomain) {
    (function() {
      const script = document.createElement('script');
      script.defer = true;
      script.dataset.domain = plausibleDomain;
      script.src = 'https://plausible.io/js/script.js';
      document.head.appendChild(script);
    })();

    console.log('[Analytics] Plausible Analytics initialized for domain:', plausibleDomain);
  }

  // Umami Analytics
  const umamiId = ''; // Set via environment

  if (umamiId) {
    (function() {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.websiteId = umamiId;
      script.src = 'https://analytics.umami.is/script.js';
      document.head.appendChild(script);
    })();

    console.log('[Analytics] Umami Analytics initialized with ID:', umamiId);
  }

  // Custom event tracking helper
  window.trackEvent = function(category, action, label, value) {
    // Google Analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }

    // Plausible (uses native events)
    if (window.plausible) {
      window.plausible(action, {
        props: {
          category: category,
          label: label,
          value: value,
        },
      });
    }

    console.log('[Analytics] Event tracked:', { category, action, label, value });
  };

  // Page view tracking helper
  window.trackPageView = function(path) {
    // Google Analytics tracks page views automatically on SPA navigation
    if (typeof gtag !== 'undefined') {
      gtag('event', 'page_view', {
        page_path: path,
      });
    }

    // Plausible tracks page views automatically
    if (window.plausible) {
      window.plausible('pageview', {
        props: {
          path: path,
        },
      });
    }
  };

  console.log('[Analytics] Analytics integration loaded. Configure by editing public/analytics.js');
})();

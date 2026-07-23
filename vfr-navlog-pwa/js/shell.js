// Handles the shared shell behaviour for theming, view switching, and service worker registration.
// (BUG-04: the custom "Install app" button was removed — Safari/iOS and Firefox never fire
// beforeinstallprompt at all, so the button never appeared there


/* 3 small jobs which are unrelated but must be immediately ready and thus loads before anything else on that page
  These functions include:
  1. Theme toggle. This reads/writes the theme key and flips the data-theme attribute in html
  2. View switching/Lazy loading --> hides every view element except the requested one
  3. Service worker registration. This is what turns the service worker into an offlice cache without installation required
*/

(function () {
  "use strict";

  // The theme toggle updates the data-theme attribute and stores the preference.

  (function () {
    const STORAGE_KEY = "navlog-theme";
    const root = document.documentElement;
    const toggle = document.getElementById("theme-toggle");

    if (!toggle) {
      return;
    }

    function isLight() {
      return root.getAttribute("data-theme") === "light";
    }

    function syncSwitchState() {
      // aria-checked="true" means "Night panel" (dark) is active 
      // the thumb's default parked-right position in the switch styling.
      toggle.setAttribute("aria-checked", String(!isLight()));
    }

    function setTheme(theme) {
      if (theme === "light") {
        root.setAttribute("data-theme", "light");
      } else {
        root.removeAttribute("data-theme");
      }
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        /* localStorage unavailable so default theme applies */
      }
      syncSwitchState();
    }

    toggle.addEventListener("click", () => {
      setTheme(isLight() ? "dark" : "light");
    });

    syncSwitchState();
  })();

  // The shell lazy-loads feature modules when their view is shown.

  // Each view's own feature module(s), loaded via dynamic import() the
  // first time that view is shown rather than eagerly on every page load.
  // import() caches by URL, so a repeat call for an already-loading/loaded
  // module is a cheap no-op, not a second fetch/execution.
  const VIEW_MODULES = {
    "view-nav": ["./nav-page.js"],
    "view-route": ["./route-planner-bundle.js"],
    "view-navlog": ["./navlog-bundle.js"],
    "view-gonogo": ["./gonogo.js"],
    "view-checklists": ["./checklists.js"],
    "view-logbook": ["./logbook.js"]
  };
  const loadedModules = new Set();

  // This is what prevents the downloading of the Route-Planner bundle if the student solely opens the Checklists page 
  function loadViewModules(id) {
    const paths = VIEW_MODULES[id];
    if (!paths) {
      return;
    }
    paths.forEach((path) => {
      if (loadedModules.has(path)) {
        return;
      }
      loadedModules.add(path);
      import(path).catch((err) => {
        console.error("Failed to load module for " + id + ":", path, err);
      });
    });
  }

  // Shared toast helper is used here and by js/auth.js. Defined on window
  // because auth.js is loaded as an ES module (its own scope) and needs a
  // simple way to reach this without an import cycle.
  const toast = document.getElementById("toast");
  let toastTimer = null;

  window.showToast = function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3000);
  };

  // Generic full-screen "view" switcher. Every top-level screen in <main>
  // is a sibling .view element with a unique id; feature modules call
  // window.showView(id) rather than reimplementing show/hide themselves.
  window.showView = function showView(id) {
    const target = document.getElementById(id);
    if (!target) {
      console.warn('showView: no view found with id "' + id + '"');
      return;
    }
    loadViewModules(id);
    document.querySelectorAll(".view").forEach((el) => {
      el.hidden = el.id !== id;
    });
    // Move focus to the new view's heading for keyboard/screen-reader users,
    // so switching views reads like a real page navigation rather than a
    // silent DOM swap.
    const heading = target.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
    window.scrollTo(0, 0);
  };

  // Logo click to return home
  const logoBtn = document.getElementById("logo-home-btn");
  if (logoBtn) {
    logoBtn.addEventListener("click", (event) => {
      event.preventDefault();
      window.showView("view-home");
    });
  }

  // Feature card behaviour: cards for a built stage carry data-page="view-id"
  // and switch straight to that view; everything else still shows the
  // "coming in Stage N" placeholder toast until its stage builds it out.
  document.querySelectorAll(".feature-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      const pageId = card.dataset.page;
      if (pageId) {
        window.showView(pageId);
        return;
      }
      const feature = card.dataset.feature || "This feature";
      const stage = card.dataset.stage || "a later";
      window.showToast(feature + " is coming in Stage " + stage + ".");
    });
  });

  // Save & load's "Load" button writes this flag then reloads the page, so
  // route-planner-bundle.js's own draft-reading init runs fresh with the
  // newly loaded route. This is the one place that redirect can happen,
  // since js/route-planner-bundle.js itself is now lazy-loaded only once
  // view-route is open.
  try {
    const postReloadView = sessionStorage.getItem("navlog-post-reload-view");
    if (postReloadView) {
      sessionStorage.removeItem("navlog-post-reload-view");
      window.showView(postReloadView);
      window.showToast("Route loaded.");
    }
  } catch (err) {
    /* sessionStorage unavailable as there is nothing to recover, stay on the home screen */
  }

  // Register the service worker so the app shell is cached and works offline
  // on repeat visits. This is what provides offline support, independent of
  // whether the browser ever offers (or the user takes) an "install" option.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
})();

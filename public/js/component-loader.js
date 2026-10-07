/**
 * COMMIT PROTOCOL DYNAMIC COMPONENT LOADER
 * Automatically mounts modular HTML partials into index.html
 */
(function() {
  window.__componentsLoading = true;

  const mounts = [
    { id: 'header-mount', file: 'components/header.html' },
    { id: 'nav-mount', file: 'components/navbar.html' },
    { id: 'tab-dashboard-mount', file: 'components/tab-dashboard.html' },
    { id: 'tab-my-commitments-mount', file: 'components/tab-my-commitments.html' },
    { id: 'tab-wizard-mount', file: 'components/tab-wizard.html' },
    { id: 'tab-profile-mount', file: 'components/tab-profile.html' },
    { id: 'tab-study-mount', file: 'components/tab-study.html' },
    { id: 'tab-github-mount', file: 'components/tab-github.html' },
    { id: 'tab-peer-mount', file: 'components/tab-peer.html' },
    { id: 'tab-verifier-mount', file: 'components/tab-verifier.html' },
    { id: 'tab-blinks-mount', file: 'components/tab-blinks.html' },
    { id: 'tab-demos-mount', file: 'components/tab-demos.html' },
    { id: 'tab-admin-mount', file: 'components/tab-admin.html' },
    { id: 'modals-mount', file: 'components/modals.html' }
  ];

  async function loadComponent({ id, file }) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      el.outerHTML = html;
    } catch (err) {
      console.error(`[ComponentLoader] Failed to load ${file}:`, err);
    }
  }

  async function init() {
    await Promise.all(mounts.map(loadComponent));
    window.__componentsLoading = false;
    window.dispatchEvent(new CustomEvent('components:ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

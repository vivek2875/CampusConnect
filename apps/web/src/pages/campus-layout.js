import { apiClient } from '../lib/api-client.js';
import { campusBrandMarkup } from '../lib/brand.js';
import { createElement } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';

export function createCampusLayout({ active, navigate }) {
  const role = sessionStore.get()?.user?.role;
  const isAdmin = role === 'admin' || role === 'super_admin';
  const page = createElement('section', { className: 'dashboard-shell' });
  page.innerHTML = `
    <header class="topbar">${campusBrandMarkup({ dashboardHome: true, dark: true })}<button class="button button--quiet" data-logout>Sign out</button></header>
    <div class="dashboard-layout">
      <aside class="sidebar" aria-label="Primary navigation"><p class="eyebrow">Campus space</p><nav>
        <a class="nav-link ${active === 'overview' ? 'nav-link--active' : ''}" href="/dashboard" data-link>Overview</a>
        <a class="nav-link ${active === 'marketplace' ? 'nav-link--active' : ''}" href="/marketplace" data-link>Marketplace</a>
        <a class="nav-link ${active === 'my-listings' ? 'nav-link--active' : ''}" href="/marketplace/mine" data-link>My listings</a>
        <a class="nav-link ${active === 'offers' ? 'nav-link--active' : ''}" href="/offers" data-link>Offers</a>
        <a class="nav-link ${active === 'wishlist' ? 'nav-link--active' : ''}" href="/wishlist" data-link>Saved items</a>
        <a class="nav-link ${active === 'complaints' ? 'nav-link--active' : ''}" href="/complaints" data-link>Complaints</a>
        <a class="nav-link ${active === 'lost-found' ? 'nav-link--active' : ''}" href="/lost-found" data-link>Lost &amp; Found</a>
        <a class="nav-link ${active === 'events' ? 'nav-link--active' : ''}" href="/events" data-link>Events</a>
        <a class="nav-link ${active === 'notices' ? 'nav-link--active' : ''}" href="/notices" data-link>Notices</a>
        <a class="nav-link ${active === 'chat' ? 'nav-link--active' : ''}" href="/chat" data-link>Messages</a>
        <a class="nav-link ${active === 'notifications' ? 'nav-link--active' : ''}" href="/notifications" data-link>Notifications</a>
        <a class="nav-link ${active === 'assistant' ? 'nav-link--active' : ''}" href="/assistant" data-link>AI assistant</a>
        ${isAdmin ? `<a class="nav-link ${active === 'admin' ? 'nav-link--active' : ''}" href="/admin" data-link>Admin</a>` : ''}
      </nav></aside>
      <main class="dashboard-content" data-page-content></main>
    </div>`;

  page.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await apiClient.logout();
    } finally {
      sessionStore.clear();
      navigate('/login');
    }
  });
  return { page, content: page.querySelector('[data-page-content]') };
}

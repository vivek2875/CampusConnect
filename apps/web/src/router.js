import { setPage } from './lib/dom.js';
import { sessionStore } from './lib/session-store.js';
import { renderAuthPage } from './pages/auth-page.js';
import { renderAdminPage } from './pages/admin-page.js';
import { renderAssistantPage } from './pages/assistant-page.js';
import { renderChatPage } from './pages/chat-page.js';
import { renderDashboardPage } from './pages/dashboard-page.js';
import { renderComplaintEditorPage } from './pages/complaint-editor-page.js';
import { renderComplaintsPage } from './pages/complaints-page.js';
import { renderListingEditorPage } from './pages/listing-editor-page.js';
import { renderMarketplacePage } from './pages/marketplace-page.js';
import { renderOffersPage } from './pages/offers-page.js';
import { renderEventsPage } from './pages/events-page.js';
import { renderLostFoundPage } from './pages/lost-found-page.js';
import { renderNoticesPage } from './pages/notices-page.js';
import { renderNotificationsPage } from './pages/notifications-page.js';
import { renderResetPasswordPage, renderVerifyEmailPage } from './pages/recovery-pages.js';

export function startRouter() {
  window.addEventListener('popstate', renderRoute);
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[data-link]');
    if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(anchor.getAttribute('href'));
  });
  renderRoute();
}

export function navigate(path) {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  renderRoute();
}

function renderRoute() {
  const path = window.location.pathname;
  const session = sessionStore.get();
  if (path === '/' || path === '/login') return setPage(session ? renderDashboardPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/register') return setPage(session ? renderDashboardPage(navigate) : renderAuthPage('register', navigate));
  if (path === '/forgot-password') return setPage(renderAuthPage('forgot-password', navigate));
  if (path === '/reset-password') return setPage(renderResetPasswordPage(navigate));
  if (path === '/verify-email') return setPage(renderVerifyEmailPage(navigate));
  if (path === '/dashboard') return setPage(session ? renderDashboardPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/marketplace') return setPage(session ? renderMarketplacePage(navigate) : renderAuthPage('login', navigate));
  if (path === '/marketplace/mine')
    return setPage(session ? renderMarketplacePage(navigate, { mine: true }) : renderAuthPage('login', navigate));
  if (path === '/marketplace/new') return setPage(session ? renderListingEditorPage(navigate) : renderAuthPage('login', navigate));
  if (/^\/marketplace\/[a-f\d]{24}\/edit$/i.test(path)) {
    const listingId = path.split('/')[2];
    return setPage(session ? renderListingEditorPage(navigate, listingId) : renderAuthPage('login', navigate));
  }
  if (path === '/wishlist')
    return setPage(session ? renderMarketplacePage(navigate, { wishlist: true }) : renderAuthPage('login', navigate));
  if (path === '/offers') return setPage(session ? renderOffersPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/complaints') return setPage(session ? renderComplaintsPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/complaints/new') return setPage(session ? renderComplaintEditorPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/lost-found') return setPage(session ? renderLostFoundPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/events') return setPage(session ? renderEventsPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/notices') return setPage(session ? renderNoticesPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/notifications') return setPage(session ? renderNotificationsPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/chat') return setPage(session ? renderChatPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/assistant') return setPage(session ? renderAssistantPage(navigate) : renderAuthPage('login', navigate));
  if (path === '/admin')
    return setPage(
      session && ['admin', 'super_admin'].includes(session.user.role) ? renderAdminPage(navigate) : renderDashboardPage(navigate),
    );
  return navigate('/');
}

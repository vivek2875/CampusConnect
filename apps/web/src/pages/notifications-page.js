import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createPushSubscription } from '../lib/push-client.js';
import { createCampusLayout } from './campus-layout.js';

export function renderNotificationsPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'notifications', navigate });
  content.innerHTML =
    '<section class="marketplace-header"><div><p class="eyebrow">Stay informed</p><h1>Notifications</h1><p class="muted">Updates from the things that matter to you on campus.</p></div><button class="button button--secondary" data-enable-push hidden>Enable push</button></section><p class="form-message" data-message hidden></p><section class="notification-list" data-notifications aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>';
  const list = content.querySelector('[data-notifications]');
  const message = content.querySelector('[data-message]');
  const more = content.querySelector('[data-load-more]');
  const enablePush = content.querySelector('[data-enable-push]');
  const state = { notifications: [], nextCursor: null, loading: false };
  void configurePush(enablePush, message);
  more.addEventListener('click', () => void load(true));
  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    more.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading notifications…' }));
    try {
      const result = await apiClient.getNotifications({ limit: 30, ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}) });
      state.notifications = append ? [...state.notifications, ...result.notifications] : result.notifications;
      state.nextCursor = result.nextCursor;
      renderNotifications(list, state.notifications, navigate);
      more.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load notifications.');
    } finally {
      state.loading = false;
      more.disabled = false;
    }
  }
  void load();
  return page;
}

async function configurePush(button, message) {
  try {
    const configuration = await apiClient.getPushConfiguration();
    if (!configuration.enabled || !configuration.publicKey) return;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const subscription = await createPushSubscription(configuration.publicKey);
        await apiClient.subscribeToPush(subscription);
        button.textContent = 'Push enabled';
        setFormMessage(message, 'Push notifications are enabled for this browser.', 'success');
      } catch (error) {
        setFormMessage(message, error.message || 'Unable to enable push notifications.');
      } finally {
        button.disabled = false;
      }
    });
  } catch {
    // Notification history remains available when push has not been configured.
  }
}

function renderNotifications(container, notifications, navigate) {
  container.replaceChildren();
  if (!notifications.length) return container.append(createElement('p', { className: 'empty-state', text: 'You are all caught up.' }));
  notifications.forEach((notification) => {
    const item = createElement('article', { className: `notification-card ${notification.readAt ? '' : 'notification-card--unread'}` });
    item.append(
      createElement('h2', { text: notification.title }),
      createElement('p', { className: 'muted', text: notification.body }),
      createElement('p', {
        className: 'listing-card__meta',
        text: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt)),
      }),
    );
    const actions = createElement('div', { className: 'listing-card__actions' });
    if (!notification.readAt) {
      const read = createElement('button', { className: 'button button--quiet', text: 'Mark as read', attributes: { type: 'button' } });
      read.addEventListener('click', async () => {
        read.disabled = true;
        try {
          await apiClient.markNotificationRead(notification.id);
          item.classList.remove('notification-card--unread');
          read.remove();
        } catch {
          read.disabled = false;
        }
      });
      actions.append(read);
    }
    if (notification.link) {
      const open = createElement('a', {
        className: 'button button--secondary',
        text: 'Open',
        attributes: { href: notification.link, 'data-link': '' },
      });
      actions.append(open);
    }
    if (actions.childElementCount) item.append(actions);
    container.append(item);
  });
}

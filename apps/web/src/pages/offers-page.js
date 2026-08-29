import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

export function renderOffersPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'offers', navigate });
  content.innerHTML =
    '<section class="marketplace-header"><div><p class="eyebrow">Marketplace negotiation</p><h1>Offers</h1><p class="muted">Keep offer decisions, expiration, and listing reservations in one place.</p></div></section><form class="marketplace-filters offer-filters" data-filters><label>View<select name="direction"><option value="incoming">Received</option><option value="outgoing">Sent</option></select></label><label>Status<select name="status"><option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="withdrawn">Withdrawn</option><option value="expired">Expired</option></select></label><button class="button button--secondary" type="submit">Apply</button></form><p class="form-message" data-message hidden></p><section class="offer-list" data-offers aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>';
  const filters = content.querySelector('[data-filters]');
  const list = content.querySelector('[data-offers]');
  const message = content.querySelector('[data-message]');
  const loadMore = content.querySelector('[data-load-more]');
  const requestedDirection = new URLSearchParams(window.location.search).get('direction');
  if (requestedDirection === 'incoming' || requestedDirection === 'outgoing') filters.elements.direction.value = requestedDirection;
  const state = { offers: [], nextCursor: null, loading: false };

  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    void load();
  });
  loadMore.addEventListener('click', () => void load(true));
  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    loadMore.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading offers…' }));
    try {
      const data = new FormData(filters);
      const result = await apiClient.getMarketplaceOffers({
        direction: data.get('direction'),
        status: data.get('status'),
        limit: 20,
        ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}),
      });
      state.offers = append ? [...state.offers, ...result.offers] : result.offers;
      state.nextCursor = result.nextCursor;
      renderOffers(list, state.offers, () => load(), message);
      loadMore.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load offers.');
    } finally {
      state.loading = false;
      loadMore.disabled = false;
    }
  }
  void load();
  return page;
}

function renderOffers(container, offers, refresh, message) {
  container.replaceChildren();
  if (!offers.length) return container.append(createElement('p', { className: 'empty-state', text: 'No offers match this view.' }));
  offers.forEach((offer) => {
    const item = createElement('article', { className: 'offer-card' });
    const header = createElement('div', { className: 'complaint-card__header' });
    header.append(
      createElement('h2', { text: offer.listingTitle }),
      createElement('span', { className: `status offer-status offer-status--${offer.status}`, text: label(offer.status) }),
    );
    item.append(
      header,
      createElement('p', {
        className: 'listing-card__meta',
        text: `${offer.direction === 'incoming' ? 'From' : 'To'} ${offer.counterpart ? `${offer.counterpart.firstName} ${offer.counterpart.lastName}` : 'Campus member'} · Expires ${formatDate(offer.expiresAt)}`,
      }),
      createElement('p', { className: 'offer-card__amount', text: formatPrice(offer.amountMinor) }),
    );
    if (offer.message) item.append(createElement('p', { className: 'muted', text: offer.message }));
    if (offer.status === 'pending') item.append(createOfferActions(offer, refresh, message));
    container.append(item);
  });
}

function createOfferActions(offer, refresh, message) {
  const actions = createElement('div', { className: 'listing-card__actions' });
  const statuses =
    offer.direction === 'incoming'
      ? [
          ['accepted', 'Accept'],
          ['declined', 'Decline'],
        ]
      : [['withdrawn', 'Withdraw']];
  statuses.forEach(([status, text]) => {
    const button = createElement('button', {
      className: status === 'accepted' ? 'button button--primary' : 'button button--secondary',
      text,
      attributes: { type: 'button' },
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await apiClient.updateMarketplaceOffer(offer.id, status);
        await refresh();
      } catch (error) {
        setFormMessage(message, error.message || 'Unable to update this offer.');
      } finally {
        button.disabled = false;
      }
    });
    actions.append(button);
  });
  return actions;
}

function formatPrice(amountMinor) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amountMinor / 100);
}
function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
function label(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

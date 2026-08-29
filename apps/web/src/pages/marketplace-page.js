import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';
import { createCampusLayout } from './campus-layout.js';

const categories = [
  ['electronics', 'Electronics'],
  ['books', 'Books'],
  ['furniture', 'Furniture'],
  ['cycles', 'Cycles'],
  ['hostel_essentials', 'Hostel essentials'],
  ['sports', 'Sports'],
  ['fashion', 'Fashion'],
];

export function renderMarketplacePage(navigate, { mine = false, wishlist = false } = {}) {
  const active = wishlist ? 'wishlist' : 'marketplace';
  const { page, content } = createCampusLayout({ active, navigate });
  const title = wishlist ? 'Saved items' : mine ? 'My listings' : 'Campus Marketplace';
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Campus Marketplace</p><h1>${title}</h1><p class="muted">${wishlist ? 'Keep track of the things you may want to buy.' : mine ? 'Manage the items you have posted for your campus.' : 'Find useful things nearby, at a fair price.'}</p></div><a class="button button--primary" href="/marketplace/new" data-link>Sell an item</a></section>
    ${wishlist || mine ? '<p class="marketplace-switch"><a href="/marketplace" data-link>Browse all listings</a></p>' : '<form class="marketplace-filters" data-filters><label class="search-field">Search<input name="q" type="search" placeholder="Books, cycle, calculator…" /></label><label>Category<select name="category"><option value="">All categories</option></select></label><label>Min price (₹)<input name="minPrice" type="number" min="0" step="1" /></label><label>Max price (₹)<input name="maxPrice" type="number" min="0" step="1" /></label><button class="button button--secondary" type="submit">Apply</button></form>'}
    <p class="form-message" data-marketplace-message hidden></p>
    ${wishlist || mine ? '' : '<section class="marketplace-recommendations" data-recommendations hidden><div><p class="eyebrow">For you</p><h2>Recommended listings</h2></div><div class="listing-grid" data-recommended-listings></div></section>'}
    <section class="listing-grid" data-listings aria-live="polite"></section>
    <div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>`;

  const state = { listings: [], nextCursor: null, loading: false };
  const grid = content.querySelector('[data-listings]');
  const message = content.querySelector('[data-marketplace-message]');
  const loadMore = content.querySelector('[data-load-more]');
  const filterForm = content.querySelector('[data-filters]');
  const recommendationSection = content.querySelector('[data-recommendations]');
  const recommendationGrid = content.querySelector('[data-recommended-listings]');
  const categorySelect = filterForm?.querySelector('[name="category"]');
  categories.forEach(([value, label]) => {
    if (!categorySelect) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    categorySelect.append(option);
  });

  async function load({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    loadMore.disabled = true;
    if (!append) {
      state.listings = [];
      grid.replaceChildren(createLoadingState());
    }
    try {
      const filters = filterForm ? getFilters(filterForm) : {};
      const result = wishlist
        ? await apiClient.getWishlist({ limit: 20, ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}) })
        : mine
          ? await apiClient.getMyListings({ limit: 20, ...filters, ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}) })
          : await apiClient.getMarketplaceListings({
              limit: 20,
              ...filters,
              ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}),
            });
      state.listings = append ? [...state.listings, ...result.listings] : result.listings;
      state.nextCursor = result.nextCursor;
      renderListings(grid, state.listings, { mine, navigate, refresh: () => load() });
      loadMore.hidden = !state.nextCursor;
    } catch (error) {
      grid.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load listings. Please try again.');
    } finally {
      state.loading = false;
      loadMore.disabled = false;
    }
  }

  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    setFormMessage(message, '');
    void load();
  });
  loadMore.addEventListener('click', () => void load({ append: true }));
  if (recommendationSection && recommendationGrid) {
    void apiClient
      .getMarketplaceRecommendations()
      .then((listings) => {
        if (!listings.length) return;
        recommendationSection.hidden = false;
        renderListings(recommendationGrid, listings, { mine: false, navigate, refresh: () => {} });
      })
      .catch(() => {});
  }
  void load();
  return page;
}

function renderListings(grid, listings, context) {
  grid.replaceChildren();
  if (!listings.length) {
    const empty = createElement('p', { className: 'empty-state', text: 'No listings match your search yet.' });
    grid.append(empty);
    return;
  }
  listings.forEach((listing) => grid.append(createListingCard(listing, context)));
}

function createListingCard(listing, { mine, navigate, refresh }) {
  const card = createElement('article', { className: 'listing-card' });
  const visual = listing.images[0]
    ? createElement('img', {
        className: 'listing-card__image',
        attributes: { src: listing.images[0].url, alt: listing.title, loading: 'lazy' },
      })
    : createElement('div', { className: 'listing-card__image listing-card__image--empty', text: 'CampusConnect' });
  const body = createElement('div', { className: 'listing-card__body' });
  const meta = createElement('p', {
    className: 'listing-card__meta',
    text: `${labelFor(listing.category)} · ${labelFor(listing.condition)}`,
  });
  const title = createElement('h2', { text: listing.title });
  const price = createElement('p', { className: 'listing-card__price', text: formatPrice(listing.price.amountMinor) });
  const seller = createElement('p', {
    className: 'listing-card__seller',
    text: listing.seller ? `Posted by ${listing.seller.firstName} ${listing.seller.lastName}` : 'Campus member',
  });
  const actions = createElement('div', { className: 'listing-card__actions' });

  if (mine) {
    const edit = createElement('a', {
      className: 'button button--secondary',
      text: 'Edit',
      attributes: { href: `/marketplace/${listing.id}/edit`, 'data-link': '' },
    });
    const archive = createElement('button', { className: 'button button--quiet', text: 'Archive', attributes: { type: 'button' } });
    archive.addEventListener('click', async () => {
      archive.disabled = true;
      try {
        await apiClient.archiveMarketplaceListing(listing.id);
        await refresh();
      } finally {
        archive.disabled = false;
      }
    });
    actions.append(edit, archive);
  } else {
    actions.append(createEngagementButton(listing, 'like'), createEngagementButton(listing, 'wishlist'));
    if (listing.seller && listing.seller.id !== sessionStore.get().user.id) {
      actions.append(createOfferControl(listing));
      const messageSeller = createElement('button', {
        className: 'button button--quiet',
        text: 'Message seller',
        attributes: { type: 'button' },
      });
      messageSeller.addEventListener('click', () => navigate(`/chat?listing=${listing.id}`));
      actions.append(messageSeller);
    }
  }

  body.append(meta, title, price, seller, actions);
  card.append(visual, body);
  return card;
}

function createOfferControl(listing) {
  const wrapper = createElement('div', { className: 'listing-offer' });
  const toggle = createElement('button', { className: 'button button--quiet', text: 'Make offer', attributes: { type: 'button' } });
  const form = createElement('form', { attributes: { hidden: '' } });
  form.innerHTML =
    '<label>Offer (₹)<input name="amount" type="number" required min="1" max="1000000" step="1" /></label><label>Note (optional)<input name="message" maxlength="500" placeholder="Pickup timing, condition…" /></label><button class="button button--primary" type="submit">Send offer</button><p class="form-message" hidden></p>';
  const message = form.querySelector('.form-message');
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('[name="amount"]').focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button');
    const data = new FormData(form);
    submit.disabled = true;
    try {
      const note = data.get('message').trim();
      await apiClient.createMarketplaceOffer(listing.id, {
        amountMinor: Math.round(Number(data.get('amount')) * 100),
        ...(note ? { message: note } : {}),
      });
      setFormMessage(message, 'Offer sent. You can track it in Offers.', 'success');
      form.reset();
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to send your offer.');
    } finally {
      submit.disabled = false;
    }
  });
  wrapper.append(toggle, form);
  return wrapper;
}

function createEngagementButton(listing, kind) {
  let active = kind === 'like' ? listing.isLiked : listing.isWishlisted;
  let count = kind === 'like' ? listing.counts.likeCount : listing.counts.wishlistCount;
  const button = createElement('button', {
    className: `icon-button ${active ? 'icon-button--active' : ''}`,
    text: `${kind === 'like' ? '♡' : '⌑'} ${count}`,
    attributes: { type: 'button', 'aria-pressed': String(active), 'aria-label': `${active ? 'Remove' : 'Add'} ${kind}` },
  });
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await apiClient.setListingEngagement(listing.id, kind, !active);
      count = active ? Math.max(0, count - 1) : count + 1;
      active = !active;
      button.textContent = `${kind === 'like' ? '♡' : '⌑'} ${count}`;
      button.classList.toggle('icon-button--active', active);
      button.setAttribute('aria-pressed', String(active));
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function getFilters(form) {
  const data = new FormData(form);
  const minPrice = data.get('minPrice')?.toString();
  const maxPrice = data.get('maxPrice')?.toString();
  return {
    q: data.get('q')?.toString().trim(),
    category: data.get('category')?.toString(),
    ...(minPrice ? { minPrice: Math.round(Number(minPrice) * 100) } : {}),
    ...(maxPrice ? { maxPrice: Math.round(Number(maxPrice) * 100) } : {}),
  };
}

function createLoadingState() {
  return createElement('p', { className: 'empty-state', text: 'Loading marketplace…' });
}

function formatPrice(amountMinor) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amountMinor / 100);
}

function labelFor(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

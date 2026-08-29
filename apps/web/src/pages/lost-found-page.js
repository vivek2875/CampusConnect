import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

export function renderLostFoundPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'lost-found', navigate });
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Community care</p><h1>Lost & Found</h1><p class="muted">Help campus belongings get back to the right person.</p></div><button class="button button--primary" data-toggle-report>Report an item</button></section>
    <form class="listing-editor" data-report hidden><div class="field-row"><label>Report type<select name="type"><option value="lost">I lost something</option><option value="found">I found something</option></select></label><label>Location<input name="location" required maxlength="160" placeholder="Library, Block C…" /></label></div><label>Item title<input name="title" required minlength="3" maxlength="140" placeholder="Blue water bottle" /></label><label>Description<textarea name="description" required minlength="10" maxlength="2000" rows="4" placeholder="Include distinguishing details, but avoid sensitive information."></textarea></label><label>Photos (up to 6)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple /></label><p class="input-help">Images are uploaded directly to secure storage and associated with your account.</p><button class="button button--primary" type="submit">Publish report</button><p class="form-message" data-report-message hidden></p></form>
    <form class="marketplace-filters" data-filters><label>Show<select name="type"><option value="">All reports</option><option value="lost">Lost items</option><option value="found">Found items</option></select></label><button class="button button--secondary" type="submit">Apply</button></form>
    <p class="form-message" data-list-message hidden></p><section class="lost-found-grid" data-items aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>`;

  const report = content.querySelector('[data-report]');
  const reportMessage = content.querySelector('[data-report-message]');
  const filters = content.querySelector('[data-filters]');
  const list = content.querySelector('[data-items]');
  const listMessage = content.querySelector('[data-list-message]');
  const loadMore = content.querySelector('[data-load-more]');
  const state = { items: [], nextCursor: null, loading: false };

  content.querySelector('[data-toggle-report]').addEventListener('click', () => {
    report.hidden = !report.hidden;
    if (!report.hidden) report.querySelector('[name="type"]').focus();
  });
  report.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = report.querySelector('button[type="submit"]');
    submit.disabled = true;
    setFormMessage(reportMessage, '');
    try {
      const data = new FormData(report);
      const files = [...data.getAll('images')].filter((file) => file instanceof File && file.size > 0);
      if (files.length > 6) throw new Error('Upload a maximum of six images.');
      const images = await Promise.all(files.map((file) => apiClient.uploadLostFoundImage(file)));
      await apiClient.createLostFoundItem({
        type: data.get('type'),
        title: data.get('title').trim(),
        description: data.get('description').trim(),
        location: data.get('location').trim(),
        images: images.map((publicId) => ({ publicId })),
      });
      report.reset();
      report.hidden = true;
      setFormMessage(reportMessage, 'Report published.', 'success');
      await load();
    } catch (error) {
      setFormMessage(reportMessage, error.message || 'Unable to publish this report.');
    } finally {
      submit.disabled = false;
    }
  });
  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    void load();
  });
  loadMore.addEventListener('click', () => void load(true));

  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    loadMore.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading reports…' }));
    try {
      const type = new FormData(filters).get('type');
      const result = await apiClient.getLostFoundItems({
        limit: 20,
        type,
        ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}),
      });
      state.items = append ? [...state.items, ...result.items] : result.items;
      state.nextCursor = result.nextCursor;
      renderItems(list, state.items, () => load());
      loadMore.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(listMessage, error.message || 'Unable to load reports.');
    } finally {
      state.loading = false;
      loadMore.disabled = false;
    }
  }
  void load();
  return page;
}

function renderItems(container, items, refresh) {
  container.replaceChildren();
  if (!items.length)
    return container.append(createElement('p', { className: 'empty-state', text: 'No Lost & Found reports match this view.' }));
  items.forEach((item) => {
    const card = createElement('article', { className: 'lost-found-card' });
    if (item.images[0])
      card.append(
        createElement('img', {
          className: 'lost-found-card__image',
          attributes: { src: item.images[0].url, alt: item.title, loading: 'lazy' },
        }),
      );
    const body = createElement('div', { className: 'lost-found-card__body' });
    const type = createElement('span', {
      className: `status lost-found-card__type lost-found-card__type--${item.type}`,
      text: item.type === 'lost' ? 'Lost item' : 'Found item',
    });
    body.append(
      type,
      createElement('h2', { text: item.title }),
      createElement('p', { className: 'muted', text: item.description }),
      createElement('p', { className: 'listing-card__meta', text: `Last seen: ${item.location} · ${formatDate(item.createdAt)}` }),
    );
    if (item.relatedItemIds?.length)
      body.append(createElement('p', { className: 'ai-note', text: 'Possible related reports were found and will be reviewed securely.' }));
    if (item.status === 'open' && !item.canReviewClaims) body.append(createClaimForm(item, refresh));
    if (item.canReviewClaims) body.append(createClaimReview(item, refresh));
    card.append(body);
    container.append(card);
  });
}

function createClaimForm(item, refresh) {
  const wrapper = createElement('div', { className: 'claim-form' });
  const toggle = createElement('button', {
    className: 'button button--secondary',
    text: 'Claim this item',
    attributes: { type: 'button' },
  });
  const form = createElement('form', { attributes: { hidden: '' } });
  form.innerHTML =
    '<label>Ownership details<textarea required minlength="10" maxlength="1000" rows="3" placeholder="Describe a detail only the owner would know."></textarea></label><button class="button button--primary" type="submit">Submit verification</button><p class="form-message" hidden></p>';
  const message = form.querySelector('.form-message');
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector('textarea').focus();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    try {
      await apiClient.claimLostFoundItem(item.id, form.querySelector('textarea').value);
      setFormMessage(message, 'Claim submitted for review.', 'success');
      await refresh();
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to submit your claim.');
    } finally {
      submit.disabled = false;
    }
  });
  wrapper.append(toggle, form);
  return wrapper;
}

function createClaimReview(item, refresh) {
  const wrapper = createElement('section', { className: 'claim-review' });
  const toggle = createElement('button', { className: 'button button--secondary', text: 'Review claims', attributes: { type: 'button' } });
  const list = createElement('div', { attributes: { hidden: '' } });
  toggle.addEventListener('click', async () => {
    list.hidden = false;
    list.replaceChildren(createElement('p', { className: 'input-help', text: 'Loading ownership claims…' }));
    try {
      const claims = await apiClient.getLostFoundClaims(item.id);
      list.replaceChildren();
      if (!claims.length) list.append(createElement('p', { className: 'input-help', text: 'No claims have been submitted.' }));
      claims.forEach((claim) => list.append(createClaimReviewCard(claim, refresh)));
    } catch (error) {
      list.replaceChildren(createElement('p', { className: 'form-message', text: error.message || 'Unable to load claims.' }));
    }
  });
  wrapper.append(toggle, list);
  return wrapper;
}

function createClaimReviewCard(claim, refresh) {
  const card = createElement('article', { className: 'claim-review__card' });
  const result = createElement('p', { className: 'form-message', attributes: { hidden: '' } });
  card.append(
    createElement('p', { text: claim.verificationDetails }),
    createElement('p', { className: 'listing-card__meta', text: `${claim.status} · ${formatDate(claim.createdAt)}` }),
  );
  if (claim.status === 'pending') {
    const actions = createElement('div', { className: 'listing-card__actions' });
    ['approved', 'rejected'].forEach((status) => {
      const button = createElement('button', {
        className: status === 'approved' ? 'button button--primary' : 'button button--secondary',
        text: status === 'approved' ? 'Approve' : 'Reject',
        attributes: { type: 'button' },
      });
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await apiClient.reviewLostFoundClaim(claim.id, status);
          await refresh();
        } catch (error) {
          setFormMessage(result, error.message || 'Unable to review this claim.');
        } finally {
          button.disabled = false;
        }
      });
      actions.append(button);
    });
    card.append(actions);
  }
  card.append(result);
  return card;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

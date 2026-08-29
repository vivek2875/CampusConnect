import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';
import { createCampusLayout } from './campus-layout.js';

const categories = ['department', 'hostel', 'placements', 'academics', 'exams', 'general'];
const publishers = new Set(['faculty', 'admin', 'super_admin']);

export function renderNoticesPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'notices', navigate });
  const canPublish = publishers.has(sessionStore.get().user.role);
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Official updates</p><h1>Notice Board</h1><p class="muted">Academic, hostel, placement, and department updates in one place.</p></div>${canPublish ? '<button class="button button--primary" data-toggle-create>Publish notice</button>' : ''}</section>
    ${canPublish ? '<form class="listing-editor" data-create hidden><label>Title<input name="title" required minlength="3" maxlength="180" /></label><label>Content<textarea name="content" required minlength="10" maxlength="8000" rows="6"></textarea></label><div class="field-row"><label>Category<select name="category"></select></label><label>Audience<select name="audience"><option value="all">Everyone</option><option value="student">Students</option><option value="faculty">Faculty</option><option value="maintenance_staff">Maintenance staff</option></select></label></div><div class="field-row"><label>Priority<select name="priority"><option value="normal">Normal</option><option value="important">Important</option></select></label><label>Expiry (optional)<input name="expiresAt" type="datetime-local" /></label></div><button class="button button--primary" type="submit">Publish</button><p class="form-message" hidden></p></form>' : ''}
    <form class="marketplace-filters" data-filters><label>Category<select name="category"><option value="">All categories</option></select></label><button class="button button--secondary" type="submit">Apply</button></form>
    <p class="form-message" data-list-message hidden></p><section class="notice-list" data-notices aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>`;
  populateCategories(content.querySelector('[data-filters] [name="category"]'), true);
  populateCategories(content.querySelector('[data-create] [name="category"]'));
  const list = content.querySelector('[data-notices]');
  const message = content.querySelector('[data-list-message]');
  const filters = content.querySelector('[data-filters]');
  const more = content.querySelector('[data-load-more]');
  const state = { notices: [], nextCursor: null, loading: false };
  const create = content.querySelector('[data-create]');
  content.querySelector('[data-toggle-create]')?.addEventListener('click', () => {
    create.hidden = !create.hidden;
  });
  create?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = create.querySelector('button');
    const formMessage = create.querySelector('.form-message');
    submit.disabled = true;
    try {
      const data = new FormData(create);
      const expiresAt = data.get('expiresAt');
      await apiClient.createNotice({
        title: data.get('title').trim(),
        content: data.get('content').trim(),
        category: data.get('category'),
        audience: data.get('audience'),
        priority: data.get('priority'),
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      create.reset();
      create.hidden = true;
      await load();
    } catch (error) {
      setFormMessage(formMessage, error.message || 'Unable to publish this notice.');
    } finally {
      submit.disabled = false;
    }
  });
  filters.addEventListener('submit', (event) => {
    event.preventDefault();
    void load();
  });
  more.addEventListener('click', () => void load(true));
  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    more.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading notices…' }));
    try {
      const category = new FormData(filters).get('category');
      const result = await apiClient.getNotices({
        limit: 20,
        category,
        ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}),
      });
      state.notices = append ? [...state.notices, ...result.notices] : result.notices;
      state.nextCursor = result.nextCursor;
      renderNotices(list, state.notices);
      more.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load notices.');
    } finally {
      state.loading = false;
      more.disabled = false;
    }
  }
  void load();
  return page;
}

function populateCategories(select, includesAll = false) {
  if (!select) return;
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = label(category);
    select.append(option);
  });
  if (!includesAll) select.value = 'general';
}
function renderNotices(container, notices) {
  container.replaceChildren();
  if (!notices.length)
    return container.append(createElement('p', { className: 'empty-state', text: 'No current notices match this category.' }));
  notices.forEach((notice) => {
    const item = createElement('article', { className: `notice-card ${notice.priority === 'important' ? 'notice-card--important' : ''}` });
    const meta = createElement('p', {
      className: 'listing-card__meta',
      text: `${label(notice.category)} · ${formatDate(notice.publishedAt)}${notice.expiresAt ? ` · Expires ${formatDate(notice.expiresAt)}` : ''}`,
    });
    item.append(
      createElement('h2', { text: notice.title }),
      meta,
      createElement('p', { className: 'notice-card__content', text: notice.content }),
    );
    container.append(item);
  });
}
function label(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

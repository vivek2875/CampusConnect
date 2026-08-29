import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

const departments = [
  ['electrical', 'Electrical'],
  ['civil', 'Civil'],
  ['internet', 'Internet'],
  ['mess', 'Mess'],
  ['cleaning', 'Cleaning'],
  ['water', 'Water'],
];

export function renderComplaintsPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'complaints', navigate });
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Maintenance support</p><h1>My complaints</h1><p class="muted">Track every update from report to resolution.</p></div><a class="button button--primary" href="/complaints/new" data-link>Report an issue</a></section>
    <form class="marketplace-filters" data-filters><label>Department<select name="department"><option value="">All departments</option></select></label><label>Status<select name="status"><option value="">All statuses</option><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><button class="button button--secondary" type="submit">Apply</button></form>
    <p class="form-message" data-message hidden></p><section class="complaint-list" data-complaints aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>`;
  const state = { complaints: [], nextCursor: null, loading: false };
  const list = content.querySelector('[data-complaints]');
  const message = content.querySelector('[data-message]');
  const form = content.querySelector('[data-filters]');
  const loadMore = content.querySelector('[data-load-more]');
  const department = form.querySelector('[name="department"]');
  departments.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    department.append(option);
  });

  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    loadMore.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading complaints…' }));
    try {
      const data = new FormData(form);
      const result = await apiClient.getComplaints({
        limit: 20,
        department: data.get('department'),
        status: data.get('status'),
        ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}),
      });
      state.complaints = append ? [...state.complaints, ...result.complaints] : result.complaints;
      state.nextCursor = result.nextCursor;
      renderComplaints(list, state.complaints, () => load(), message);
      loadMore.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load complaints.');
    } finally {
      state.loading = false;
      loadMore.disabled = false;
    }
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setFormMessage(message, '');
    void load();
  });
  loadMore.addEventListener('click', () => void load(true));
  void load();
  return page;
}

function renderComplaints(container, complaints, refresh, message) {
  container.replaceChildren();
  if (!complaints.length) return container.append(createElement('p', { className: 'empty-state', text: 'No complaints found.' }));
  complaints.forEach((complaint) => {
    const item = createElement('article', { className: 'complaint-card' });
    const header = createElement('div', { className: 'complaint-card__header' });
    header.append(createElement('h2', { text: complaint.title }), badge(complaint.status));
    const description = createElement('p', { className: 'muted', text: complaint.description });
    const details = createElement('div', { className: 'complaint-card__details' });
    details.append(
      meta(`Department: ${label(complaint.department)}`),
      meta(`Priority: ${label(complaint.priority)}`),
      meta(`ETA: ${complaint.intelligence.estimatedResolutionHours}h`),
    );
    const summary = createElement('p', { className: 'ai-note', text: `AI assessment: ${complaint.intelligence.summary}` });
    item.append(header, description, details, summary);
    const nextStatus = nextStatusFor(complaint);
    if (nextStatus) {
      const action = createElement('button', {
        className: 'button button--secondary',
        text: `Mark ${label(nextStatus)}`,
        attributes: { type: 'button' },
      });
      action.addEventListener('click', async () => {
        action.disabled = true;
        try {
          await apiClient.updateComplaintStatus(complaint.id, nextStatus);
          await refresh();
        } catch (error) {
          setFormMessage(message, error.message || 'Unable to update the complaint status.');
        } finally {
          action.disabled = false;
        }
      });
      item.append(action);
    }
    container.append(item);
  });
}

function badge(status) {
  return createElement('span', { className: `status complaint-status complaint-status--${status}`, text: label(status) });
}
function meta(text) {
  return createElement('span', { text });
}
function label(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nextStatusFor(complaint) {
  if (complaint.canManage && complaint.status === 'assigned') return 'in_progress';
  if (complaint.canManage && complaint.status === 'in_progress') return 'resolved';
  if (!complaint.canManage && complaint.status === 'resolved') return 'closed';
  return null;
}

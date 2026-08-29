import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

export function renderAdminPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'admin', navigate });
  content.innerHTML =
    '<section class="marketplace-header"><div><p class="eyebrow">Campus operations</p><h1>Admin Dashboard</h1><p class="muted">A privacy-conscious operational view of current campus activity.</p></div></section><p class="form-message" data-message hidden></p><section class="metric-grid" data-metrics aria-live="polite"></section><section class="admin-breakdown" data-breakdown></section><section class="admin-users" data-users><div class="admin-users__heading"><div><p class="eyebrow">Directory</p><h2>Campus users</h2></div><form class="admin-users__filters" data-user-filters><label>Role<select name="role"><option value="">All roles</option><option value="student">Student</option><option value="faculty">Faculty</option><option value="maintenance_staff">Maintenance staff</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></label><label>Status<select name="status"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><button class="button button--secondary" type="submit">Apply</button></form></div><div class="admin-users__table-wrap"><table class="admin-users__table"><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Verified</th><th scope="col">Joined</th></tr></thead><tbody data-user-rows></tbody></table></div><div class="load-more"><button class="button button--secondary" data-load-users hidden>Load more</button></div></section>';
  const metrics = content.querySelector('[data-metrics]');
  const breakdown = content.querySelector('[data-breakdown]');
  const message = content.querySelector('[data-message]');
  const userFilters = content.querySelector('[data-user-filters]');
  const userRows = content.querySelector('[data-user-rows]');
  const loadUsers = content.querySelector('[data-load-users]');
  const userState = { users: [], nextCursor: null, loading: false };
  metrics.append(createElement('p', { className: 'empty-state', text: 'Loading operational metrics…' }));
  void apiClient
    .getAdminDashboard()
    .then((dashboard) => renderDashboard(metrics, breakdown, dashboard))
    .catch((error) => {
      metrics.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load the administrator dashboard.');
    });
  userFilters.addEventListener('submit', (event) => {
    event.preventDefault();
    void loadUserDirectory();
  });
  loadUsers.addEventListener('click', () => void loadUserDirectory(true));
  async function loadUserDirectory(append = false) {
    if (userState.loading) return;
    userState.loading = true;
    loadUsers.disabled = true;
    if (!append) userRows.replaceChildren(createEmptyUserRow('Loading campus users…'));
    try {
      const filters = new FormData(userFilters);
      const result = await apiClient.getAdminUsers({
        role: filters.get('role'),
        status: filters.get('status'),
        limit: 50,
        ...(append && userState.nextCursor ? { cursor: userState.nextCursor } : {}),
      });
      userState.users = append ? [...userState.users, ...result.users] : result.users;
      userState.nextCursor = result.nextCursor;
      renderUsers(userRows, userState.users);
      loadUsers.hidden = !userState.nextCursor;
    } catch (error) {
      userRows.replaceChildren(createEmptyUserRow(error.message || 'Unable to load campus users.'));
    } finally {
      userState.loading = false;
      loadUsers.disabled = false;
    }
  }
  void loadUserDirectory();
  return page;
}

function renderDashboard(metrics, breakdown, dashboard) {
  metrics.replaceChildren();
  const labels = [
    ['Active users', dashboard.totals.users],
    ['Active listings', dashboard.totals.activeListings],
    ['Open complaints', dashboard.totals.openComplaints],
    ['Upcoming events', dashboard.totals.activeEvents],
    ['Open Lost & Found reports', dashboard.totals.openLostFoundItems],
  ];
  labels.forEach(([label, value]) => {
    const card = createElement('article', { className: 'metric-card' });
    card.append(createElement('span', { text: label }), createElement('strong', { text: String(value) }));
    metrics.append(card);
  });
  breakdown.replaceChildren(createElement('h2', { text: 'Open complaints by department' }));
  if (!dashboard.complaintByDepartment.length)
    return breakdown.append(createElement('p', { className: 'empty-state', text: 'No open maintenance complaints.' }));
  const total = Math.max(...dashboard.complaintByDepartment.map((item) => item.count), 1);
  dashboard.complaintByDepartment.forEach((item) => {
    const row = createElement('div', { className: 'breakdown-row' });
    const label = createElement('span', { text: labelFor(item.department) });
    const bar = createElement('div', { className: 'breakdown-row__bar' });
    const fill = createElement('i', { attributes: { style: `width:${Math.max(8, Math.round((item.count / total) * 100))}%` } });
    bar.append(fill);
    row.append(label, bar, createElement('strong', { text: String(item.count) }));
    breakdown.append(row);
  });
}

function labelFor(value) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderUsers(container, users) {
  container.replaceChildren();
  if (!users.length) return container.append(createEmptyUserRow('No users match these filters.'));
  users.forEach((user) => {
    const row = createElement('tr');
    row.append(
      createElement('td', { text: `${user.firstName} ${user.lastName}` }),
      createElement('td', { text: labelFor(user.role) }),
      createElement('td', { text: labelFor(user.status) }),
      createElement('td', { text: user.emailVerified ? 'Verified' : 'Pending' }),
      createElement('td', { text: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(user.createdAt)) }),
    );
    container.append(row);
  });
}

function createEmptyUserRow(text) {
  const row = createElement('tr');
  row.append(createElement('td', { className: 'empty-state', text, attributes: { colspan: '5' } }));
  return row;
}

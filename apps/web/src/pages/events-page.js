import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { renderTicketQr } from '../lib/qr-code.js';
import { sessionStore } from '../lib/session-store.js';
import { createCampusLayout } from './campus-layout.js';

const organizers = new Set(['faculty', 'admin', 'super_admin']);

export function renderEventsPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'events', navigate });
  const canOrganize = organizers.has(sessionStore.get().user.role);
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Campus life</p><h1>Events</h1><p class="muted">Register for what is happening around campus.</p></div>${canOrganize ? '<button class="button button--primary" data-toggle-create>Create event</button>' : ''}</section>
    ${canOrganize ? '<form class="listing-editor" data-create hidden><div class="field-row"><label>Title<input name="title" required minlength="3" maxlength="160" /></label><label>Location<input name="location" required minlength="2" maxlength="180" /></label></div><label>Description<textarea name="description" required minlength="10" maxlength="4000" rows="4"></textarea></label><div class="field-row"><label>Starts at<input name="startsAt" type="datetime-local" required /></label><label>Ends at<input name="endsAt" type="datetime-local" required /></label></div><div class="field-row"><label>Registration closes<input name="registrationDeadline" type="datetime-local" required /></label><label>Capacity<input name="capacity" type="number" required min="1" max="100000" /></label></div><button class="button button--primary" type="submit">Publish event</button><p class="form-message" hidden></p></form>' : ''}
    <p class="form-message" data-list-message hidden></p><section class="event-list" data-events aria-live="polite"></section><div class="load-more"><button class="button button--secondary" data-load-more hidden>Load more</button></div>`;
  const list = content.querySelector('[data-events]');
  const message = content.querySelector('[data-list-message]');
  const more = content.querySelector('[data-load-more]');
  const state = { events: [], nextCursor: null, loading: false };
  const form = content.querySelector('[data-create]');
  content.querySelector('[data-toggle-create]')?.addEventListener('click', () => {
    form.hidden = !form.hidden;
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button');
    const formMessage = form.querySelector('.form-message');
    submit.disabled = true;
    try {
      const data = new FormData(form);
      await apiClient.createEvent({
        title: data.get('title').trim(),
        location: data.get('location').trim(),
        description: data.get('description').trim(),
        startsAt: new Date(data.get('startsAt')).toISOString(),
        endsAt: new Date(data.get('endsAt')).toISOString(),
        registrationDeadline: new Date(data.get('registrationDeadline')).toISOString(),
        capacity: Number(data.get('capacity')),
      });
      form.reset();
      form.hidden = true;
      await load();
    } catch (error) {
      setFormMessage(formMessage, error.message || 'Unable to create this event.');
    } finally {
      submit.disabled = false;
    }
  });
  more.addEventListener('click', () => void load(true));
  async function load(append = false) {
    if (state.loading) return;
    state.loading = true;
    more.disabled = true;
    if (!append) list.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading events…' }));
    try {
      const result = await apiClient.getEvents({ limit: 20, ...(append && state.nextCursor ? { cursor: state.nextCursor } : {}) });
      state.events = append ? [...state.events, ...result.events] : result.events;
      state.nextCursor = result.nextCursor;
      renderEvents(list, state.events);
      more.hidden = !state.nextCursor;
    } catch (error) {
      list.replaceChildren();
      setFormMessage(message, error.message || 'Unable to load events.');
    } finally {
      state.loading = false;
      more.disabled = false;
    }
  }
  void load();
  return page;
}

function renderEvents(container, events) {
  container.replaceChildren();
  if (!events.length)
    return container.append(createElement('p', { className: 'empty-state', text: 'There are no upcoming events right now.' }));
  events.forEach((event) => {
    const item = createElement('article', { className: 'event-card' });
    const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    item.innerHTML = `<p class="eyebrow">${escapeText(date.format(new Date(event.startsAt)))}</p><h2></h2><p class="muted"></p><p class="event-card__meta"></p>`;
    item.querySelector('h2').textContent = event.title;
    item.querySelector('.muted').textContent = event.description;
    item.querySelector('.event-card__meta').textContent =
      `${event.location} · ${event.remainingCapacity} of ${event.capacity} seats available`;
    const response = createElement('p', { className: 'form-message', attributes: { hidden: '' } });
    if (event.registration) {
      item.append(createTicket(event));
    } else {
      const action = createElement('button', {
        className: 'button button--primary',
        text: event.remainingCapacity > 0 ? 'Register' : 'Event full',
        attributes: { type: 'button' },
      });
      action.disabled = event.remainingCapacity <= 0;
      action.addEventListener('click', async () => {
        action.disabled = true;
        try {
          const registration = await apiClient.registerForEvent(event.id);
          event.registration = { id: registration.registrationId, ticket: registration.ticket, checkedInAt: null, certificateCode: null };
          event.remainingCapacity = Math.max(0, event.remainingCapacity - 1);
          renderEvents(container, events);
        } catch (error) {
          setFormMessage(response, error.message || 'Unable to register for this event.');
          action.disabled = false;
        }
      });
      item.append(action);
    }
    if (canCheckIn(event)) item.append(createCheckInForm(event));
    item.append(response);
    container.append(item);
  });
}

function createTicket(event) {
  const ticket = createElement('section', { className: 'event-ticket' });
  ticket.append(createElement('h3', { text: event.registration.checkedInAt ? 'Attendance recorded' : 'Your QR check-in ticket' }));
  if (!event.registration.checkedInAt) {
    const canvas = createElement('canvas', { attributes: { role: 'img', 'aria-label': `QR check-in ticket for ${event.title}` } });
    ticket.append(
      canvas,
      createElement('p', { className: 'input-help', text: 'Show this QR code to the event organizer. Do not share it publicly.' }),
    );
    void renderTicketQr(canvas, event.registration.ticket).catch(() =>
      ticket.append(createElement('p', { className: 'form-message', text: 'QR ticket could not be displayed. Refresh to try again.' })),
    );
  }
  if (event.registration.certificateCode) {
    const certificate = createElement('div', { className: 'certificate-card' });
    certificate.append(
      createElement('p', { className: 'eyebrow', text: 'Certificate of attendance' }),
      createElement('h4', { text: event.title }),
      createElement('p', { text: `Verified certificate: ${event.registration.certificateCode}` }),
    );
    const print = createElement('button', {
      className: 'button button--secondary',
      text: 'Print certificate',
      attributes: { type: 'button' },
    });
    print.addEventListener('click', () => window.print());
    certificate.append(print);
    ticket.append(certificate);
  }
  return ticket;
}

function canCheckIn(event) {
  const role = sessionStore.get().user.role;
  return event.organizerId === sessionStore.get().user.id || role === 'admin' || role === 'super_admin';
}

function createCheckInForm(event) {
  const form = createElement('form', { className: 'event-checkin' });
  form.innerHTML =
    '<label>Check in attendee<input name="ticket" required minlength="20" placeholder="Scan or paste QR ticket" /></label><button class="button button--secondary" type="submit">Check in</button><p class="form-message" hidden></p>';
  const message = form.querySelector('.form-message');
  form.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const result = await apiClient.checkInEvent(event.id, form.querySelector('[name="ticket"]').value.trim());
      form.reset();
      setFormMessage(message, `Attendance recorded. Certificate code: ${result.certificateCode}`, 'success');
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to check in this ticket.');
    } finally {
      button.disabled = false;
    }
  });
  return form;
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

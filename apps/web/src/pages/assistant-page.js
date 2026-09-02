import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

const initialMessage = {
  role: 'assistant',
  content: 'Hi! I can help you use CampusConnect and find the right campus service. What would you like to know?',
};

export function renderAssistantPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'assistant', navigate });
  content.innerHTML = `
    <section class="marketplace-header"><div><p class="eyebrow">Campus intelligence</p><h1>Campus Assistant</h1><p class="muted">Ask about CampusConnect or everyday campus services.</p></div></section>
    <section class="assistant-card">
      <div class="assistant-card__intro"><span class="icon-disc">✦</span><h2>Campus Assistant</h2><p class="muted">For urgent safety issues, contact campus security directly.</p></div>
      <section class="assistant-transcript" data-transcript aria-live="polite" aria-label="Campus assistant conversation"></section>
      <form class="assistant-composer" data-form>
        <label class="visually-hidden" for="assistant-question">Your message</label>
        <textarea id="assistant-question" name="question" required minlength="2" maxlength="2000" rows="3" placeholder="Ask a question about campus services…"></textarea>
        <button class="button button--primary" type="submit">Send</button>
        <p class="form-message" hidden></p>
      </form>
    </section>`;

  const form = content.querySelector('[data-form]');
  const transcript = content.querySelector('[data-transcript]');
  const message = form.querySelector('.form-message');
  const state = { messages: [initialMessage], pending: false };

  function renderConversation() {
    transcript.replaceChildren();
    state.messages.forEach((entry) => {
      const bubble = createElement('article', {
        className: `assistant-message assistant-message--${entry.role}`,
      });
      bubble.append(
        createElement('span', { className: 'assistant-message__label', text: entry.role === 'assistant' ? 'Campus Assistant' : 'You' }),
        createElement('p', { text: entry.content }),
      );
      transcript.append(bubble);
    });
    if (state.pending) {
      transcript.append(
        createElement('article', {
          className: 'assistant-message assistant-message--assistant assistant-message--pending',
          text: 'Campus Assistant is thinking…',
        }),
      );
    }
    transcript.scrollTop = transcript.scrollHeight;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.pending) return;
    const textArea = form.querySelector('textarea');
    const question = textArea.value.trim();
    if (!question) return;

    state.messages.push({ role: 'user', content: question });
    state.pending = true;
    textArea.value = '';
    form.querySelector('button').disabled = true;
    setFormMessage(message, '');
    renderConversation();

    try {
      const result = await apiClient.askCampusAssistant(state.messages.slice(-12));
      state.messages.push({ role: 'assistant', content: result.answer || 'I could not answer that right now.' });
    } catch (error) {
      setFormMessage(message, error.message || 'The assistant could not answer right now.');
    } finally {
      state.pending = false;
      form.querySelector('button').disabled = false;
      renderConversation();
      textArea.focus();
    }
  });

  renderConversation();
  return page;
}

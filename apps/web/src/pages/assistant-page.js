import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

export function renderAssistantPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'assistant', navigate });
  content.innerHTML =
    '<section class="marketplace-header"><div><p class="eyebrow">Campus intelligence</p><h1>Campus Assistant</h1><p class="muted">Ask about how to use CampusConnect or everyday campus services.</p></div></section><section class="assistant-card"><div class="assistant-card__intro"><span class="icon-disc">✦</span><h2>How can I help?</h2><p class="muted">I only use the context you provide. For urgent safety issues, contact campus security directly.</p></div><form class="stack" data-form><label>Your question<textarea name="question" required minlength="3" maxlength="2000" rows="5" placeholder="How do I track an internet complaint?"></textarea></label><button class="button button--primary" type="submit">Ask assistant</button><p class="form-message" hidden></p></form><section class="assistant-answer" data-answer hidden aria-live="polite"></section></section>';
  const form = content.querySelector('[data-form]');
  const message = form.querySelector('.form-message');
  const answer = content.querySelector('[data-answer]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button');
    submit.disabled = true;
    answer.hidden = true;
    setFormMessage(message, '');
    try {
      const result = await apiClient.askCampusAssistant(new FormData(form).get('question').trim());
      answer.replaceChildren(createElement('h2', { text: 'Answer' }), createElement('p', { text: result.answer || result }));
      answer.hidden = false;
    } catch (error) {
      setFormMessage(message, error.message || 'The assistant could not answer right now.');
    } finally {
      submit.disabled = false;
    }
  });
  return page;
}

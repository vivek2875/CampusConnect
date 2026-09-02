import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';
import { getChatSocket } from '../lib/socket-client.js';
import { createCampusLayout } from './campus-layout.js';

let clearChatListeners = () => {};

export function renderChatPage(navigate) {
  clearChatListeners();
  const { page, content } = createCampusLayout({ active: 'chat', navigate });
  content.innerHTML = `
    <section class="marketplace-header">
      <div><p class="eyebrow">Campus conversations</p><h1>Messages</h1><p class="muted">Private chats stay within your campus community.</p></div>
      <button class="button button--primary" type="button" data-new-conversation>New message</button>
    </section>
    <p class="form-message" data-message hidden></p>
    <section class="chat-recipient-picker" data-recipient-picker hidden>
      <form class="recipient-search" data-recipient-search>
        <label>Find a campus member<input name="query" type="search" minlength="2" maxlength="80" autocomplete="off" placeholder="Search by first or last name" required /></label>
        <button class="button button--secondary" type="submit">Search</button>
      </form>
      <div class="recipient-results" data-recipient-results aria-live="polite"></div>
    </section>
    <section class="chat-shell"><aside class="conversation-list" data-conversations aria-label="Conversations"></aside><section class="chat-panel" data-panel><p class="empty-state">Choose a conversation to begin.</p></section></section>`;

  const list = content.querySelector('[data-conversations]');
  const panel = content.querySelector('[data-panel]');
  const message = content.querySelector('[data-message]');
  const newConversationButton = content.querySelector('[data-new-conversation]');
  const recipientPicker = content.querySelector('[data-recipient-picker]');
  const recipientSearch = content.querySelector('[data-recipient-search]');
  const recipientResults = content.querySelector('[data-recipient-results]');
  const state = { conversations: [], selected: null, messages: [], socket: null, isOtherTyping: false };
  const requestedListingId = new URLSearchParams(window.location.search).get('listing');

  function setRecipientPickerVisible(visible) {
    recipientPicker.hidden = !visible;
    newConversationButton.setAttribute('aria-expanded', String(visible));
    if (visible) recipientSearch.elements.query.focus();
  }

  async function loadConversations({ selectId } = {}) {
    try {
      const result = await apiClient.getConversations({ limit: 50 });
      state.conversations = result.conversations;
      renderConversationList(list, state.conversations, state.selected?.id, (conversation) => void selectConversation(conversation));
      const next = state.conversations.find((conversation) => conversation.id === selectId) ?? state.selected;
      if (next) await selectConversation(next);
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to load conversations.');
    }
  }

  async function selectConversation(conversation) {
    state.selected = conversation;
    state.isOtherTyping = false;
    renderConversationList(list, state.conversations, conversation.id, (next) => void selectConversation(next));
    panel.replaceChildren(createElement('p', { className: 'empty-state', text: 'Loading messages…' }));
    try {
      const result = await apiClient.getMessages(conversation.id, { limit: 50 });
      state.messages = result.messages;
      renderChatPanel(panel, state, submitMessage);
      state.socket?.emit('conversation:join', { conversationId: conversation.id });
      void apiClient.markConversationRead(conversation.id);
      state.socket?.emit('messages:read', { conversationId: conversation.id });
    } catch (error) {
      panel.replaceChildren(createElement('p', { className: 'empty-state', text: error.message || 'Unable to load this conversation.' }));
    }
  }

  async function submitMessage({ text, imagePublicId }) {
    if (!state.selected) return;
    const currentConversationId = state.selected.id;
    if (state.socket?.connected) {
      const response = await new Promise((resolve) =>
        state.socket.emit('message:send', { conversationId: currentConversationId, text, imagePublicId }, resolve),
      );
      if (!response?.ok) throw new Error(response?.message || 'Unable to send the message.');
      if (!state.messages.some((messageItem) => messageItem.id === response.message.id)) {
        state.messages.push(response.message);
        renderChatPanel(panel, state, submitMessage);
      }
      return;
    }
    const sentMessage = await apiClient.sendMessage(currentConversationId, {
      ...(text ? { text } : {}),
      ...(imagePublicId ? { imagePublicId } : {}),
    });
    state.messages.push(sentMessage);
    renderChatPanel(panel, state, submitMessage);
  }

  async function searchRecipients(event) {
    event.preventDefault();
    const query = new FormData(recipientSearch).get('query').trim();
    if (query.length < 2) return;
    const submit = recipientSearch.querySelector('button');
    submit.disabled = true;
    recipientResults.replaceChildren(createElement('p', { className: 'empty-state', text: 'Searching campus members…' }));
    try {
      const recipients = await apiClient.searchChatRecipients(query);
      renderRecipientResults(recipientResults, recipients, startDirectConversation);
    } catch (error) {
      recipientResults.replaceChildren(
        createElement('p', { className: 'empty-state', text: error.message || 'Unable to search campus members.' }),
      );
    } finally {
      submit.disabled = false;
    }
  }

  async function startDirectConversation(recipientId) {
    try {
      const conversation = await apiClient.createConversation({ recipientId });
      recipientSearch.reset();
      recipientResults.replaceChildren();
      setRecipientPickerVisible(false);
      await loadConversations({ selectId: conversation.id });
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to start this conversation.');
    }
  }

  function connectSocket() {
    const accessToken = sessionStore.get().accessToken;
    const socket = getChatSocket(accessToken);
    state.socket = socket;
    const onMessage = (incoming) => {
      if (!document.contains(page) || !state.selected || incoming.conversationId !== state.selected.id) return;
      if (!state.messages.some((messageItem) => messageItem.id === incoming.id)) {
        state.messages.push(incoming);
        renderChatPanel(panel, state, submitMessage);
      }
    };
    const onConversationUpdated = ({ conversationId }) => {
      if (document.contains(page) && conversationId !== state.selected?.id) void loadConversations({ selectId: state.selected?.id });
    };
    const onTypingStart = ({ conversationId }) => {
      if (document.contains(page) && conversationId === state.selected?.id) {
        state.isOtherTyping = true;
        renderChatPanel(panel, state, submitMessage);
      }
    };
    const onTypingStop = ({ conversationId }) => {
      if (document.contains(page) && conversationId === state.selected?.id) {
        state.isOtherTyping = false;
        renderChatPanel(panel, state, submitMessage);
      }
    };
    const onMessagesRead = ({ conversationId }) => {
      if (document.contains(page) && conversationId === state.selected?.id) {
        const currentUserId = sessionStore.get().user.id;
        state.messages.forEach((messageItem) => {
          if (messageItem.senderId === currentUserId) messageItem.readAt ||= new Date().toISOString();
        });
        renderChatPanel(panel, state, submitMessage);
      }
    };
    socket.on('message:new', onMessage);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('messages:read', onMessagesRead);
    clearChatListeners = () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('messages:read', onMessagesRead);
    };
  }

  async function openRequestedListing() {
    if (!requestedListingId) return;
    try {
      const conversation = await apiClient.createConversation({ listingId: requestedListingId });
      window.history.replaceState({}, '', '/chat');
      await loadConversations({ selectId: conversation.id });
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to start this marketplace chat.');
    }
  }

  newConversationButton.addEventListener('click', () => setRecipientPickerVisible(recipientPicker.hidden));
  recipientSearch.addEventListener('submit', (event) => void searchRecipients(event));
  connectSocket();
  void loadConversations().then(openRequestedListing);
  return page;
}

function renderRecipientResults(container, recipients, onSelect) {
  container.replaceChildren();
  if (!recipients.length)
    return container.append(
      createElement('p', {
        className: 'empty-state',
        text: 'No active campus members match that name. They must have an account in this campus before you can message them.',
      }),
    );
  recipients.forEach((recipient) => {
    const button = createElement('button', { className: 'recipient-result', attributes: { type: 'button' } });
    const role = recipient.role.replace(/_/g, ' ');
    button.append(
      createElement('strong', { text: `${recipient.firstName} ${recipient.lastName}` }),
      createElement('span', { text: `${role.charAt(0).toUpperCase()}${role.slice(1)}${recipient.emailVerified ? ' · Verified' : ''}` }),
    );
    button.addEventListener('click', () => onSelect(recipient.id));
    container.append(button);
  });
}

function renderConversationList(container, conversations, selectedId, onSelect) {
  container.replaceChildren();
  if (!conversations.length)
    return container.append(
      createElement('p', { className: 'empty-state', text: 'No conversations yet. Choose New message to contact a campus member.' }),
    );
  conversations.forEach((conversation) => {
    const button = createElement('button', {
      className: `conversation-list__item ${conversation.id === selectedId ? 'conversation-list__item--active' : ''}`,
      attributes: { type: 'button' },
    });
    button.append(
      createElement('strong', {
        text: conversation.otherParticipant
          ? `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`
          : 'Campus member',
      }),
      createElement('span', { text: conversation.lastMessagePreview || 'No messages yet' }),
    );
    button.addEventListener('click', () => onSelect(conversation));
    container.append(button);
  });
}

function renderChatPanel(container, state, onSubmit) {
  container.replaceChildren();
  const title = createElement('header', { className: 'chat-panel__header' });
  title.append(
    createElement('h2', {
      text: state.selected.otherParticipant
        ? `${state.selected.otherParticipant.firstName} ${state.selected.otherParticipant.lastName}`
        : 'Campus member',
    }),
    createElement('span', {
      className: 'listing-card__meta',
      text: state.isOtherTyping ? 'Typing…' : state.socket?.connected ? 'Live' : 'Sending securely',
    }),
  );
  const messages = createElement('div', { className: 'message-list', attributes: { 'aria-live': 'polite' } });
  const currentUserId = sessionStore.get().user.id;
  state.messages.forEach((message) => {
    const bubble = createElement('article', {
      className: `message-bubble ${message.senderId === currentUserId ? 'message-bubble--mine' : ''}`,
    });
    if (message.text) bubble.append(createElement('p', { text: message.text }));
    if (message.image)
      bubble.append(createElement('img', { attributes: { src: message.image.url, alt: 'Shared in conversation', loading: 'lazy' } }));
    bubble.append(
      createElement('time', {
        text: new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt)),
        attributes: { datetime: message.createdAt },
      }),
    );
    if (message.senderId === currentUserId && message.readAt) {
      bubble.append(createElement('span', { className: 'message-bubble__read', text: 'Seen' }));
    }
    messages.append(bubble);
  });
  const form = createElement('form', { className: 'message-composer' });
  form.innerHTML =
    '<label class="visually-hidden" for="chat-message">Message</label><textarea id="chat-message" name="message" rows="2" maxlength="2000" placeholder="Write a message…"></textarea><label class="message-composer__upload" title="Attach image">Image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button class="button button--primary" type="submit">Send</button><p class="form-message" hidden></p>';
  const text = form.querySelector('textarea');
  const message = form.querySelector('.form-message');
  let typingTimer;
  text.addEventListener('input', () => {
    state.socket?.emit('typing:start', { conversationId: state.selected.id });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => state.socket?.emit('typing:stop', { conversationId: state.selected.id }), 700);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button');
    const file = form.querySelector('[name="image"]').files[0];
    const value = text.value.trim();
    if (!value && !file) return;
    submit.disabled = true;
    try {
      const imagePublicId = file ? await apiClient.uploadChatImage(file) : undefined;
      await onSubmit({ text: value, imagePublicId });
      form.reset();
      state.socket?.emit('typing:stop', { conversationId: state.selected.id });
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to send the message.');
    } finally {
      submit.disabled = false;
    }
  });
  container.append(title, messages, form);
  messages.scrollTop = messages.scrollHeight;
}

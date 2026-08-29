import { apiClient } from './api-client.js';

let session = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((subscriber) => subscriber(session));
}

export const sessionStore = {
  get() {
    return session;
  },

  set(nextSession) {
    session = nextSession;
    apiClient.setAccessToken(nextSession.accessToken);
    notify();
  },

  clear() {
    session = null;
    apiClient.clearAccessToken();
    notify();
  },

  async restore() {
    try {
      const restored = await apiClient.refresh();
      this.set(restored);
      return restored;
    } catch {
      this.clear();
      return null;
    }
  },

  subscribe(subscriber) {
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  },
};

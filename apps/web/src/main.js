import './styles.css';

import { apiClient } from './lib/api-client.js';
import { sessionStore } from './lib/session-store.js';
import { startRouter } from './router.js';

async function boot() {
  try {
    await apiClient.initializeCsrf();
    await sessionStore.restore();
  } catch (error) {
    console.error('CampusConnect could not initialize securely.', error);
  }
  startRouter();
}

void boot();

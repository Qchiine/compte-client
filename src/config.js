const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8082/api';

export const STORAGE_KEYS = {
  comptes: 'compte-client.comptes',
  outbox: 'compte-client.outbox',
  lastSync: 'compte-client.last-sync',
};

export const SYNC_INTERVAL_MS = 15000;
export const REQUEST_TIMEOUT_MS = 8000;

export default API_BASE_URL;

import { STORAGE_KEYS } from '../config';

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const localStore = {
  readComptes() {
    const value = readJson(STORAGE_KEYS.comptes, []);
    return Array.isArray(value) ? value : [];
  },

  saveComptes(comptes) {
    writeJson(STORAGE_KEYS.comptes, comptes);
  },

  readOutbox() {
    const value = readJson(STORAGE_KEYS.outbox, []);
    return Array.isArray(value) ? value : [];
  },

  saveOutbox(outbox) {
    writeJson(STORAGE_KEYS.outbox, outbox);
  },

  readLastSync() {
    const value = window.localStorage.getItem(STORAGE_KEYS.lastSync);
    return value ? Number(value) : null;
  },

  saveLastSync(timestamp) {
    window.localStorage.setItem(STORAGE_KEYS.lastSync, String(timestamp));
  },

  clear() {
    Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
  },
};

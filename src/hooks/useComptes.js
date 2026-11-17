import { useCallback, useEffect, useRef, useState } from 'react';

import { SYNC_INTERVAL_MS } from '../config';
import { mergeComptes, toComptePayload } from '../domain/comptes';
import { createCompte, fetchComptes, isNetworkError } from '../services/comptesApi';
import { localStore } from '../storage/localStore';

export const SYNC_STATE = {
  idle: 'idle',
  syncing: 'syncing',
  offline: 'offline',
  error: 'error',
};

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useComptes() {
  const [comptes, setComptes] = useState(() => mergeComptes(localStore.readComptes(), localStore.readOutbox()));
  const [outbox, setOutbox] = useState(() => localStore.readOutbox());
  const [syncState, setSyncState] = useState(SYNC_STATE.idle);
  const [lastSync, setLastSync] = useState(() => localStore.readLastSync());
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const outboxRef = useRef(outbox);
  const flushingRef = useRef(false);

  useEffect(() => {
    outboxRef.current = outbox;
    localStore.saveOutbox(outbox);
  }, [outbox]);

  const applyServerSnapshot = useCallback((serverComptes) => {
    localStore.saveComptes(serverComptes);
    setComptes(mergeComptes(serverComptes, outboxRef.current));
  }, []);

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return 0;
    const queue = outboxRef.current.filter((entry) => !entry.failed);
    if (queue.length === 0) return 0;

    flushingRef.current = true;
    const delivered = [];
    let rejected = 0;

    try {
      for (const entry of queue) {
        try {
          await createCompte(entry.payload, entry.localId);
          delivered.push(entry.localId);
        } catch (requestError) {
          if (isNetworkError(requestError)) break;
          rejected += 1;
          const message = requestError.response?.data?.message ?? requestError.message;
          const marked = outboxRef.current.map((item) =>
            item.localId === entry.localId ? { ...item, failed: true, failureReason: message } : item,
          );
          outboxRef.current = marked;
          setOutbox(marked);
          setNotice({ tone: 'danger', message: `Création rejetée par l'API : ${message}` });
        }
      }
    } finally {
      flushingRef.current = false;
    }

    if (delivered.length > 0) {
      const remaining = outboxRef.current.filter((entry) => !delivered.includes(entry.localId));
      outboxRef.current = remaining;
      setOutbox(remaining);
      if (rejected === 0) {
        setNotice({ tone: 'success', message: `${delivered.length} compte(s) synchronisé(s) avec l'API.` });
      }
    }

    return delivered.length;
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setSyncState(SYNC_STATE.syncing);

      try {
        await flushOutbox();
        setError(null);
        const serverComptes = await fetchComptes();
        applyServerSnapshot(serverComptes);
        const now = Date.now();
        localStore.saveLastSync(now);
        setLastSync(now);
        setSyncState(SYNC_STATE.idle);
      } catch (requestError) {
        if (isNetworkError(requestError)) {
          setSyncState(SYNC_STATE.offline);
          setError("API injoignable. Les comptes en attente restent dans la file locale.");
        } else {
          setSyncState(SYNC_STATE.error);
          setError(
            `Erreur API ${requestError.response?.status ?? ''} : ${requestError.response?.data?.message ?? requestError.message}`,
          );
        }
      }
    },
    [applyServerSnapshot, flushOutbox],
  );

  useEffect(() => {
    const initialId = window.setTimeout(() => refresh({ silent: true }), 0);
    const intervalId = window.setInterval(() => refresh({ silent: true }), SYNC_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const addCompte = useCallback(async (draft) => {
    const payload = toComptePayload(draft);
    const localId = createLocalId();
    const entry = { localId, payload, createdAt: new Date().toISOString() };

    const nextOutbox = [...outboxRef.current, entry];
    outboxRef.current = nextOutbox;
    setOutbox(nextOutbox);
    setComptes(mergeComptes(localStore.readComptes(), nextOutbox));
    setNotice({ tone: 'info', message: 'Compte enregistré localement, synchronisation en cours.' });

    try {
      const created = await createCompte(payload, localId);
      const remaining = outboxRef.current.filter((item) => item.localId !== localId);
      outboxRef.current = remaining;
      setOutbox(remaining);
      const serverComptes = [...localStore.readComptes(), created];
      localStore.saveComptes(serverComptes);
      setComptes(mergeComptes(serverComptes, remaining));
      setSyncState(SYNC_STATE.idle);
      setNotice({ tone: 'success', message: 'Compte créé et synchronisé.' });
      return { ok: true, pending: false };
    } catch (requestError) {
      if (isNetworkError(requestError)) {
        setSyncState(SYNC_STATE.offline);
        return { ok: true, pending: true };
      }
      const remaining = outboxRef.current.filter((item) => item.localId !== localId);
      outboxRef.current = remaining;
      setOutbox(remaining);
      setComptes(mergeComptes(localStore.readComptes(), remaining));
      setSyncState(SYNC_STATE.error);
      setNotice({
        tone: 'danger',
        message: `Création refusée par l'API : ${requestError.response?.data?.message ?? requestError.message}`,
      });
      return { ok: false, pending: false };
    }
  }, []);

  const discardPending = useCallback((localId) => {
    const remaining = outboxRef.current.filter((entry) => entry.localId !== localId);
    outboxRef.current = remaining;
    setOutbox(remaining);
    setComptes(mergeComptes(localStore.readComptes(), remaining));
    setNotice({ tone: 'info', message: 'Compte en attente supprimé de la file locale.' });
  }, []);

  return {
    comptes,
    pendingCount: outbox.length,
    failedCount: outbox.filter((entry) => entry.failed).length,
    syncState,
    lastSync,
    error,
    notice,
    dismissNotice: () => setNotice(null),
    refresh,
    addCompte,
    discardPending,
  };
}

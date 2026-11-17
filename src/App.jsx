import { useMemo } from 'react';

import CompteForm from './components/CompteForm';
import CompteList from './components/CompteList';
import { SYNC_STATE, useComptes } from './hooks/useComptes';
import { formatDateTime, formatSolde, summarize } from './domain/comptes';
import './App.css';

const SYNC_LABELS = {
  [SYNC_STATE.idle]: 'Synchronisé',
  [SYNC_STATE.syncing]: 'Synchronisation',
  [SYNC_STATE.offline]: 'Hors ligne',
  [SYNC_STATE.error]: 'Erreur API',
};

function App() {
  const {
    comptes,
    pendingCount,
    failedCount,
    syncState,
    lastSync,
    error,
    notice,
    dismissNotice,
    refresh,
    addCompte,
    discardPending,
  } = useComptes();

  const totals = useMemo(() => summarize(comptes), [comptes]);

  return (
    <div className="ledger-shell">
      <header className="ledger-masthead">
        <div className="ledger-masthead__brand">
          <span className="ledger-masthead__mark" aria-hidden="true">
            CC
          </span>
          <div>
            <p className="ledger-masthead__eyebrow">TP 9 · Client React pour API REST</p>
            <h1 className="ledger-masthead__title">Comptes clients</h1>
          </div>
        </div>

        <div className="ledger-masthead__status">
          <span className={`ledger-sync ledger-sync--${syncState}`}>
            <span className="ledger-sync__dot" aria-hidden="true" />
            {SYNC_LABELS[syncState]}
          </span>
          <p className="ledger-masthead__meta">
            Dernière synchro : {formatDateTime(lastSync)}
            {pendingCount > 0 ? ` · ${pendingCount} en attente` : ''}
          </p>
          <button type="button" className="ledger-ghost-button" onClick={() => refresh()}>
            Resynchroniser
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className="ledger-alerts">
          {error && (
            <p className="ledger-alert ledger-alert--danger" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className={`ledger-alert ledger-alert--${notice.tone}`} role="status">
              {notice.message}
              <button type="button" className="ledger-alert__close" onClick={dismissNotice} aria-label="Fermer">
                ×
              </button>
            </p>
          )}
        </div>
      )}

      <section className="ledger-metrics" aria-label="Synthèse du portefeuille">
        <article className="ledger-metric ledger-metric--primary">
          <p className="ledger-metric__label">Encours total</p>
          <p className="ledger-metric__value">{formatSolde(totals.total)}</p>
          <p className="ledger-metric__hint">{totals.count} compte(s) suivis</p>
        </article>
        <article className="ledger-metric">
          <p className="ledger-metric__label">Comptes courants</p>
          <p className="ledger-metric__value">{formatSolde(totals.courant)}</p>
          <p className="ledger-metric__hint">{totals.courantCount} compte(s)</p>
        </article>
        <article className="ledger-metric">
          <p className="ledger-metric__label">Épargne</p>
          <p className="ledger-metric__value">{formatSolde(totals.epargne)}</p>
          <p className="ledger-metric__hint">{totals.epargneCount} compte(s)</p>
        </article>
        <article className="ledger-metric">
          <p className="ledger-metric__label">File locale</p>
          <p className="ledger-metric__value">{pendingCount}</p>
          <p className={`ledger-metric__hint ${failedCount > 0 ? 'ledger-metric__hint--alert' : ''}`}>
            {failedCount > 0 ? `${failedCount} rejeté(s)` : 'création(s) à pousser'}
          </p>
        </article>
      </section>

      <div className="ledger-grid">
        <CompteForm onSubmit={addCompte} />
        <CompteList
          comptes={comptes}
          loading={syncState === SYNC_STATE.syncing}
          onDiscard={discardPending}
        />
      </div>

      <footer className="ledger-footer">
        <span>API : {import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8082/api'}</span>
        <span>Cache local restauré au démarrage · file d'attente rejouée automatiquement</span>
      </footer>
    </div>
  );
}

export default App;

import { useMemo, useState } from 'react';

import { COMPTE_TYPES, TYPE_LABELS, formatDate, formatSolde } from '../domain/comptes';

function shortId(id) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function CompteList({ comptes, loading, onDiscard }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return comptes.filter((compte) => {
      const matchesType = typeFilter === 'ALL' || compte.type === typeFilter;
      if (!matchesType) return false;
      if (!needle) return true;
      return (
        normalize(compte.id).includes(needle) ||
        normalize(TYPE_LABELS[compte.type]).includes(needle) ||
        String(compte.solde).includes(needle)
      );
    });
  }, [comptes, query, typeFilter]);

  return (
    <section className="ledger-table-block" aria-labelledby="comptes-title">
      <div className="ledger-table-head">
        <div>
          <h2 className="ledger-section-title" id="comptes-title">
            Portefeuille
          </h2>
          <p className="ledger-section-hint">
            {visible.length} / {comptes.length} compte(s) affiché(s)
          </p>
        </div>
        <div className="ledger-table-tools">
          <input
            type="search"
            className="form-control ledger-input ledger-input--compact"
            placeholder="Rechercher un identifiant ou un montant"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Rechercher un compte"
          />
          <select
            className="form-select ledger-input ledger-input--compact"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filtrer par type"
          >
            <option value="ALL">Tous les types</option>
            <option value={COMPTE_TYPES.COURANT}>Compte courant</option>
            <option value={COMPTE_TYPES.EPARGNE}>Épargne</option>
          </select>
        </div>
      </div>

      {loading && comptes.length === 0 ? (
        <div className="ledger-skeleton" aria-hidden="true">
          {[0, 1, 2, 3].map((row) => (
            <span key={row} className="ledger-skeleton__row" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="ledger-empty">
          <p className="ledger-empty__title">
            {comptes.length === 0 ? 'Aucun compte enregistré' : 'Aucun résultat'}
          </p>
          <p className="ledger-empty__hint">
            {comptes.length === 0
              ? "Créez un premier compte avec le formulaire. Il s'affichera ici même si l'API est hors ligne."
              : 'Ajustez la recherche ou le filtre de type.'}
          </p>
        </div>
      ) : (
        <div className="table-responsive ledger-table-responsive">
          <table className="table ledger-table align-middle">
            <thead>
              <tr>
                <th scope="col">Identifiant</th>
                <th scope="col" className="text-end">
                  Solde
                </th>
                <th scope="col">Date de création</th>
                <th scope="col">Type</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((compte) => (
                <tr key={compte.id} className={compte.pending ? 'ledger-row--pending' : undefined}>
                  <td className="ledger-mono" data-label="Identifiant" title={compte.id}>
                    {shortId(compte.id)}
                  </td>
                  <td
                    data-label="Solde"
                    className={`text-end ledger-amount ${
                      Number(compte.solde) < 0 ? 'ledger-amount--negative' : ''
                    }`}
                  >
                    {formatSolde(compte.solde)}
                  </td>
                  <td data-label="Date de création">{formatDate(compte.dateCreation)}</td>
                  <td data-label="Type">
                    <span className={`ledger-tag ledger-tag--${compte.type.toLowerCase()}`}>
                      {TYPE_LABELS[compte.type]}
                    </span>
                  </td>
                  <td data-label="Statut">
                    {compte.failed ? (
                      <span className="ledger-status ledger-status--failed" title={compte.failureReason ?? ''}>
                        Rejeté
                        <button
                          type="button"
                          className="ledger-status__action"
                          onClick={() => onDiscard(compte.id)}
                        >
                          Retirer
                        </button>
                      </span>
                    ) : compte.pending ? (
                      <span className="ledger-status ledger-status--pending">
                        En attente
                        <button
                          type="button"
                          className="ledger-status__action"
                          onClick={() => onDiscard(compte.id)}
                        >
                          Retirer
                        </button>
                      </span>
                    ) : (
                      <span className="ledger-status ledger-status--synced">Synchronisé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default CompteList;

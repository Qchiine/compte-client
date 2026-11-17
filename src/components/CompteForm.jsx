import { useState } from 'react';

import { COMPTE_TYPES, TYPE_LABELS, validateCompteDraft } from '../domain/comptes';

const EMPTY_DRAFT = { solde: '', dateCreation: '', type: COMPTE_TYPES.COURANT };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function CompteForm({ onSubmit }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setOutcome(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateCompteDraft(draft);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await onSubmit(draft);
      if (result.ok) {
        setDraft(EMPTY_DRAFT);
        setOutcome(
          result.pending
            ? { tone: 'warning', message: "API injoignable : le compte est conservé en file d'attente locale." }
            : { tone: 'success', message: 'Compte ajouté.' },
        );
      } else {
        setOutcome({ tone: 'danger', message: "L'API a refusé la création du compte." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="ledger-form" onSubmit={handleSubmit} noValidate>
      <div className="ledger-form__head">
        <h2 className="ledger-section-title">Nouveau compte</h2>
        <p className="ledger-section-hint">Saisie hors ligne autorisée, synchronisation automatique.</p>
      </div>

      <div className="ledger-field">
        <label className="ledger-label" htmlFor="solde">
          Solde initial
        </label>
        <div className="ledger-input-wrap">
          <input
            id="solde"
            name="solde"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={`form-control ledger-input ${errors.solde ? 'is-invalid' : ''}`}
            placeholder="0,00"
            value={draft.solde}
            onChange={handleChange}
            aria-invalid={Boolean(errors.solde)}
            aria-describedby={errors.solde ? 'solde-error' : undefined}
          />
          <span className="ledger-input-suffix">EUR</span>
        </div>
        {errors.solde && (
          <p className="ledger-error" id="solde-error">
            {errors.solde}
          </p>
        )}
      </div>

      <div className="ledger-field">
        <label className="ledger-label" htmlFor="dateCreation">
          Date d'ouverture
        </label>
        <input
          id="dateCreation"
          name="dateCreation"
          type="date"
          max={todayIso()}
          className={`form-control ledger-input ${errors.dateCreation ? 'is-invalid' : ''}`}
          value={draft.dateCreation}
          onChange={handleChange}
          aria-invalid={Boolean(errors.dateCreation)}
          aria-describedby={errors.dateCreation ? 'date-error' : undefined}
        />
        {errors.dateCreation && (
          <p className="ledger-error" id="date-error">
            {errors.dateCreation}
          </p>
        )}
      </div>

      <fieldset className="ledger-field">
        <legend className="ledger-label">Type de compte</legend>
        <div className="ledger-segmented" role="group" aria-label="Type de compte">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <label
              key={value}
              className={`ledger-segment ${draft.type === value ? 'is-active' : ''}`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={draft.type === value}
                onChange={handleChange}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.type && <p className="ledger-error">{errors.type}</p>}
      </fieldset>

      <button className="ledger-submit" type="submit" disabled={submitting}>
        {submitting ? 'Enregistrement…' : 'Ajouter le compte'}
      </button>

      {outcome && (
        <p className={`ledger-outcome ledger-outcome--${outcome.tone}`} role="status">
          {outcome.message}
        </p>
      )}
    </form>
  );
}

export default CompteForm;

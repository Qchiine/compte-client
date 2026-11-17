export const COMPTE_TYPES = {
  COURANT: 'COURANT',
  EPARGNE: 'EPARGNE',
};

export const TYPE_LABELS = {
  COURANT: 'Compte courant',
  EPARGNE: 'Épargne',
};

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatSolde(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : '—';
}

export function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
}

export function formatDateTime(value) {
  if (!value) return 'jamais';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'jamais';
  const time = parsed.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${dateFormatter.format(parsed)} à ${time}`;
}

export function normalizeCompte(raw) {
  return {
    id: String(raw.id),
    solde: Number(raw.solde),
    dateCreation: raw.dateCreation ?? null,
    type: COMPTE_TYPES[raw.type] ?? COMPTE_TYPES.COURANT,
  };
}

export function mergeComptes(serverComptes, outbox) {
  const fromServer = serverComptes.map((compte) => ({ ...compte, pending: false }));
  const pending = outbox.map((entry) => ({
    ...entry.payload,
    id: entry.localId,
    pending: true,
  }));

  return [...pending, ...fromServer].sort((left, right) => {
    const first = new Date(left.dateCreation ?? 0).getTime();
    const second = new Date(right.dateCreation ?? 0).getTime();
    return second - first;
  });
}

export function summarize(comptes) {
  const totals = comptes.reduce(
    (accumulator, compte) => {
      const solde = Number(compte.solde);
      if (!Number.isFinite(solde)) return accumulator;
      accumulator.total += solde;
      if (compte.type === COMPTE_TYPES.EPARGNE) {
        accumulator.epargne += solde;
        accumulator.epargneCount += 1;
      } else {
        accumulator.courant += solde;
        accumulator.courantCount += 1;
      }
      return accumulator;
    },
    { total: 0, courant: 0, epargne: 0, courantCount: 0, epargneCount: 0 },
  );

  return { ...totals, count: comptes.length };
}

export function validateCompteDraft(draft) {
  const errors = {};
  const rawSolde = String(draft.solde ?? '').trim().replace(',', '.');

  if (rawSolde === '') {
    errors.solde = 'Le solde est obligatoire.';
  } else if (!Number.isFinite(Number(rawSolde))) {
    errors.solde = 'Le solde doit être un montant numérique.';
  } else if (Number(rawSolde) < 0 && draft.type === COMPTE_TYPES.EPARGNE) {
    errors.solde = 'Un compte épargne ne peut pas être à découvert.';
  }

  if (!draft.dateCreation) {
    errors.dateCreation = 'La date de création est obligatoire.';
  } else {
    const selected = new Date(`${draft.dateCreation}T00:00:00`);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (Number.isNaN(selected.getTime())) {
      errors.dateCreation = 'La date de création est invalide.';
    } else if (selected > endOfToday) {
      errors.dateCreation = 'La date de création ne peut pas être dans le futur.';
    }
  }

  if (!COMPTE_TYPES[draft.type]) {
    errors.type = 'Sélectionnez un type de compte.';
  }

  return errors;
}

export function toComptePayload(draft) {
  return {
    solde: Number(String(draft.solde).replace(',', '.')),
    dateCreation: draft.dateCreation,
    type: draft.type,
  };
}

import { describe, expect, it } from 'vitest';

import {
  COMPTE_TYPES,
  mergeComptes,
  normalizeCompte,
  summarize,
  toComptePayload,
  validateCompteDraft,
} from '../src/domain/comptes';

describe('validateCompteDraft', () => {
  const valid = { solde: '1200,50', dateCreation: '2024-05-01', type: COMPTE_TYPES.COURANT };

  it('accepte un brouillon complet avec virgule décimale', () => {
    expect(validateCompteDraft(valid)).toEqual({});
  });

  it('exige un solde', () => {
    expect(validateCompteDraft({ ...valid, solde: '  ' }).solde).toBeDefined();
  });

  it('rejette un solde non numérique', () => {
    expect(validateCompteDraft({ ...valid, solde: 'douze' }).solde).toBeDefined();
  });

  it('refuse un découvert sur un compte épargne', () => {
    const errors = validateCompteDraft({ ...valid, solde: '-50', type: COMPTE_TYPES.EPARGNE });
    expect(errors.solde).toContain('découvert');
  });

  it('autorise un découvert sur un compte courant', () => {
    expect(validateCompteDraft({ ...valid, solde: '-50' })).toEqual({});
  });

  it('refuse une date future', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);
    expect(validateCompteDraft({ ...valid, dateCreation: iso }).dateCreation).toContain('futur');
  });

  it('refuse un type inconnu', () => {
    expect(validateCompteDraft({ ...valid, type: 'LIVRET' }).type).toBeDefined();
  });
});

describe('mergeComptes', () => {
  const server = [normalizeCompte({ id: 'srv-1', solde: 100, dateCreation: '2024-01-10', type: 'COURANT' })];

  it('place les créations locales en tête avec le drapeau pending', () => {
    const outbox = [
      {
        localId: 'local-1',
        payload: { solde: 500, dateCreation: '2025-01-01', type: 'EPARGNE' },
      },
    ];
    const merged = mergeComptes(server, outbox);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: 'local-1', pending: true, solde: 500 });
    expect(merged[1]).toMatchObject({ id: 'srv-1', pending: false });
  });

  it('trie par date de création décroissante', () => {
    const merged = mergeComptes(
      [
        normalizeCompte({ id: 'old', solde: 1, dateCreation: '2020-01-01', type: 'COURANT' }),
        normalizeCompte({ id: 'recent', solde: 2, dateCreation: '2025-01-01', type: 'COURANT' }),
      ],
      [],
    );
    expect(merged.map((compte) => compte.id)).toEqual(['recent', 'old']);
  });

  it('expose le motif de rejet des entrees refusees par l API', () => {
    const outbox = [
      {
        localId: 'local-ko',
        payload: { solde: 100, dateCreation: '2025-01-01', type: 'LIVRET' },
        failed: true,
        failureReason: 'Type de compte inconnu.',
      },
    ];

    const [entry] = mergeComptes([], outbox);
    expect(entry).toMatchObject({
      id: 'local-ko',
      pending: true,
      failed: true,
      failureReason: 'Type de compte inconnu.',
    });
  });

  it('marque les comptes serveur comme ni en attente ni rejetes', () => {
    const [compte] = mergeComptes(
      [normalizeCompte({ id: 'srv-9', solde: 5, dateCreation: '2024-01-01', type: 'COURANT' })],
      [],
    );
    expect(compte).toMatchObject({ pending: false, failed: false });
  });
});

describe('summarize', () => {
  it('agrège les soldes par type', () => {
    const totals = summarize([
      { solde: 100, type: 'COURANT' },
      { solde: 250.5, type: 'EPARGNE' },
      { solde: -50, type: 'COURANT' },
    ]);
    expect(totals).toMatchObject({
      total: 300.5,
      courant: 50,
      epargne: 250.5,
      courantCount: 2,
      epargneCount: 1,
      count: 3,
    });
  });

  it('ignore les soldes non numériques', () => {
    expect(summarize([{ solde: 'NaN', type: 'COURANT' }]).total).toBe(0);
  });
});

describe('toComptePayload', () => {
  it('convertit la virgule décimale en nombre', () => {
    expect(toComptePayload({ solde: '19,99', dateCreation: '2024-03-03', type: 'COURANT' })).toEqual({
      solde: 19.99,
      dateCreation: '2024-03-03',
      type: 'COURANT',
    });
  });
});

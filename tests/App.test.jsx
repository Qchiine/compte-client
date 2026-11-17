import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import { STORAGE_KEYS } from '../src/config';

const initialComptes = [
  { id: 'srv-1', solde: 1200.5, dateCreation: '2024-02-14', type: 'COURANT' },
  { id: 'srv-2', solde: 8000, dateCreation: '2023-11-03', type: 'EPARGNE' },
];

vi.mock('../src/services/comptesApi', () => ({
  isNetworkError: (error) => !error.response,
  fetchComptes: vi.fn(async () => initialComptes),
  createCompte: vi.fn(),
}));

const api = await import('../src/services/comptesApi');

beforeEach(() => {
  window.localStorage.clear();
  api.createCompte.mockReset();
});

describe('App', () => {
  it('affiche les comptes renvoyés par l API et la synthèse', async () => {
    api.createCompte.mockResolvedValue({
      id: 'srv-generated',
      solde: 42,
      dateCreation: '2024-01-01',
      type: 'COURANT',
    });

    render(<App />);

    expect(await screen.findByText('srv-1')).toBeInTheDocument();
    expect(screen.getByText('9 200,50 €')).toBeInTheDocument();
  });

  it('valide le formulaire avant tout appel réseau', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('srv-1');

    await user.click(screen.getByRole('button', { name: /ajouter le compte/i }));

    expect(await screen.findByText('Le solde est obligatoire.')).toBeInTheDocument();
    expect(api.createCompte).not.toHaveBeenCalled();
  });

  it('conserve une création en file locale quand l API est injoignable', async () => {
    api.createCompte.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('srv-1');

    await user.type(screen.getByLabelText(/solde initial/i), '500');
    await user.type(screen.getByLabelText(/date d'ouverture/i), '2024-06-01');
    await user.click(screen.getByRole('button', { name: /ajouter le compte/i }));

    expect(await screen.findByText(/file d'attente locale/i)).toBeInTheDocument();
    expect(await screen.findByText('En attente')).toBeInTheDocument();

    const storedOutbox = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.outbox));
    expect(storedOutbox).toHaveLength(1);
    expect(storedOutbox[0].payload.solde).toBe(500);
  });

  it('envoie une clé idempotente stable avec la création', async () => {
    api.createCompte.mockResolvedValue({
      id: 'srv-generated',
      solde: 12,
      dateCreation: '2024-06-01',
      type: 'COURANT',
    });
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('srv-1');

    await user.type(screen.getByLabelText(/solde initial/i), '12');
    await user.type(screen.getByLabelText(/date d'ouverture/i), '2024-06-01');
    await user.click(screen.getByRole('button', { name: /ajouter le compte/i }));

    await waitFor(() => expect(api.createCompte).toHaveBeenCalledTimes(1));
    const [, idempotencyKey] = api.createCompte.mock.calls[0];
    expect(typeof idempotencyKey).toBe('string');
    expect(idempotencyKey.length).toBeGreaterThan(8);
  });
});

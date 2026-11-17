import axios from 'axios';

import API_BASE_URL, { REQUEST_TIMEOUT_MS } from '../config';
import { normalizeCompte } from '../domain/comptes';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

export function isNetworkError(error) {
  return !error.response;
}

export async function fetchComptes(signal) {
  const response = await client.get('/comptes', { signal });
  const payload = Array.isArray(response.data) ? response.data : [];
  return payload.map(normalizeCompte);
}

export async function createCompte(payload, idempotencyKey) {
  const response = await client.post('/comptes', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return normalizeCompte(response.data);
}

export default client;

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8082);
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 120);

const seed = [
  { id: 'a1f0c3e2-5d4b-4f1a-9b8c-0d7e6f5a4b31', solde: 2450.75, dateCreation: '2024-02-14', type: 'COURANT' },
  { id: 'b7d2e9a4-1c63-4a87-8f2d-3e5c9b1a7d08', solde: 18900.0, dateCreation: '2023-11-03', type: 'EPARGNE' },
  { id: 'c4a8f1b6-9e27-4d5c-b3a0-6f1d8e2c4a59', solde: 312.4, dateCreation: '2025-06-21', type: 'COURANT' },
];

let comptes = [...seed];
const idempotencyKeys = new Map();

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  });
  res.end(payload);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') return send(res, 204, {});

  if (pathname === '/api/health') {
    return send(res, 200, { status: 'ok', comptes: comptes.length });
  }

  if (pathname === '/api/comptes' && req.method === 'GET') {
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    return send(res, 200, comptes);
  }

  if (pathname === '/api/comptes' && req.method === 'POST') {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey) {
      return send(res, 400, { message: "L'en-tête Idempotency-Key est obligatoire." });
    }

    if (idempotencyKeys.has(idempotencyKey)) {
      return send(res, 200, idempotencyKeys.get(idempotencyKey));
    }

    let body;
    try {
      body = await parseBody(req);
    } catch {
      return send(res, 400, { message: 'Corps de requête JSON invalide.' });
    }

    const solde = Number(body.solde);
    if (!Number.isFinite(solde)) {
      return send(res, 422, { message: 'Le solde doit être un montant numérique.' });
    }
    if (!['COURANT', 'EPARGNE'].includes(body.type)) {
      return send(res, 422, { message: 'Type de compte inconnu.' });
    }

    const created = {
      id: randomUUID(),
      solde,
      dateCreation: body.dateCreation ?? new Date().toISOString().slice(0, 10),
      type: body.type,
    };

    await new Promise((r) => setTimeout(r, LATENCY_MS));
    comptes = [...comptes, created];
    idempotencyKeys.set(idempotencyKey, created);
    return send(res, 201, created);
  }

  const deleteMatch = pathname.match(/^\/api\/comptes\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const target = decodeURIComponent(deleteMatch[1]);
    const before = comptes.length;
    comptes = comptes.filter((compte) => compte.id !== target);
    if (comptes.length === before) return send(res, 404, { message: 'Compte introuvable.' });
    return send(res, 204, {});
  }

  return send(res, 404, { message: 'Ressource introuvable.' });
});

server.listen(PORT, () => {
  console.log(`Mock API comptes sur http://localhost:${PORT}/api`);
});

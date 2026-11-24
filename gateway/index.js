const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('JWT_SECRET wajib diisi di file .env');
  process.exit(1);
}

const targets = {
  auth: `http://localhost:${process.env.AUTH_PORT || 3001}`,
  documents: `http://localhost:${process.env.DOCUMENT_PORT || 3002}`,
  signatures: `http://localhost:${process.env.SIGNING_PORT || 3003}`,
  verify: `http://localhost:${process.env.VERIFICATION_PORT || 3005}`,
};

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));

app.get('/health', (req, res) => res.json({ service: 'gateway', status: 'ok' }));

// Rute yang boleh diakses tanpa login
const PUBLIC = [
  { method: 'POST', test: (p) => p === '/api/auth/register' },
  { method: 'POST', test: (p) => p === '/api/auth/login' },
  { method: 'GET', test: (p) => /^\/api\/verify\/[^/]+$/.test(p) },
  { method: 'POST', test: (p) => /^\/api\/verify\/[^/]+\/check-file$/.test(p) },
];

app.use((req, res, next) => {
  // Jangan percaya header identitas dari luar
  delete req.headers['x-user-id'];
  delete req.headers['x-internal-key'];

  // Rute internal antar service tidak boleh lewat gateway
  if (/^\/api\/[^/]+\/internal(\/|$)/.test(req.path))
    return res.status(404).json({ message: 'Not found' });

  if (PUBLIC.some((r) => r.method === req.method && r.test(req.path))) return next();

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token login diperlukan' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.headers['x-user-id'] = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa' });
  }
});

const proxy = (prefix, target, rewrite) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: prefix,
    pathRewrite: rewrite,
    on: {
      error: (err, req, res) =>
        res.status(503).json({ message: `Service tujuan belum jalan (${prefix})` }),
    },
  });

app.use(proxy('/api/auth', targets.auth, { '^/api/auth': '' }));
app.use(proxy('/api/documents', targets.documents, { '^/api/documents': '' }));
app.use(proxy('/api/signatures', targets.signatures, { '^/api/signatures': '' }));
app.use(proxy('/api/verify', targets.verify, { '^/api/verify': '' }));

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

app.listen(PORT, () => console.log(`[gateway] jalan di http://localhost:${PORT}`));

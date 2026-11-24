const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');

const PORT = process.env.VERIFICATION_PORT || 3005;
const INTERNAL_KEY = process.env.INTERNAL_KEY;
const SIGNING_URL = `http://localhost:${process.env.SIGNING_PORT || 3003}`;
if (!INTERNAL_KEY) {
  console.error('INTERNAL_KEY wajib diisi di file .env');
  process.exit(1);
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const app = express();

const TOKEN = /^[A-Za-z0-9_-]{6,64}$/;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpErr = (status, message) => Object.assign(new Error(message), { status });

async function signing(pathname, options = {}) {
  let res;
  try {
    res = await fetch(`${SIGNING_URL}${pathname}`, {
      ...options,
      headers: { 'x-internal-key': INTERNAL_KEY, ...(options.headers || {}) },
    });
  } catch {
    throw httpErr(503, 'Layanan verifikasi belum siap. Coba lagi sebentar lagi.');
  }
  if (res.status === 404) throw httpErr(404, 'Token tidak ditemukan');
  if (!res.ok) throw httpErr(502, 'Gagal memeriksa dokumen.');
  return res.json();
}

app.get('/health', (req, res) => res.json({ service: 'verification-service', status: 'ok' }));

// GET /:token  (publik, lewat Gateway: GET /api/verify/:token)
app.get('/:token', wrap(async (req, res) => {
  if (!TOKEN.test(req.params.token)) throw httpErr(404, 'Token tidak ditemukan');
  res.json(await signing(`/internal/verify/${req.params.token}`));
}));

// POST /:token/check-file  (publik): unggah file, cocokkan hash SHA-256
app.post('/:token/check-file', upload.single('file'), wrap(async (req, res) => {
  if (!TOKEN.test(req.params.token)) throw httpErr(404, 'Token tidak ditemukan');
  if (!req.file) throw httpErr(400, 'File wajib diunggah');
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  res.json(await signing(`/internal/verify/${req.params.token}/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash }),
  }));
}));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Terjadi kesalahan pada server' });
});

app.listen(PORT, () => console.log(`[verification-service] jalan di http://localhost:${PORT}`));

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const pool = require('./db');

const PORT = process.env.SIGNING_PORT || 3003;
const INTERNAL_KEY = process.env.INTERNAL_KEY;
const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
const AUTH_URL = `http://localhost:${process.env.AUTH_PORT || 3001}`;
const DOCUMENT_URL = `http://localhost:${process.env.DOCUMENT_PORT || 3002}`;
const QRPDF_URL = `http://localhost:${process.env.QRPDF_PORT || 3004}`;
if (!INTERNAL_KEY) {
  console.error('INTERNAL_KEY wajib diisi di file .env');
  process.exit(1);
}

const STORAGE = path.join(__dirname, 'storage');
fs.mkdirSync(STORAGE, { recursive: true });

const app = express();
app.use(express.json());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const H = { 'x-internal-key': INTERNAL_KEY };

function requireUser(req, res, next) {
  const id = req.headers['x-user-id'];
  if (!id) return res.status(401).json({ message: 'Tidak terautentikasi' });
  req.userId = id;
  next();
}
function requireInternal(req, res, next) {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY) return res.status(403).json({ message: 'Akses ditolak' });
  next();
}

/* ------------------------------------------------ panggilan ke service lain */
async function call(url, options = {}, what = 'service') {
  let res;
  try {
    res = await fetch(url, { ...options, headers: { ...H, ...(options.headers || {}) } });
  } catch {
    throw httpErr(503, `${what} belum jalan. Pastikan semua service aktif (npm run dev).`);
  }
  return res;
}
async function getJson(url, what, notFound) {
  const res = await call(url, {}, what);
  if (res.status === 404) throw httpErr(404, notFound);
  if (!res.ok) throw httpErr(502, `Gagal menghubungi ${what}.`);
  return res.json();
}
async function getBuffer(url, what, notFound) {
  const res = await call(url, {}, what);
  if (res.status === 404) throw httpErr(404, notFound);
  if (!res.ok) throw httpErr(502, `Gagal menghubungi ${what}.`);
  return Buffer.from(await res.arrayBuffer());
}
async function postQr(endpoint, fd) {
  const res = await call(`${QRPDF_URL}${endpoint}`, { method: 'POST', body: fd }, 'QR & PDF Service');
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw httpErr(res.status === 422 ? 422 : 502, d?.message || 'Gagal membuat dokumen bertanda tangan.');
  }
  return res;
}

/* ------------------------------------------------ pemetaan data */
const toApi = (r) => ({
  id: r.id,
  document_id: r.document_id,
  name: r.doc_name,
  type: r.doc_type,
  additional_info: r.additional_info,
  field_of_study: r.field_of_study,
  status: r.status,
  signed_at: r.signed_at,
  revoked_at: r.revoked_at,
  revoke_reason: r.revoke_reason,
  token: r.token,
  verify_url: `${PUBLIC_URL}/verify/${r.token}`,
  signer_name: r.signer_name,
  signer_position: r.signer_position,
  original_format: r.original_format,
  page_count: r.page_count,
  label: r.label,
});

const safeName = (s) =>
  String(s || 'dokumen').normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'dokumen';

async function loadOwned(req) {
  if (!UUID.test(req.params.id)) throw httpErr(404, 'Tanda tangan tidak ditemukan');
  const { rows } = await pool.query('SELECT * FROM signatures WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Tanda tangan tidak ditemukan');
  if (rows[0].signer_id !== req.userId) throw httpErr(403, 'Anda tidak berhak mengakses tanda tangan ini');
  return rows[0];
}

/* ------------------------------------------------ routes */
app.get('/health', (req, res) => res.json({ service: 'signing-service', status: 'ok' }));

// GET /  -> daftar tanda tangan milik sendiri
app.get('/', requireUser, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM signatures WHERE signer_id = $1 ORDER BY signed_at DESC', [req.userId]);
  res.json(rows.map(toApi));
}));

// POST /  -> tanda tangani dokumen
app.post('/', requireUser, wrap(async (req, res) => {
  const { document_id, label } = req.body;
  const page = parseInt(req.body.page, 10);
  const x = Number(req.body.x);
  const y = Number(req.body.y);
  if (!UUID.test(String(document_id))) throw httpErr(400, 'document_id tidak valid');
  if (!Number.isInteger(page) || page < 1) throw httpErr(400, 'page harus bilangan bulat >= 1');
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw httpErr(400, 'x dan y harus antara 0 dan 1');

  // 1. dokumen
  const doc = await getJson(`${DOCUMENT_URL}/internal/documents/${document_id}`, 'Document Service', 'Dokumen tidak ditemukan');
  if (doc.owner_id !== req.userId) throw httpErr(403, 'Anda tidak berhak menandatangani dokumen ini');
  if (page > doc.page_count) throw httpErr(400, `Dokumen hanya memiliki ${doc.page_count} halaman`);
  if (!doc.name || !doc.type || !doc.field_of_study) throw httpErr(400, 'Nama dokumen, jenis dokumen, dan bidang studi wajib diisi');

  // 2. penanda tangan
  const user = await getJson(`${AUTH_URL}/internal/users/${req.userId}`, 'Auth Service', 'Akun tidak ditemukan');
  if (!user.has_signature) throw httpErr(400, 'Unggah gambar tanda tangan di menu Profil terlebih dahulu');
  const signatureImg = await getBuffer(`${AUTH_URL}/internal/users/${req.userId}/signature`, 'Auth Service', 'Gambar tanda tangan tidak ditemukan');
  const pdfBuf = await getBuffer(`${DOCUMENT_URL}/internal/documents/${document_id}/pdf`, 'Document Service', 'File dokumen tidak ditemukan');

  // 3. buat PDF bertanda tangan
  const id = crypto.randomUUID();
  const token = 'sigma-' + crypto.randomBytes(6).toString('hex');
  const signedAt = new Date();
  const signerName = user.title ? `${user.full_name}, ${user.title}` : user.full_name;
  const verifyUrl = `${PUBLIC_URL}/verify/${token}`;

  const fd = new FormData();
  fd.append('pdf', new Blob([pdfBuf]), 'doc.pdf');
  fd.append('signature', new Blob([signatureImg]), 'signature');
  Object.entries({
    label: label || (user.position ? `Mengetahui, ${user.position}` : 'Mengetahui'),
    page, x, y, verify_url: verifyUrl, token,
    signer_name: signerName, signer_position: user.position || '',
    signed_at: signedAt.toISOString(),
    name: doc.name, type: doc.type, additional_info: doc.additional_info || '', field_of_study: doc.field_of_study,
  }).forEach(([k, v]) => fd.append(k, String(v)));
  const signedPdf = Buffer.from(await (await postQr('/render', fd)).arrayBuffer());

  // 4. format lain: PNG per halaman, DOCX, ZIP
  const fd2 = new FormData();
  fd2.append('pdf', new Blob([signedPdf]), 'signed.pdf');
  const fm = await (await postQr('/formats', fd2)).json();

  // 5. simpan file + catat di database (satu transaksi)
  const dir = path.join(STORAGE, id);
  await fs.promises.mkdir(dir, { recursive: true });
  const files = [{ format: 'pdf', page: null, name: 'signed.pdf', buf: signedPdf }];
  fm.pngs.forEach((b, i) => files.push({ format: 'png', page: i + 1, name: `page-${i + 1}.png`, buf: Buffer.from(b, 'base64') }));
  if (fm.pngZip) files.push({ format: 'pngzip', page: null, name: 'pages.zip', buf: Buffer.from(fm.pngZip, 'base64') });
  files.push({ format: 'docx', page: null, name: 'signed.docx', buf: Buffer.from(fm.docx, 'base64') });
  files.push({ format: 'zip', page: null, name: 'all.zip', buf: Buffer.from(fm.zip, 'base64') });

  const client = await pool.connect();
  try {
    for (const f of files) await fs.promises.writeFile(path.join(dir, f.name), f.buf);
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO signatures (id, document_id, signer_id, token, doc_name, doc_type, additional_info, field_of_study,
         original_format, page_count, signer_name, signer_position, label, qr_page, qr_x, qr_y, signed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [id, doc.id, req.userId, token, doc.name, doc.type, doc.additional_info, doc.field_of_study,
        doc.original_format, doc.page_count, signerName, user.position || null, label || null, page, x, y, signedAt]
    );
    for (const f of files)
      await client.query(
        'INSERT INTO signed_files (signature_id, format, page, file_path, file_hash, size_bytes) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, f.format, f.page, f.name, sha256(f.buf), f.buf.length]
      );
    await client.query('COMMIT');
    res.status(201).json(toApi(ins.rows[0]));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

// POST /:id/revoke
app.post('/:id/revoke', requireUser, wrap(async (req, res) => {
  const s = await loadOwned(req);
  if (s.status === 'revoked') throw httpErr(409, 'Tanda tangan ini sudah dicabut');
  const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : null;
  const { rows } = await pool.query(
    `UPDATE signatures SET status = 'revoked', revoked_at = NOW(), revoke_reason = $2 WHERE id = $1 RETURNING *`,
    [s.id, reason]
  );
  res.json(toApi(rows[0]));
}));

// GET /:id/download?format=pdf|png|docx|zip
app.get('/:id/download', requireUser, wrap(async (req, res) => {
  const s = await loadOwned(req);
  const want = String(req.query.format || 'pdf').toLowerCase();
  const key = { pdf: 'pdf', docx: 'docx', zip: 'zip', png: s.page_count > 1 ? 'pngzip' : 'png' }[want];
  if (!key) throw httpErr(400, 'Format tidak dikenal. Gunakan pdf, png, docx, atau zip.');
  const { rows } = await pool.query(
    'SELECT * FROM signed_files WHERE signature_id = $1 AND format = $2 ORDER BY page NULLS FIRST LIMIT 1',
    [s.id, key]
  );
  const f = rows[0];
  if (!f) throw httpErr(404, 'File tidak ditemukan');
  const ext = { pdf: 'pdf', png: 'png', pngzip: 'zip', docx: 'docx', zip: 'zip' }[key];
  const suffix = { pdf: 'bertanda-tangan', png: 'gambar', pngzip: 'gambar', docx: 'bertanda-tangan', zip: 'semua-format' }[key];
  const filename = `${safeName(s.doc_name)}_${suffix}.${ext}`;
  const type = { pdf: 'application/pdf', png: 'image/png', pngzip: 'application/zip', zip: 'application/zip',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[key];
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.sendFile(path.join(STORAGE, s.id, f.file_path));
}));

/* ------------------------------------------------ internal: dipakai Verification Service */
async function findByToken(token) {
  const { rows } = await pool.query('SELECT * FROM signatures WHERE token = $1', [String(token).slice(0, 64)]);
  return rows[0];
}

// GET /internal/verify/:token
app.get('/internal/verify/:token', requireInternal, wrap(async (req, res) => {
  const s = await findByToken(req.params.token);
  if (!s) throw httpErr(404, 'Token tidak ditemukan');

  let status = s.status; // valid | revoked
  if (status === 'valid') {
    // Cek keutuhan file PDF yang tersimpan di server. Jika berubah/hilang -> Tidak Valid.
    try {
      const { rows } = await pool.query("SELECT file_path, file_hash FROM signed_files WHERE signature_id = $1 AND format = 'pdf'", [s.id]);
      const buf = await fs.promises.readFile(path.join(STORAGE, s.id, rows[0].file_path));
      if (sha256(buf) !== rows[0].file_hash) status = 'invalid';
    } catch {
      status = 'invalid';
    }
  }
  res.json({
    status, token: s.token,
    name: s.doc_name, type: s.doc_type, additional_info: s.additional_info,
    approved_by: s.signer_name, approved_at: s.signed_at, signed_by: s.signer_name,
    field_of_study: s.field_of_study, revoked_at: s.revoked_at,
  });
}));

// POST /internal/verify/:token/check  { hash }  -> apakah hash cocok dengan salah satu file hasil
app.post('/internal/verify/:token/check', requireInternal, wrap(async (req, res) => {
  const s = await findByToken(req.params.token);
  if (!s) throw httpErr(404, 'Token tidak ditemukan');
  const hash = String(req.body.hash || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw httpErr(400, 'Hash tidak valid');
  const { rows } = await pool.query('SELECT 1 FROM signed_files WHERE signature_id = $1 AND file_hash = $2 LIMIT 1', [s.id, hash]);
  res.json({ authentic: rows.length > 0 });
}));

app.use((err, req, res, next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Terjadi kesalahan pada server' });
});

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    app.listen(PORT, () => console.log(`[signing-service] jalan di http://localhost:${PORT}`));
  } catch (err) {
    console.error('[signing-service] gagal konek / siapkan database:', err.message);
    console.error('Pastikan PostgreSQL jalan, signing_db sudah dibuat, dan .env benar.');
    process.exit(1);
  }
})();

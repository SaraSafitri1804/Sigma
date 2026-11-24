const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const pool = require('./db');

const PORT = process.env.DOCUMENT_PORT || 3002;
const INTERNAL_KEY = process.env.INTERNAL_KEY;
const QRPDF_URL = `http://localhost:${process.env.QRPDF_PORT || 3004}`;
if (!INTERNAL_KEY) {
  console.error('INTERNAL_KEY wajib diisi di file .env');
  process.exit(1);
}

const MAX_PAGES = 30;
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg'];
const DIRS = ['originals', 'pdf', 'previews', 'tmp'].reduce((o, d) => {
  o[d] = path.join(__dirname, 'uploads', d);
  fs.mkdirSync(o[d], { recursive: true });
  return o;
}, {});

const upload = multer({
  storage: multer.diskStorage({
    destination: DIRS.tmp,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    cb(ALLOWED.includes(ext) ? null : Object.assign(new Error('Format file tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, atau gambar PNG/JPG.'), { status: 400 }), ALLOWED.includes(ext));
  },
});

const app = express();
app.use(express.json());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpErr = (status, message) => Object.assign(new Error(message), { status });

const publicDoc = (d) => ({
  id: d.id, name: d.name, type: d.type, additional_info: d.additional_info,
  field_of_study: d.field_of_study, original_format: d.original_format,
  page_count: d.page_count, file_hash: d.file_hash, created_at: d.created_at,
});

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

async function loadOwned(req) {
  if (!UUID.test(req.params.id)) throw httpErr(404, 'Dokumen tidak ditemukan');
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Dokumen tidak ditemukan');
  if (rows[0].owner_id !== req.userId) throw httpErr(403, 'Anda tidak berhak mengakses dokumen ini');
  return rows[0];
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const rm = (p) => p && fs.promises.unlink(p).catch(() => {});

async function qrpdf(endpoint, formData) {
  let res;
  try {
    res = await fetch(`${QRPDF_URL}${endpoint}`, { method: 'POST', headers: { 'x-internal-key': INTERNAL_KEY }, body: formData });
  } catch {
    throw httpErr(503, 'QR & PDF Service belum jalan.');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw httpErr(res.status === 422 ? 422 : 502, d?.message || 'Gagal memproses file.');
  }
  return Buffer.from(await res.arrayBuffer());
}

app.get('/health', (req, res) => res.json({ service: 'document-service', status: 'ok' }));

// POST /  -> unggah file (+ metadata opsional). File non-PDF otomatis diubah ke PDF.
app.post('/', requireUser, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw httpErr(400, 'File wajib diunggah');
  const tmp = req.file.path;
  const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
  const id = crypto.randomUUID();
  const originalPath = path.join(DIRS.originals, `${id}.${ext}`);
  const pdfPath = path.join(DIRS.pdf, `${id}.pdf`);
  try {
    const original = await fs.promises.readFile(tmp);
    let pdfBuf = original;
    if (ext !== 'pdf') {
      const fd = new FormData();
      fd.append('file', new Blob([original]), req.file.originalname);
      pdfBuf = await qrpdf('/convert', fd);
    }
    let pageCount;
    try {
      pageCount = (await PDFDocument.load(pdfBuf)).getPageCount();
    } catch {
      throw httpErr(422, 'PDF tidak dapat dibaca (rusak atau terkunci password).');
    }
    if (pageCount > MAX_PAGES) throw httpErr(422, `Dokumen terlalu panjang (${pageCount} halaman). Maksimal ${MAX_PAGES} halaman.`);

    await fs.promises.writeFile(originalPath, original);
    await fs.promises.writeFile(pdfPath, pdfBuf);

    const b = req.body;
    const base = req.file.originalname.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toUpperCase();
    const { rows } = await pool.query(
      `INSERT INTO documents (id, owner_id, name, type, additional_info, field_of_study, original_format,
         original_filename, original_path, pdf_path, page_count, file_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, req.userId, (b.name || base).trim().slice(0, 255), b.type || null, b.additional_info || null,
        b.field_of_study || null, ext, req.file.originalname, path.basename(originalPath),
        path.basename(pdfPath), pageCount, sha256(original)]
    );
    res.status(201).json(publicDoc(rows[0]));
  } catch (e) {
    await Promise.all([rm(originalPath), rm(pdfPath)]);
    throw e;
  } finally {
    await rm(tmp);
  }
}));

// GET /  -> daftar dokumen milik sendiri
app.get('/', requireUser, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM documents WHERE owner_id = $1 ORDER BY created_at DESC', [req.userId]);
  res.json(rows.map(publicDoc));
}));

app.get('/:id', requireUser, wrap(async (req, res) => res.json(publicDoc(await loadOwned(req)))));

// PUT /:id -> ubah metadata sebelum ditandatangani
app.put('/:id', requireUser, wrap(async (req, res) => {
  const d = await loadOwned(req);
  const { name, type, additional_info, field_of_study } = req.body;
  const { rows } = await pool.query(
    `UPDATE documents SET name = COALESCE($2, name), type = COALESCE($3, type),
       additional_info = COALESCE($4, additional_info), field_of_study = COALESCE($5, field_of_study),
       updated_at = NOW() WHERE id = $1 RETURNING *`,
    [d.id, name ? String(name).trim().slice(0, 255) : null, type ?? null, additional_info ?? null, field_of_study ?? null]
  );
  res.json(publicDoc(rows[0]));
}));

// GET /:id/preview/:page -> PNG satu halaman (untuk pratinjau posisi tanda tangan)
app.get('/:id/preview/:page', requireUser, wrap(async (req, res) => {
  const d = await loadOwned(req);
  const page = parseInt(req.params.page, 10);
  if (!(page >= 1 && page <= d.page_count)) throw httpErr(404, 'Halaman tidak ditemukan');
  const cache = path.join(DIRS.previews, `${d.id}-${page}.png`);
  if (!fs.existsSync(cache)) {
    const fd = new FormData();
    fd.append('pdf', new Blob([await fs.promises.readFile(path.join(DIRS.pdf, d.pdf_path))]), 'doc.pdf');
    fd.append('page', String(page));
    await fs.promises.writeFile(cache, await qrpdf('/preview', fd));
  }
  res.type('image/png').sendFile(cache);
}));

// ---- internal (antar service) ----
app.get('/internal/documents/:id', requireInternal, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) throw httpErr(404, 'Dokumen tidak ditemukan');
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Dokumen tidak ditemukan');
  res.json({ ...publicDoc(rows[0]), owner_id: rows[0].owner_id });
}));

app.get('/internal/documents/:id/pdf', requireInternal, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) throw httpErr(404, 'Dokumen tidak ditemukan');
  const { rows } = await pool.query('SELECT pdf_path FROM documents WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw httpErr(404, 'Dokumen tidak ditemukan');
  res.type('application/pdf').sendFile(path.join(DIRS.pdf, rows[0].pdf_path));
}));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 10 MB.' : err.message });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Terjadi kesalahan pada server' });
});

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    app.listen(PORT, () => console.log(`[document-service] jalan di http://localhost:${PORT}`));
  } catch (err) {
    console.error('[document-service] gagal konek / siapkan database:', err.message);
    console.error('Pastikan PostgreSQL jalan, document_db sudah dibuat, dan .env benar.');
    process.exit(1);
  }
})();

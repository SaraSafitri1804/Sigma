const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pool = require('./db');

const PORT = process.env.AUTH_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const INTERNAL_KEY = process.env.INTERNAL_KEY;

if (!JWT_SECRET || !INTERNAL_KEY) {
  console.error('JWT_SECRET dan INTERNAL_KEY wajib diisi di file .env');
  process.exit(1);
}

const UPLOAD_DIR = path.join(__dirname, 'uploads', 'signatures');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- upload gambar tanda tangan ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg'].includes(file.mimetype);
    cb(ok ? null : new Error('Gambar tanda tangan harus PNG atau JPG'), ok);
  },
});

function removeFile(p) {
  if (p) fs.promises.unlink(path.join(UPLOAD_DIR, p)).catch(() => {});
}

// ---------- helper ----------
const app = express();
app.use(express.json());

const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  title: u.title,
  position: u.position,
  email: u.email,
  has_signature: !!u.signature_path,
  created_at: u.created_at,
});

const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// Gateway sudah memverifikasi JWT dan mengirim x-user-id.
function requireUser(req, res, next) {
  const id = req.headers['x-user-id'];
  if (!id) return res.status(401).json({ message: 'Tidak terautentikasi' });
  req.userId = id;
  next();
}

function requireInternal(req, res, next) {
  if (req.headers['x-internal-key'] !== INTERNAL_KEY)
    return res.status(403).json({ message: 'Akses ditolak' });
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- routes publik ----------
app.get('/health', (req, res) => res.json({ service: 'auth-service', status: 'ok' }));

// POST /register  (boleh multipart: signature = file gambar, opsional)
app.post(
  '/register',
  upload.single('signature'),
  wrap(async (req, res) => {
    const { full_name, title, position, email, password } = req.body;
    const sigFile = req.file ? req.file.filename : null;

    if (!full_name || !email || !password) {
      removeFile(sigFile);
      return res.status(400).json({ message: 'full_name, email, dan password wajib diisi' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      removeFile(sigFile);
      return res.status(400).json({ message: 'Format email tidak valid' });
    }
    if (password.length < 6) {
      removeFile(sigFile);
      return res.status(400).json({ message: 'Password minimal 6 karakter' });
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (full_name, title, position, email, password_hash, signature_path)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [full_name.trim(), title || null, position || null, email.toLowerCase().trim(), hash, sigFile]
      );
      res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
    } catch (err) {
      removeFile(sigFile);
      if (err.code === '23505')
        return res.status(409).json({ message: 'Email sudah terdaftar' });
      throw err;
    }
  })
);

// POST /login
app.post(
  '/login',
  wrap(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email dan password wajib diisi' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ message: 'Email atau password salah' });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

// ---------- routes butuh login ----------
// GET /me
app.get(
  '/me',
  requireUser,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(publicUser(rows[0]));
  })
);

// PUT /me  (ubah nama, gelar, jabatan)
app.put(
  '/me',
  requireUser,
  wrap(async (req, res) => {
    const { full_name, title, position } = req.body;
    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         title     = COALESCE($3, title),
         position  = COALESCE($4, position),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.userId, full_name || null, title ?? null, position ?? null]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(publicUser(rows[0]));
  })
);

// POST /me/signature  (upload / ganti gambar tanda tangan)
app.post(
  '/me/signature',
  requireUser,
  upload.single('signature'),
  wrap(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'File "signature" wajib diupload' });

    const old = await pool.query('SELECT signature_path FROM users WHERE id = $1', [req.userId]);
    if (!old.rows[0]) {
      removeFile(req.file.filename);
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    await pool.query('UPDATE users SET signature_path = $2, updated_at = NOW() WHERE id = $1', [
      req.userId,
      req.file.filename,
    ]);
    removeFile(old.rows[0].signature_path);
    res.json({ message: 'Tanda tangan tersimpan' });
  })
);

// GET /me/signature  (lihat gambar tanda tangan sendiri)
app.get(
  '/me/signature',
  requireUser,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT signature_path FROM users WHERE id = $1', [
      req.userId,
    ]);
    if (!rows[0] || !rows[0].signature_path)
      return res.status(404).json({ message: 'Belum ada tanda tangan' });
    res.sendFile(path.join(UPLOAD_DIR, rows[0].signature_path));
  })
);

// ---------- routes internal (antar service, bukan untuk publik) ----------
// GET /internal/users/:id  -> profil penanda tangan untuk Signing / Verification Service
app.get(
  '/internal/users/:id',
  requireInternal,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(publicUser(rows[0]));
  })
);

// GET /internal/users/:id/signature -> gambar tanda tangan untuk QR & PDF Service
app.get(
  '/internal/users/:id/signature',
  requireInternal,
  wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT signature_path FROM users WHERE id = $1', [
      req.params.id,
    ]);
    if (!rows[0] || !rows[0].signature_path)
      return res.status(404).json({ message: 'Belum ada tanda tangan' });
    res.sendFile(path.join(UPLOAD_DIR, rows[0].signature_path));
  })
);

// ---------- error handler ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /PNG atau JPG/.test(err.message))
    return res.status(400).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

// ---------- start ----------
(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    app.listen(PORT, () => console.log(`[auth-service] jalan di http://localhost:${PORT}`));
  } catch (err) {
    console.error('[auth-service] gagal konek / siapkan database:', err.message);
    console.error('Pastikan PostgreSQL jalan, auth_db sudah dibuat, dan .env benar.');
    process.exit(1);
  }
})();

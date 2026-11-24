-- Jalankan pada koneksi ke database "auth_db".
-- (File yang sama juga dijalankan otomatis oleh Auth Service saat start.)
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(150) NOT NULL,
  title          VARCHAR(100),             -- gelar, mis. "S.Kom., M.T.I."
  position       VARCHAR(150),             -- jabatan, mis. "Kaprodi", "Dosen"
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  signature_path TEXT,                     -- file gambar tanda tangan
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

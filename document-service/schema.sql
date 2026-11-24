-- Jalankan pada koneksi ke database "document_db".
-- (File yang sama juga dijalankan otomatis oleh Document Service saat start.)
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL,              -- id user di auth_db (tanpa foreign key lintas database)
  name              VARCHAR(255) NOT NULL,
  type              VARCHAR(100),
  additional_info   TEXT,
  field_of_study    VARCHAR(150),
  original_format   VARCHAR(10) NOT NULL,       -- pdf, docx, png, ...
  original_filename VARCHAR(255),
  original_path     TEXT NOT NULL,
  pdf_path          TEXT NOT NULL,              -- PDF hasil konversi (atau file asli bila sudah PDF)
  page_count        INT  NOT NULL,
  file_hash         CHAR(64) NOT NULL,          -- SHA-256 file asli
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);

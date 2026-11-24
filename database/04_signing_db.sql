-- Jalankan pada koneksi ke database "signing_db".
-- (File yang sama juga dijalankan otomatis oleh Signing Service saat start.)
CREATE TABLE IF NOT EXISTS signatures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL,               -- id dokumen di document_db
  signer_id        UUID NOT NULL,               -- id user di auth_db
  token            VARCHAR(64) NOT NULL UNIQUE, -- isi QR: https://domain/verify/{token}
  status           VARCHAR(10) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
  -- salinan data saat ditandatangani (supaya verifikasi tidak bergantung service lain)
  doc_name         VARCHAR(255) NOT NULL,
  doc_type         VARCHAR(100),
  additional_info  TEXT,
  field_of_study   VARCHAR(150),
  original_format  VARCHAR(10),
  page_count       INT NOT NULL DEFAULT 1,
  signer_name      VARCHAR(200) NOT NULL,
  signer_position  VARCHAR(150),
  label            VARCHAR(150),
  qr_page          INT NOT NULL DEFAULT 1,
  qr_x             REAL NOT NULL,
  qr_y             REAL NOT NULL,
  signed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at       TIMESTAMPTZ,
  revoke_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_signatures_signer ON signatures(signer_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS signed_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID NOT NULL REFERENCES signatures(id) ON DELETE CASCADE,
  format       VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'png', 'pngzip', 'docx', 'zip')),
  page         INT,                              -- hanya untuk format png
  file_path    TEXT NOT NULL,
  file_hash    CHAR(64) NOT NULL,                -- SHA-256 file hasil
  size_bytes   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signed_files_sig ON signed_files(signature_id);
CREATE INDEX IF NOT EXISTS idx_signed_files_hash ON signed_files(file_hash);

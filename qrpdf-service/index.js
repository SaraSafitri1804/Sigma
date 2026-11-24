const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const multer = require('multer');
const { toPdf } = require('./lib/convert');
const { renderSignedPdf } = require('./lib/stamp');
const { buildFormats } = require('./lib/formats');
const { pdfPageToPng } = require('./lib/pdfimage');
const { findSoffice } = require('./lib/soffice');

const PORT = process.env.QRPDF_PORT || 3004;
const INTERNAL_KEY = process.env.INTERNAL_KEY;
if (!INTERNAL_KEY) {
  console.error('INTERNAL_KEY wajib diisi di file .env');
  process.exit(1);
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const app = express();

app.get('/health', (req, res) => res.json({ service: 'qrpdf-service', status: 'ok' }));

// Semua endpoint lain hanya untuk antar service.
app.use((req, res, next) =>
  req.headers['x-internal-key'] === INTERNAL_KEY ? next() : res.status(403).json({ message: 'Akses ditolak' })
);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const need = (req, ...names) => {
  for (const n of names)
    if (!req.files?.[n]?.[0]) throw Object.assign(new Error(`File "${n}" wajib dikirim`), { status: 400 });
};

// file (pdf/gambar/office) -> PDF
app.post('/convert', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File wajib dikirim' });
  const pdf = await toPdf(req.file.buffer, req.file.originalname);
  res.type('application/pdf').send(pdf);
}));

// satu halaman PDF -> PNG (untuk preview)
app.post('/preview', upload.single('pdf'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File pdf wajib dikirim' });
  const png = await pdfPageToPng(req.file.buffer, parseInt(req.body.page, 10) || 1, 1.5);
  res.type('image/png').send(png);
}));

// tempel tanda tangan + QR + halaman deskripsi
app.post('/render', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), wrap(async (req, res) => {
  need(req, 'pdf', 'signature');
  const b = req.body;
  if (!b.verify_url || !b.token) return res.status(400).json({ message: 'verify_url dan token wajib diisi' });
  const out = await renderSignedPdf({
    pdfBuf: req.files.pdf[0].buffer,
    signatureBuf: req.files.signature[0].buffer,
    label: b.label, page: parseInt(b.page, 10) || 1, x: parseFloat(b.x), y: parseFloat(b.y),
    verifyUrl: b.verify_url, token: b.token,
    signerName: b.signer_name, signerPosition: b.signer_position,
    signedAt: b.signed_at || new Date().toISOString(),
    name: b.name, type: b.type, additionalInfo: b.additional_info, fieldOfStudy: b.field_of_study,
  });
  res.type('application/pdf').send(out);
}));

// PDF bertanda tangan -> PNG per halaman, DOCX, ZIP (base64 dalam JSON)
app.post('/formats', upload.single('pdf'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File pdf wajib dikirim' });
  const f = await buildFormats(req.file.buffer);
  res.json({
    pngs: f.pngs.map((b) => b.toString('base64')),
    docx: f.docx.toString('base64'),
    pngZip: f.pngZip ? f.pngZip.toString('base64') : null,
    zip: f.zip.toString('base64'),
  });
}));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.message });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Terjadi kesalahan pada server' });
});

app.listen(PORT, async () => {
  console.log(`[qrpdf-service] jalan di http://localhost:${PORT}`);
  const so = await findSoffice();
  console.log(so ? `[qrpdf-service] LibreOffice ditemukan: ${so}` : '[qrpdf-service] LibreOffice tidak ditemukan (PDF dan gambar tetap bisa; Word/Excel/PowerPoint belum).');
});

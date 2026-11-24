// Membuat format hasil dari PDF bertanda tangan: PNG per halaman, DOCX, ZIP.
const archiver = require('archiver');
const { PDFDocument } = require('pdf-lib');
const { Document, Packer, Paragraph, ImageRun, AlignmentType } = require('docx');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { pdfToPngs } = require('./pdfimage');

// PNG (RGBA) -> JPEG tanpa transparansi. Word/LibreOffice kadang menampilkan PNG beralfa sebagai halaman kosong.
async function pngToJpeg(png) {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, img.width, img.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toBuffer('image/jpeg', 92);
}

function zip(entries) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks = [];
    archive.on('data', (c) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const e of entries) archive.append(e.data, { name: e.name, date: new Date(0) });
    archive.finalize();
  });
}

async function buildDocx(pngs, sizes) {
  const jpgs = await Promise.all(pngs.map(pngToJpeg));
  const M = 18; // margin halaman (pt); gambar dibuat sedikit lebih kecil agar selalu muat di satu halaman
  const sections = jpgs.map((jpg, i) => {
    const [wPt, hPt] = sizes[i];
    const k = 96 / 72; // pt -> px
    const scale = Math.min((wPt - 2 * M) / wPt, (hPt - 2 * M - 8) / hPt);
    return {
      properties: {
        page: {
          size: { width: Math.round(wPt * 20), height: Math.round(hPt * 20) },
          margin: { top: M * 20, right: M * 20, bottom: M * 20, left: M * 20, header: 0, footer: 0, gutter: 0 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              type: 'jpg', data: jpg,
              transformation: { width: Math.floor(wPt * scale * k), height: Math.floor(hPt * scale * k) },
            }),
          ],
        }),
      ],
    };
  });
  return Packer.toBuffer(new Document({ creator: 'SIGMA', title: 'Dokumen bertanda tangan', sections }));
}

async function buildFormats(signedPdf) {
  const src = await PDFDocument.load(signedPdf);
  const pngs = await pdfToPngs(signedPdf, { scale: 2 });
  const sizes = src.getPages().slice(0, pngs.length).map((p) => [p.getWidth(), p.getHeight()]);
  const docx = await buildDocx(pngs, sizes);
  const pngEntries = pngs.map((data, i) => ({ name: `halaman-${i + 1}.png`, data }));
  const pngZip = pngs.length > 1 ? await zip(pngEntries) : null;
  const all = await zip([
    { name: 'dokumen-bertanda-tangan.pdf', data: signedPdf },
    ...pngEntries.map((e) => ({ name: `gambar/${e.name}`, data: e.data })),
    { name: 'dokumen-bertanda-tangan.docx', data: docx },
  ]);
  return { pngs, docx, pngZip, zip: all };
}

module.exports = { buildFormats };

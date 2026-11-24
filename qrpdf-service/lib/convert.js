// Mengubah PDF / gambar / dokumen Office menjadi PDF.
const { PDFDocument } = require('pdf-lib');
const { officeToPdf } = require('./soffice');

const OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'];

const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

async function imageToPdf(buf) {
  const pdf = await PDFDocument.create();
  const img = isPng(buf) ? await pdf.embedPng(buf) : isJpg(buf) ? await pdf.embedJpg(buf) : null;
  if (!img) throw Object.assign(new Error('Gambar harus berformat PNG atau JPG'), { status: 422 });
  const [W, H, M] = [595.28, 841.89, 36];
  const ratio = Math.min((W - 2 * M) / img.width, (H - 2 * M) / img.height, 1.5);
  const w = img.width * ratio, h = img.height * ratio;
  const page = pdf.addPage([W, H]);
  page.drawImage(img, { x: (W - w) / 2, y: H - M - h, width: w, height: h });
  return Buffer.from(await pdf.save());
}

async function toPdf(buf, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return buf;
  if (['png', 'jpg', 'jpeg'].includes(ext)) return imageToPdf(buf);
  if (OFFICE.includes(ext)) return officeToPdf(buf, ext);
  throw Object.assign(new Error('Format file tidak didukung.'), { status: 422 });
}

module.exports = { toPdf };

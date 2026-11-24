// Menempelkan tanda tangan + QR ke PDF dan menambah halaman "Description of The Signed Document".
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const QRCode = require('qrcode');

const BLUE = rgb(0.043, 0.31, 0.62); // #0B4F9E
const GRAY = rgb(0.38, 0.4, 0.45);
const LINE = rgb(0.2, 0.2, 0.2);

// Helvetica hanya mendukung WinAnsi: ganti karakter yang tidak didukung.
const clean = (s = '') =>
  String(s)
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/\u00A0/g, ' ')
    .replace(/[\r\t]/g, ' ')
    .replace(/[^\n\x20-\x7E\u00A1-\u00FF]/g, '?');

const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

async function embedImage(pdf, buf) {
  if (isPng(buf)) return pdf.embedPng(buf);
  if (isJpg(buf)) return pdf.embedJpg(buf);
  throw Object.assign(new Error('Gambar tanda tangan harus PNG atau JPG'), { status: 422 });
}

function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of clean(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      // pecah kata yang lebih panjang dari lebar kolom
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxW && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxW) cut--;
        if (line) { out.push(line); line = ''; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
      else { if (line) out.push(line); line = w; }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

function truncate(text, font, size, maxW) {
  let t = clean(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxW) t = t.slice(0, -1);
  return t + '...';
}

function fmtLong(iso) {
  const d = new Date(iso);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const hh = p.hour === '24' ? '00' : p.hour;
  return `${+p.day} ${MON[+p.month - 1]} ${p.year}, ${hh}:${p.minute} WIB`;
}

async function stampSignature(pdf, { signatureBuf, qrBuf, label, signerName, signerPosition, page, x, y }) {
  const pages = pdf.getPages();
  const pg = pages[Math.min(Math.max(1, page), pages.length) - 1];
  const { width: W, height: H } = pg.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sigImg = await embedImage(pdf, signatureBuf);
  const qrImg = await pdf.embedPng(qrBuf);

  const s = W / 595; // skala relatif terhadap A4
  const boxW = 200 * s, boxH = 104 * s, pad = 4 * s;
  const left = Math.min(1, Math.max(0, x)) * (W - boxW);
  const top = Math.min(1, Math.max(0, y)) * (H - boxH);
  const bottom = H - top - boxH;

  // label (mis. "Mengetahui, Kaprodi")
  pg.drawText(truncate(label || 'Mengetahui', bold, 9.5 * s, boxW - 2 * pad), {
    x: left + pad, y: bottom + boxH - 11 * s, size: 9.5 * s, font: bold, color: rgb(0, 0, 0),
  });

  // QR di kiri
  const qrSize = 64 * s;
  const qrY = bottom + boxH - 14 * s - qrSize - 4 * s;
  pg.drawImage(qrImg, { x: left + pad, y: qrY, width: qrSize, height: qrSize });

  // gambar tanda tangan di kanan (proporsional)
  const areaX = left + pad + qrSize + 8 * s;
  const areaW = boxW - (areaX - left) - pad;
  const areaH = qrSize;
  const ratio = Math.min(areaW / sigImg.width, areaH / sigImg.height);
  const sw = sigImg.width * ratio, sh = sigImg.height * ratio;
  pg.drawImage(sigImg, { x: areaX + (areaW - sw) / 2, y: qrY + (areaH - sh) / 2, width: sw, height: sh });

  // nama + jabatan
  pg.drawText(truncate(signerName, bold, 8 * s, boxW - 2 * pad), {
    x: left + pad, y: qrY - 10 * s, size: 8 * s, font: bold, color: rgb(0, 0, 0),
  });
  if (signerPosition)
    pg.drawText(truncate(signerPosition, font, 7.5 * s, boxW - 2 * pad), {
      x: left + pad, y: qrY - 19 * s, size: 7.5 * s, font, color: GRAY,
    });
}

async function addDescriptionPage(pdf, { rows, verifyUrl, token, qrBuf }) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrImg = await pdf.embedPng(qrBuf);
  const W = 595.28, H = 841.89, M = 50;
  const page = pdf.addPage([W, H]);

  page.drawText('Description of The Signed Document', { x: M, y: H - M - 12, size: 15, font: bold, color: BLUE });
  page.drawLine({ start: { x: M, y: H - M - 22 }, end: { x: W - M, y: H - M - 22 }, thickness: 1.5, color: BLUE });

  const cols = [34, 150, W - 2 * M - 34 - 150];
  const size = 10, lh = 13, padY = 6, padX = 6;
  let y = H - M - 44;
  const cell = (x, w, h, fill) => {
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: LINE, borderWidth: 0.8, color: fill });
  };

  // header
  const hh = 22;
  let cx = M;
  ['No', 'Label', 'Description'].forEach((t, i) => {
    cell(cx, cols[i], hh, rgb(0.9, 0.93, 0.97));
    page.drawText(t, { x: cx + padX, y: y - 15, size, font: bold });
    cx += cols[i];
  });
  y -= hh;

  rows.forEach(([label, value], i) => {
    const lLines = wrap(label, font, size, cols[1] - 2 * padX);
    const vLines = wrap(value || '-', font, size, cols[2] - 2 * padX);
    const lines = Math.max(lLines.length, vLines.length);
    const h = Math.max(24, lines * lh + 2 * padY);
    cx = M;
    cols.forEach((w, c) => { cell(cx, w, h, undefined); cx += w; });
    page.drawText(String(i + 1), { x: M + padX, y: y - padY - 9, size, font });
    lLines.forEach((t, k) => page.drawText(t, { x: M + cols[0] + padX, y: y - padY - 9 - k * lh, size, font }));
    vLines.forEach((t, k) => page.drawText(t, { x: M + cols[0] + cols[1] + padX, y: y - padY - 9 - k * lh, size, font }));
    y -= h;
  });

  // blok verifikasi
  y -= 28;
  const qr = 92;
  page.drawImage(qrImg, { x: M, y: y - qr, width: qr, height: qr });
  const tx = M + qr + 14;
  page.drawText('Verifikasi keaslian dokumen', { x: tx, y: y - 12, size: 11, font: bold, color: BLUE });
  page.drawText('Pindai QR Code di samping atau buka tautan berikut:', { x: tx, y: y - 28, size: 9.5, font, color: GRAY });
  wrap(verifyUrl, font, 9.5, W - M - tx).forEach((t, k) =>
    page.drawText(t, { x: tx, y: y - 44 - k * 12, size: 9.5, font, color: BLUE }));
  page.drawText(`Token: ${token}`, { x: tx, y: y - 74, size: 9.5, font });

  page.drawText('Dokumen ini ditandatangani secara digital dan diverifikasi oleh sistem SIGMA.', {
    x: M, y: M - 8, size: 8.5, font, color: GRAY,
  });
}

/**
 * Membuat PDF bertanda tangan.
 * f: { pdfBuf, signatureBuf, label, page, x, y, verifyUrl, token, signerName, signerPosition,
 *      signedAt, name, type, additionalInfo, fieldOfStudy }
 */
async function renderSignedPdf(f) {
  let pdf;
  try {
    pdf = await PDFDocument.load(f.pdfBuf, { ignoreEncryption: false });
  } catch (e) {
    throw Object.assign(new Error('PDF tidak dapat dibaca (rusak atau terkunci password).'), { status: 422 });
  }
  const qrBuf = await QRCode.toBuffer(f.verifyUrl, {
    type: 'png', width: 420, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' },
  });

  await stampSignature(pdf, { ...f, qrBuf });

  const when = fmtLong(f.signedAt);
  await addDescriptionPage(pdf, {
    qrBuf, verifyUrl: f.verifyUrl, token: f.token,
    rows: [
      ['Name of Document', f.name],
      ['Type of Documents', f.type],
      ['Additional Information', f.additionalInfo || '-'],
      ['Approved By', f.signerName],
      ['Approved At', when],
      ['Signed By', f.signerName],
      ['Field of Study', f.fieldOfStudy],
    ],
  });

  pdf.setTitle(clean(f.name));
  pdf.setProducer('SIGMA');
  return Buffer.from(await pdf.save());
}

module.exports = { renderSignedPdf, clean };

// Render halaman PDF menjadi PNG memakai pdfjs-dist + @napi-rs/canvas (tanpa Poppler).
const path = require('path');
const napi = require('@napi-rs/canvas');
const { createCanvas } = napi;

// pdfjs membutuhkan DOMMatrix / Path2D / ImageData di Node
globalThis.DOMMatrix ||= napi.DOMMatrix;
globalThis.Path2D ||= napi.Path2D;
globalThis.ImageData ||= napi.ImageData;

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(cc, width, height) { cc.canvas.width = width; cc.canvas.height = height; }
  destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; cc.canvas = null; cc.context = null; }
}

let pdfjsPromise;
const loadPdfjs = () => (pdfjsPromise ||= import('pdfjs-dist/legacy/build/pdf.mjs'));

const fontDir =
  path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;

async function openDoc(buffer) {
  const pdfjs = await loadPdfjs();
  const factory = new NodeCanvasFactory();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory: factory,
    standardFontDataUrl: fontDir,
    useSystemFonts: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  doc.__factory = factory;
  return doc;
}

async function renderPage(doc, pageNumber, scale) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const factory = doc.__factory;
  const cc = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
  cc.context.fillStyle = '#ffffff';
  cc.context.fillRect(0, 0, cc.canvas.width, cc.canvas.height);
  await page.render({ canvasContext: cc.context, viewport }).promise;
  const png = cc.canvas.toBuffer('image/png');
  page.cleanup();
  return png;
}

/** Semua halaman -> array Buffer PNG */
async function pdfToPngs(buffer, { scale = 2, maxPages = 40 } = {}) {
  const doc = await openDoc(buffer);
  try {
    const n = Math.min(doc.numPages, maxPages);
    const out = [];
    for (let i = 1; i <= n; i++) out.push(await renderPage(doc, i, scale));
    return out;
  } finally {
    await doc.destroy();
  }
}

/** Satu halaman -> Buffer PNG */
async function pdfPageToPng(buffer, pageNumber, scale = 1.5) {
  const doc = await openDoc(buffer);
  try {
    const n = Math.min(Math.max(1, pageNumber), doc.numPages);
    return await renderPage(doc, n, scale);
  } finally {
    await doc.destroy();
  }
}

module.exports = { pdfToPngs, pdfPageToPng };

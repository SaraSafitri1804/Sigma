// Konversi Word/Excel/PowerPoint ke PDF memakai LibreOffice (opsional).
const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

let cached; // undefined = belum dicari, null = tidak ada

const run = (cmd, args, timeout = 120000) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve(stdout)
    )
  );

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function findSoffice() {
  if (cached !== undefined) return cached;
  const candidates = [];
  if (process.env.SOFFICE_PATH) candidates.push(process.env.SOFFICE_PATH);
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice');
  }
  for (const c of candidates) if (await exists(c)) return (cached = c);
  for (const c of ['soffice', 'libreoffice']) {
    try { await run(c, ['--version'], 20000); return (cached = c); } catch { /* coba berikutnya */ }
  }
  return (cached = null);
}

// LibreOffice tidak boleh dijalankan paralel dengan profil yang sama.
let queue = Promise.resolve();

function officeToPdf(buffer, ext) {
  const job = queue.then(async () => {
    const exe = await findSoffice();
    if (!exe) {
      throw Object.assign(
        new Error('Konversi Word/Excel/PowerPoint membutuhkan LibreOffice. Pasang LibreOffice (gratis), atau unggah file dalam bentuk PDF atau gambar.'),
        { status: 422 }
      );
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sigma-lo-'));
    try {
      const input = path.join(dir, `input.${ext}`);
      await fs.writeFile(input, buffer);
      const profile = pathToFileURL(path.join(os.tmpdir(), 'sigma-lo-profile')).href;
      await run(exe, [
        '--headless', '--norestore', '--nolockcheck', '--nodefault',
        `-env:UserInstallation=${profile}`,
        '--convert-to', 'pdf', '--outdir', dir, input,
      ]);
      return await fs.readFile(path.join(dir, 'input.pdf'));
    } catch (e) {
      if (e.status) throw e;
      throw Object.assign(new Error('Gagal mengubah file ke PDF. Pastikan file tidak rusak atau terkunci password.'), { status: 422 });
    } finally {
      fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { officeToPdf, findSoffice };

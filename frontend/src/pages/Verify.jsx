import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { docs } from '../lib/api';
import { fmtLong } from '../lib/format';

const BANNER = {
  valid: {
    wrap: 'bg-status-valid-container text-on-status-valid-container border-status-valid/30',
    badge: 'bg-status-valid text-light-on-primary', icon: 'check_circle',
    title: 'Tanda Tangan Valid', text: 'Dokumen terverifikasi asli dan tanda tangan masih aktif.',
  },
  revoked: {
    wrap: 'bg-status-revoked-container text-on-status-revoked-container border-status-revoked/30',
    badge: 'bg-action-red text-on-action-red', icon: 'cancel',
    title: 'Tanda Tangan Dicabut', text: 'Tanda tangan pada dokumen ini telah dicabut oleh penanda tangan.',
  },
  invalid: {
    wrap: 'bg-status-invalid-container text-on-status-invalid-container border-status-invalid/30',
    badge: 'bg-status-invalid text-light-on-primary', icon: 'warning',
    title: 'Tanda Tangan Tidak Valid', text: 'Dokumen ini tidak lolos verifikasi. Jangan percaya tanpa konfirmasi penanda tangan.',
  },
};

export default function Verify() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // true | false | null
  const [checkError, setCheckError] = useState('');

  useEffect(() => {
    setData(null); setError('');
    docs.verify(token).then(setData).catch((e) => setError(e.status === 404 ? 'Token tidak ditemukan. QR Code ini tidak terdaftar di sistem SIGMA.' : e.message));
  }, [token]);

  async function check() {
    if (!file) return setCheckError('Pilih file yang ingin diperiksa terlebih dahulu.');
    setChecking(true); setCheckError(''); setResult(null);
    try {
      const r = await docs.checkFile(token, file);
      setResult(!!r.authentic);
    } catch (e) {
      setCheckError(e.message);
    } finally { setChecking(false); }
  }

  const b = data && (BANNER[data.status] || BANNER.invalid);
  const rows = data && [
    ['Name of Document', data.name],
    ['Type of Documents', data.type],
    ['Additional Information', data.additional_info || '-'],
    ['Approved By', data.approved_by],
    ['Approved At', fmtLong(data.approved_at)],
    ['Signed By', data.signed_by],
    ['Field of Study', data.field_of_study],
  ];

  return (
    <div className="min-h-screen bg-light-primary-container/50 flex flex-col items-center justify-center p-4">
      <main className="w-full max-w-md bg-light-surface-container-lowest rounded-md shadow-[0_8px_28px_rgba(11,79,158,0.12)] p-5 flex flex-col gap-5">
        <header className="flex items-center gap-2.5 pb-3 border-b border-light-outline-variant">
          <div className="w-9 h-9 rounded-md bg-brand-blue text-light-on-primary flex items-center justify-center shrink-0">
            <Icon name="qr_code_scanner" className="text-title-md" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline text-headline-sm text-brand-blue leading-tight">SIGMA</span>
            <span className="font-body text-body-sm text-light-on-surface-variant">Verifikasi Dokumen</span>
          </div>
        </header>

        {!data && !error && <p className="font-body text-body-md text-light-on-surface-variant py-8 text-center" role="status">Memeriksa dokumen…</p>}

        {error && (
          <section role="alert" className="rounded-md bg-status-invalid-container text-on-status-invalid-container p-4 flex items-start gap-3.5 border border-status-invalid/30">
            <Icon name="gpp_bad" className="text-headline-md shrink-0" fill />
            <div className="flex flex-col">
              <h1 className="font-headline text-headline-sm">Dokumen tidak dapat diverifikasi</h1>
              <p className="font-body text-body-sm">{error}</p>
            </div>
          </section>
        )}

        {data && (
          <>
            <section role="status" className={`rounded-md p-4 flex items-center gap-3.5 border ${b.wrap}`}>
              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${b.badge}`}>
                <Icon name={b.icon} className="text-headline-md" fill />
              </div>
              <div className="flex flex-col">
                <h1 className="font-headline text-headline-sm">{b.title}</h1>
                <p className="font-body text-body-sm opacity-90">
                  {data.status === 'revoked' && data.revoked_at ? `Dicabut pada ${fmtLong(data.revoked_at)}.` : b.text}
                </p>
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="font-headline text-title-md text-brand-blue">Description of The Signed Document</h2>
              <div className="w-full overflow-x-auto rounded border border-light-outline-variant">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-blue text-light-on-primary">
                      <th scope="col" className="py-2.5 px-2.5 font-body text-label-sm border-r border-light-on-primary/20 w-10">No</th>
                      <th scope="col" className="py-2.5 px-3 font-body text-label-sm border-r border-light-on-primary/20">Label</th>
                      <th scope="col" className="py-2.5 px-3 font-body text-label-sm">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-outline-variant font-body text-body-sm">
                    {rows.map(([label, value], i) => (
                      <tr key={label} className={i % 2 ? 'bg-light-surface-container-low' : ''}>
                        <td className="py-2.5 px-2.5 border-r border-light-outline-variant tabular-nums text-light-on-surface-variant">{i + 1}</td>
                        <td className="py-2.5 px-3 border-r border-light-outline-variant font-medium text-light-on-surface">{label}</td>
                        <td className={`py-2.5 px-3 text-light-on-surface ${i === 0 ? 'font-medium' : ''}`}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-md border border-light-outline-variant bg-light-surface-container-low p-4 flex flex-col gap-3">
              <div className="flex flex-col">
                <h2 className="font-headline text-title-md text-brand-blue">Cek Keaslian File</h2>
                <p className="font-body text-body-sm text-light-on-surface-variant">Unggah file yang Anda terima untuk mencocokkan hash SHA-256 dengan data di server.</p>
              </div>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files?.[0] || null); setResult(null); }}
                className="flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-brand-blue/40 bg-light-surface-container-lowest px-3 py-4 text-center hover:border-brand-blue transition-colors cursor-pointer"
              >
                <Icon name="upload_file" className="text-headline-md text-brand-blue" />
                <span className="font-body text-label-sm text-brand-blue break-all">{file ? file.name : 'Seret & lepas file di sini atau klik untuk memilih'}</span>
                <span className="font-body text-body-sm text-light-on-surface-variant">PDF, Gambar (PNG/JPG), Word (.docx), atau ZIP</span>
                <input type="file" accept=".pdf,.doc,.docx,.zip,image/png,image/jpeg" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setCheckError(''); }} />
              </label>
              <button type="button" onClick={check} disabled={checking} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-sm cursor-pointer disabled:opacity-60">
                <Icon name="fact_check" className="text-title-md" />
                <span className="font-body text-label-lg">{checking ? 'Memeriksa…' : 'Periksa File'}</span>
              </button>
              {checkError && <p role="alert" className="font-body text-body-sm text-action-red">{checkError}</p>}
              {result === true && (
                <div role="status" className="rounded bg-status-valid-container text-on-status-valid-container px-3.5 py-2.5 flex items-center gap-2.5 border border-status-valid/30">
                  <Icon name="verified" className="text-title-md text-status-valid shrink-0" fill />
                  <div className="flex flex-col">
                    <span className="font-body text-label-sm font-semibold">File Asli</span>
                    <span className="font-body text-body-sm">Hash SHA-256 cocok dengan dokumen yang ditandatangani.</span>
                  </div>
                </div>
              )}
              {result === false && (
                <div role="status" className="rounded bg-status-revoked-container text-on-status-revoked-container px-3.5 py-2.5 flex items-center gap-2.5 border border-status-revoked/30">
                  <Icon name="gpp_bad" className="text-title-md text-action-red shrink-0" fill />
                  <div className="flex flex-col">
                    <span className="font-body text-label-sm font-semibold">File Telah Diubah</span>
                    <span className="font-body text-body-sm">Hash tidak cocok. Isi file telah diubah setelah ditandatangani.</span>
                  </div>
                </div>
              )}
            </section>

            <footer className="pt-3 border-t border-light-outline-variant flex flex-col gap-2 text-center">
              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-light-surface-container-low self-center">
                <span className="font-body text-body-sm text-light-on-surface-variant">Token:</span>
                <span className="font-mono text-mono-sm text-brand-blue break-all">{data.token}</span>
              </div>
              <p className="font-body text-body-sm text-light-on-surface-variant text-pretty">
                Dokumen ini ditandatangani secara digital dan diverifikasi oleh sistem SIGMA.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

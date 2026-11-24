import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { auth, docs, isMock } from '../lib/api';
import { fmtSize, fullName } from '../lib/format';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['Persetujuan KProdi', 'Rekomendasi Dosen', 'Surat Tugas', 'Pengesahan Proposal', 'Surat Keterangan'];
const ALLOWED = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'];

const input =
  'w-full rounded border border-light-outline-variant bg-light-surface-container-lowest px-3.5 py-2.5 font-body text-body-md text-light-on-surface placeholder:text-light-outline focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none';

const extOf = (n = '') => n.split('.').pop().toLowerCase();
const fileIcon = (n) => {
  const e = extOf(n);
  if (e === 'pdf') return ['picture_as_pdf', 'text-action-red'];
  if (e === 'doc' || e === 'docx') return ['article', 'text-light-secondary'];
  return ['image', 'text-brand-blue'];
};

// Perkiraan jumlah halaman PDF dengan menghitung objek /Type /Page. Cukup untuk PDF biasa.
async function countPdfPages(file) {
  try {
    const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
    const n = (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
    return Math.max(1, n);
  } catch { return 1; }
}

export default function SignDocument() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: '', type: TYPES[0], additional_info: '', field_of_study: '' });
  const [label, setLabel] = useState(user?.position ? `Mengetahui, ${user.position}` : 'Mengetahui');
  const [pos, setPos] = useState({ x: 1, y: 1 }); // 0..1 dari ruang bebas di halaman
  const [sigUrl, setSigUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [docId, setDocId] = useState(null); // mode API: id dokumen yang sudah diunggah
  const [uploading, setUploading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  const [ratio, setRatio] = useState('3 / 4');
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (!user?.has_signature) return;
    let url;
    auth.signatureUrl().then((u) => { url = u; setSigUrl(u); }).catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [user?.has_signature]);

  // Pratinjau halaman asli dari server (mode API)
  useEffect(() => {
    if (isMock || !docId) return;
    let url;
    let cancelled = false;
    docs.previewUrl(docId, page).then((u) => {
      if (cancelled) return URL.revokeObjectURL(u);
      url = u;
      setPreviewSrc(u);
    }).catch(() => setPreviewSrc(''));
    return () => { cancelled = true; url && URL.revokeObjectURL(url); };
  }, [docId, page]);

  // Kotak tanda tangan dibuat sebanding dengan ukuran aslinya di PDF (200 pt dari lebar A4 595 pt)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setZoom((e.contentRect.width * (200 / 595)) / 224));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function pickFile(f) {
    setFileError('');
    if (!f) return;
    if (!ALLOWED.includes(extOf(f.name))) return setFileError('Format tidak didukung. Gunakan PDF, Word (.doc/.docx), atau gambar PNG/JPG.');
    if (f.size > MAX_BYTES) return setFileError('Ukuran file maksimal 10 MB.');
    setFile(f);
    setPage(1);
    setPreviewSrc('');
    setDocId(null);
    const guess = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toUpperCase();
    if (!form.name) setForm((x) => ({ ...x, name: guess }));

    if (isMock) {
      setPageCount(extOf(f.name) === 'pdf' ? await countPdfPages(f) : 1);
      return;
    }
    // Mode API: unggah sekarang agar server bisa mengubah ke PDF dan membuat pratinjau halaman
    setUploading(true);
    try {
      const d = await docs.upload(f);
      setDocId(d.id);
      setPageCount(d.page_count);
    } catch (e) {
      setFile(null);
      setFileError(e.message);
    } finally {
      setUploading(false);
    }
  }

  /* ---- geser kotak tanda tangan ---- */
  function onDown(e) {
    const c = canvasRef.current.getBoundingClientRect();
    const b = boxRef.current.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, fw: c.width - b.width, fh: c.height - b.height };
    boxRef.current.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    const d = drag.current;
    if (!d) return;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    setPos({
      x: d.fw > 0 ? clamp(d.ox + (e.clientX - d.sx) / d.fw) : d.ox,
      y: d.fh > 0 ? clamp(d.oy + (e.clientY - d.sy) / d.fh) : d.oy,
    });
  }
  const onUp = () => { drag.current = null; };

  function onKey(e) {
    const step = 0.03;
    const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!m) return;
    e.preventDefault();
    setPos((p) => ({ x: Math.min(1, Math.max(0, p.x + m[0])), y: Math.min(1, Math.max(0, p.y + m[1])) }));
  }

  async function submit() {
    if (!user?.has_signature) return toast('Unggah gambar tanda tangan di menu Profil terlebih dahulu.', 'error');
    if (!file || (!isMock && !docId)) return toast('Pilih berkas dokumen terlebih dahulu.', 'error');
    if (!form.name.trim() || !form.field_of_study.trim()) return toast('Nama dokumen dan bidang studi wajib diisi.', 'error');
    setBusy(true);
    try {
      await docs.sign({ file, docId, ...form, label, page, x: +pos.x.toFixed(4), y: +pos.y.toFixed(4), user });
      toast('Dokumen berhasil ditandatangani. QR Code sudah dibuat.');
      navigate('/dokumen');
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const [fIcon, fColor] = file ? fileIcon(file.name) : [];

  return (
    <>
      <PageHeader title="Tanda Tangani Dokumen" subtitle="Unggah dokumen, isi datanya, lalu tentukan posisi tanda tangan dan QR Code." />

      {!user?.has_signature && (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-status-invalid-container text-on-status-invalid-container px-4 py-3 font-body text-body-sm">
          <Icon name="warning" className="text-title-md shrink-0" fill />
          <span>Anda belum memiliki gambar tanda tangan. <Link to="/profil" className="underline font-medium">Unggah di Profil</Link> sebelum menandatangani.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kiri: data dokumen */}
        <section className="lg:col-span-5 bg-light-surface-container-lowest rounded-md p-6 shadow-[0_4px_16px_rgba(11,79,158,0.06)] flex flex-col gap-5">
          <header className="flex flex-col gap-1 border-b border-light-outline-variant pb-4">
            <h2 className="font-headline text-headline-sm text-light-on-surface">Data Dokumen</h2>
            <p className="font-body text-body-sm text-light-on-surface-variant">Informasi ini akan tersimpan di halaman deskripsi dokumen dan verifikasi QR.</p>
          </header>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Berkas Dokumen</span>
              <label
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer ${dragOver ? 'border-brand-blue bg-light-primary-container/25' : 'border-brand-blue/40 bg-light-surface-container-low hover:border-brand-blue hover:bg-light-primary-container/25'}`}
              >
                <div className="w-11 h-11 rounded-full bg-light-primary-container text-brand-blue flex items-center justify-center">
                  <Icon name="upload_file" className="text-headline-md" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-label-lg text-brand-blue">Seret &amp; lepas file di sini</span>
                  <span className="font-body text-body-sm text-light-on-surface-variant">Mendukung PDF, Word (.doc/.docx), atau gambar (PNG/JPG) — maks. 10 MB</span>
                </div>
                {uploading && <span role="status" className="font-body text-body-sm text-brand-blue">Mengunggah dan memproses dokumen…</span>}
                {file && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-light-surface-container-lowest text-light-on-surface-variant font-body text-body-sm border border-light-outline-variant max-w-full">
                    <Icon name={fIcon} className={`text-label-sm ${fColor}`} />
                    <span className="truncate">{file.name} ({fmtSize(file.size)})</span>
                  </span>
                )}
                <input type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
              {fileError && <span role="alert" className="font-body text-body-sm text-action-red">{fileError}</span>}
              {file && !uploading && extOf(file.name) !== 'pdf' && (
                <span className="font-body text-body-sm text-light-on-surface-variant">File ini sudah diubah ke PDF oleh server untuk ditandatangani.</span>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Nama Dokumen</span>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Masukkan nama dokumen" className={input} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Jenis Dokumen</span>
              <select value={form.type} onChange={set('type')} className={input}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Informasi Tambahan</span>
              <textarea rows={3} value={form.additional_info} onChange={set('additional_info')} placeholder="Catatan atau keterangan tambahan dokumen..." className={input} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Bidang Studi</span>
              <input type="text" value={form.field_of_study} onChange={set('field_of_study')} placeholder="Contoh: Teknik Informatika" className={input} />
            </label>
          </form>
        </section>

        {/* Kanan: posisi tanda tangan */}
        <section className="lg:col-span-7 bg-light-surface-container-lowest rounded-md p-6 shadow-[0_4px_16px_rgba(11,79,158,0.06)] flex flex-col gap-5">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-light-outline-variant pb-4">
            <div>
              <h2 className="font-headline text-headline-sm text-light-on-surface">Posisi Tanda Tangan</h2>
              <p className="font-body text-body-sm text-light-on-surface-variant">Geser kotak tanda tangan dan QR Code ke area yang diinginkan pada halaman.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="font-body text-label-sm text-light-on-surface-variant">Halaman:</span>
              <select aria-label="Pilih halaman" value={page} onChange={(e) => setPage(+e.target.value)} className="rounded border border-light-outline-variant bg-light-surface-container-low px-3 py-1.5 font-body text-body-sm text-light-on-surface tabular-nums focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20">
                {Array.from({ length: pageCount }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} dari {pageCount}</option>)}
              </select>
            </div>
          </header>

          <label className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-light-surface-container-low p-3.5 rounded">
            <span className="font-body text-label-sm text-light-on-surface shrink-0">Label di Atas Tanda Tangan:</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 rounded border border-light-outline-variant bg-light-surface-container-lowest px-3 py-1.5 font-body text-body-md text-light-on-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none" />
          </label>

          <div className="bg-light-surface-container p-4 sm:p-6 rounded-md flex items-center justify-center">
            <div ref={canvasRef} style={{ aspectRatio: previewSrc ? ratio : undefined }} className="relative w-full max-w-md aspect-[3/4] bg-light-surface-container-lowest rounded shadow-md border border-light-outline-variant p-6 flex flex-col justify-between select-none overflow-hidden">
              {previewSrc && (
                <img
                  src={previewSrc} alt={`Pratinjau halaman ${page} dokumen`} draggable={false}
                  onLoad={(e) => setRatio(`${e.currentTarget.naturalWidth} / ${e.currentTarget.naturalHeight}`)}
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                />
              )}
              <div className={`flex flex-col gap-3 ${previewSrc ? 'invisible' : ''}`}>
                <div className="flex items-center justify-between border-b-2 border-brand-blue pb-3">
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-36 bg-brand-blue/25 rounded" />
                    <div className="h-2 w-48 bg-light-surface-container-high rounded" />
                  </div>
                  <div className="w-8 h-8 rounded bg-brand-blue/15" />
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <div className="h-3 w-56 bg-light-surface-container-highest rounded mx-auto" />
                  <div className="h-2 w-full bg-light-surface-container rounded mt-2" />
                  <div className="h-2 w-full bg-light-surface-container rounded" />
                  <div className="h-2 w-4/5 bg-light-surface-container rounded" />
                  <div className="h-2 w-full bg-light-surface-container rounded mt-2" />
                  <div className="h-2 w-11/12 bg-light-surface-container rounded" />
                  <div className="h-2 w-3/4 bg-light-surface-container rounded" />
                </div>
              </div>

              <div
                ref={boxRef} tabIndex={0} role="button"
                aria-label="Kotak tanda tangan dan QR. Geser dengan mouse, jari, atau tombol panah."
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onKeyDown={onKey}
                style={{ position: 'absolute', left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: `translate(-${pos.x * 100}%, -${pos.y * 100}%)`, touchAction: 'none' }}
                className="p-0 rounded cursor-move focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
              <div style={{ width: 224, zoom }} className="p-3 rounded border-2 border-dashed border-brand-blue bg-light-primary-container/25 flex flex-col gap-1.5 cursor-move focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-body text-body-sm font-semibold text-light-on-surface truncate">{label || 'Mengetahui'}</span>
                  <Icon name="open_with" className="text-label-sm text-brand-blue" />
                </div>
                <div className="flex items-center gap-2 bg-light-surface-container-lowest p-1.5 rounded border border-light-outline-variant">
                  <svg viewBox="0 0 36 36" className="w-12 h-12 shrink-0 text-light-on-surface" aria-label="Pratinjau QR Code">
                    <rect width="36" height="36" fill="white" />
                    <path fill="currentColor" d="M2,2 h10 v10 h-10 z M4,4 v6 h6 v-6 z M6,6 h2 v2 h-2 z M24,2 h10 v10 h-10 z M26,4 v6 h6 v-6 z M28,6 h2 v2 h-2 z M2,24 h10 v10 h-10 z M4,26 v6 h6 v-6 z M6,28 h2 v2 h-2 z M14,4 h4 v2 h-4 z M16,8 h4 v4 h-4 z M14,14 h6 v4 h-6 z M22,14 h4 v2 h-4 z M28,14 h6 v4 h-6 z M4,14 h6 v4 h-6 z M14,22 h4 v6 h-4 z M20,20 h6 v4 h-6 z M28,22 h4 v4 h-4 z M22,28 h8 v4 h-8 z M14,30 h4 v4 h-4 z" />
                  </svg>
                  {sigUrl ? (
                    <img src={sigUrl} alt="Pratinjau gambar tanda tangan" draggable={false} className="h-11 w-28 object-contain" />
                  ) : (
                    <span className="h-11 w-28 flex items-center justify-center font-body text-body-sm text-light-on-surface-variant text-center leading-tight">Belum ada tanda tangan</span>
                  )}
                </div>
                <span className="font-body text-body-sm text-light-on-surface-variant truncate">{fullName(user)}</span>
              </div>
              </div>
            </div>
          </div>
          <p className="font-body text-body-sm text-light-on-surface-variant -mt-2">
            Pratinjau ini hanya ilustrasi halaman. Posisi disimpan sebagai persentase halaman, jadi tetap tepat di ukuran kertas apa pun.
          </p>

          <footer className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-light-outline-variant">
            <Link to="/" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-light-surface-container-high text-light-on-surface hover:bg-light-surface-container-highest transition-colors duration-state-change">
              <span className="font-body text-label-lg">Batal</span>
            </Link>
            <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              <Icon name="verified" className="text-title-md" />
              <span className="font-body text-label-lg">{busy ? 'Memproses…' : 'Tanda Tangani Sekarang'}</span>
            </button>
          </footer>
        </section>
      </div>
    </>
  );
}

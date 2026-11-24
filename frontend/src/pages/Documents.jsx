import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { PageHeader } from '../components/Layout';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { docs, verifyUrl } from '../lib/api';
import { dayKey, fmtDateTime } from '../lib/format';

const PAGE_SIZE = 5;
const TYPES = ['Persetujuan KProdi', 'Rekomendasi Dosen', 'Surat Tugas', 'Pengesahan Proposal', 'Surat Keterangan'];

const field =
  'w-full rounded border border-light-outline-variant bg-light-surface-container-lowest px-3 py-2 font-body text-body-md text-light-on-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';
const iconBtn =
  'w-8 h-8 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

const FORMATS = [
  { key: 'pdf', label: 'PDF', icon: 'picture_as_pdf', cls: 'text-action-red' },
  { key: 'png', label: 'Gambar (PNG/JPG)', icon: 'image', cls: 'text-brand-blue' },
  { key: 'docx', label: 'Word (.docx)', icon: 'article', cls: 'text-light-secondary' },
  { key: 'zip', label: 'ZIP (Semua Format)', icon: 'folder_zip', cls: 'text-light-on-surface-variant' },
];

function DownloadMenu({ doc, onPick }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ right: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Menu ditampilkan lewat portal di <body> supaya tidak terpotong oleh tabel yang bisa di-scroll.
  function toggle() {
    if (open) return setOpen(false);
    const r = btnRef.current.getBoundingClientRect();
    const menuH = FORMATS.length * 40 + 12;
    const openUp = r.bottom + menuH > window.innerHeight && r.top > menuH;
    setPos({
      right: Math.max(8, window.innerWidth - r.right),
      ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      close();
    };
    const esc = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef} type="button" onClick={toggle} aria-haspopup="true" aria-expanded={open}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded bg-light-surface-container text-light-on-surface hover:bg-light-primary-container hover:text-light-on-primary-container font-body text-label-sm transition-colors cursor-pointer whitespace-nowrap"
      >
        <Icon name="download" className="text-title-md" />
        <span>Unduh</span>
        <Icon name="expand_more" className="text-label-sm" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef} role="menu" style={{ position: 'fixed', ...pos }}
            className="w-52 rounded-md bg-light-surface-container-lowest shadow-[0_8px_24px_rgba(11,79,158,0.18)] border border-light-outline-variant py-1 z-50"
          >
            {FORMATS.map((f) => (
              <button
                key={f.key} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(doc, f); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 font-body text-body-sm text-light-on-surface hover:bg-light-surface-container-low text-left cursor-pointer"
              >
                <Icon name={f.icon} className={`text-title-md ${f.cls}`} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function QrModal({ doc, onClose }) {
  const toast = useToast();
  const url = doc.verify_url || verifyUrl(doc.token);
  const [img, setImg] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 360, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } }).then(setImg);
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const t = document.createElement('textarea');
      t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    toast('Tautan verifikasi disalin.');
  }

  return (
    <Modal title="QR Code Verifikasi" onClose={onClose}
      footer={
        <>
          <button type="button" onClick={copy} className="inline-flex items-center gap-2 px-4 py-2 rounded border border-brand-blue text-brand-blue hover:bg-light-primary-container/30 font-body text-label-lg cursor-pointer">
            <Icon name="content_copy" className="text-title-md" /> Salin tautan
          </button>
          <a href={img} download={`qr-${doc.token}.png`} className="inline-flex items-center gap-2 px-4 py-2 rounded bg-brand-blue text-light-on-primary hover:bg-accent-blue font-body text-label-lg">
            <Icon name="download" className="text-title-md" /> Unduh PNG
          </a>
        </>
      }
    >
      <p className="font-body text-body-sm text-light-on-surface-variant">{doc.name}</p>
      <div className="self-center rounded-md border border-light-outline-variant p-2 bg-white">
        {img ? <img src={img} alt={`QR Code verifikasi untuk ${doc.name}`} className="w-60 h-60" /> : <div className="w-60 h-60" />}
      </div>
      <p className="font-mono text-mono-sm text-brand-blue text-center break-all">{url}</p>
      <p className="font-body text-body-sm text-light-on-surface-variant text-center">
        Pindai dengan kamera HP apa pun untuk membuka halaman verifikasi.
      </p>
    </Modal>
  );
}

function RevokeModal({ doc, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    setBusy(true);
    try {
      await docs.revoke(doc.id, reason.trim());
      toast('Tanda tangan dicabut.');
      onDone();
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  }

  return (
    <Modal title="Cabut Tanda Tangan" onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded bg-light-surface-container-high text-light-on-surface hover:bg-light-surface-container-highest font-body text-label-lg cursor-pointer">Batal</button>
          <button type="button" disabled={busy} onClick={submit} className="px-5 py-2.5 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container font-body text-label-lg cursor-pointer disabled:opacity-60">
            {busy ? 'Memproses…' : 'Cabut'}
          </button>
        </>
      }
    >
      <p className="font-body text-body-md text-light-on-surface">
        Tanda tangan pada <strong>{doc.name}</strong> akan dicabut. Hasil scan QR akan menampilkan status <strong>Dicabut</strong>. Tindakan ini tidak dapat dibatalkan.
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-body text-label-sm text-light-on-surface">Alasan pencabutan (opsional)</span>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Contoh: Salah penulisan nama" className={`${field} px-3.5 py-2.5`} />
      </label>
    </Modal>
  );
}

export default function Documents() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ type: '', status: '', from: '', to: '', q: '' });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [qrDoc, setQrDoc] = useState(null);
  const [revokeDoc, setRevokeDoc] = useState(null);

  const load = useCallback(() => docs.list().then(setList).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const from = f.from ? +f.from.replaceAll('-', '') : 0;
    const to = f.to ? +f.to.replaceAll('-', '') : Infinity;
    return (list || []).filter((d) => {
      const k = dayKey(d.signed_at);
      return (
        (!f.type || d.type === f.type) &&
        (!f.status || d.status === f.status) &&
        k >= from && k <= to &&
        (!q || d.name.toLowerCase().includes(q) || (d.field_of_study || '').toLowerCase().includes(q))
      );
    });
  }, [list, f]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  const allOnPage = rows.length > 0 && rows.every((d) => selected.has(d.id));
  const toggleAll = () => {
    const n = new Set(selected);
    rows.forEach((d) => (allOnPage ? n.delete(d.id) : n.add(d.id)));
    setSelected(n);
  };
  const toggleOne = (id) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  async function download(doc, fmt) {
    try {
      await docs.download(doc.id, fmt.key, doc.name);
      toast(`Mengunduh ${fmt.label}…`);
    } catch (e) {
      toast(e.message, e.status === 501 ? 'info' : 'error');
    }
  }

  const pageButtons = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => pages <= 7 || p === 1 || p === pages || Math.abs(p - cur) <= 1);

  return (
    <>
      <PageHeader title="Daftar Dokumen" subtitle="Kelola, unduh dokumen bertanda tangan, tampilkan QR, atau cabut tanda tangan." />

      {error && <div role="alert" className="rounded-md bg-light-error-container text-light-on-error-container px-4 py-3 font-body text-body-sm">{error}</div>}

      <section aria-label="Filter dokumen" className="bg-light-surface-container-lowest rounded-md p-5 shadow-[0_4px_16px_rgba(11,79,158,0.06)]">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end" onSubmit={(e) => e.preventDefault()}>
          <label className="lg:col-span-2 flex flex-col gap-1">
            <span className="font-body text-label-sm text-light-on-surface-variant">Jenis Dokumen</span>
            <select value={f.type} onChange={set('type')} className={field}>
              <option value="">Semua Jenis</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="lg:col-span-2 flex flex-col gap-1">
            <span className="font-body text-label-sm text-light-on-surface-variant">Status</span>
            <select value={f.status} onChange={set('status')} className={field}>
              <option value="">Semua Status</option>
              <option value="valid">Valid</option>
              <option value="revoked">Dicabut</option>
              <option value="invalid">Tidak Valid</option>
            </select>
          </label>
          <div className="lg:col-span-4 flex flex-col gap-1">
            <span className="font-body text-label-sm text-light-on-surface-variant">Rentang Tanggal</span>
            <div className="flex items-center gap-2">
              <input type="date" aria-label="Dari tanggal" value={f.from} onChange={set('from')} className={`${field} tabular-nums`} />
              <span className="text-light-on-surface-variant">–</span>
              <input type="date" aria-label="Sampai tanggal" value={f.to} onChange={set('to')} className={`${field} tabular-nums`} />
            </div>
          </div>
          <label className="lg:col-span-3 flex flex-col gap-1">
            <span className="font-body text-label-sm text-light-on-surface-variant">Cari Dokumen</span>
            <div className="relative flex items-center">
              <Icon name="search" className="text-title-md text-light-outline absolute left-3 pointer-events-none" />
              <input type="search" value={f.q} onChange={set('q')} placeholder="Nama dokumen atau bidang..." className={`${field} pl-9 pr-3`} />
            </div>
          </label>
          <div className="lg:col-span-1">
            <button type="button" onClick={() => { setF({ type: '', status: '', from: '', to: '', q: '' }); setPage(1); }} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-sm cursor-pointer">
              <span className="font-body text-label-lg">Reset</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-light-surface-container-lowest rounded-md shadow-[0_4px_16px_rgba(11,79,158,0.06)] flex flex-col">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-light-outline-variant bg-light-surface-container-low">
                <th scope="col" className="py-3.5 px-4 w-10">
                  <input type="checkbox" aria-label="Pilih semua dokumen" checked={allOnPage} onChange={toggleAll} className="rounded border-light-outline text-brand-blue focus:ring-brand-blue" />
                </th>
                <th scope="col" className="py-3.5 px-3 font-body text-label-sm text-light-on-surface-variant">No</th>
                {['Nama Dokumen', 'Jenis Dokumen', 'Bidang Studi', 'Waktu Tanda Tangan'].map((h) => (
                  <th key={h} scope="col" className="py-3.5 px-4 font-body text-label-sm text-light-on-surface-variant whitespace-nowrap">{h}</th>
                ))}
                <th scope="col" className="py-3.5 px-4 font-body text-label-sm text-light-on-surface-variant">Status</th>
                <th scope="col" className="py-3.5 px-4 font-body text-label-sm text-light-on-surface-variant text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-outline-variant">
              {rows.map((d, i) => (
                <tr key={d.id} className="hover:bg-light-surface-container-low transition-colors duration-state-change">
                  <td className="py-3.5 px-4">
                    <input type="checkbox" aria-label={`Pilih dokumen ${(cur - 1) * PAGE_SIZE + i + 1}`} checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} className="rounded border-light-outline text-brand-blue focus:ring-brand-blue" />
                  </td>
                  <td className="py-3.5 px-3 font-body text-body-md tabular-nums text-light-on-surface-variant">{(cur - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="py-3.5 px-4 font-body text-body-md font-medium text-light-on-surface">{d.name}</td>
                  <td className="py-3.5 px-4 font-body text-body-md text-light-on-surface-variant">{d.type}</td>
                  <td className="py-3.5 px-4 font-body text-body-md text-light-on-surface-variant">{d.field_of_study}</td>
                  <td className="py-3.5 px-4 font-body text-body-md text-light-on-surface-variant tabular-nums whitespace-nowrap">{fmtDateTime(d.signed_at)}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={d.status} /></td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <a href={`/verify/${d.token}`} target="_blank" rel="noreferrer" aria-label="Lihat halaman verifikasi" title="Lihat" className={`${iconBtn} bg-light-surface-container text-light-on-surface-variant hover:bg-light-primary-container hover:text-light-on-primary-container`}>
                        <Icon name="visibility" className="text-title-md" />
                      </a>
                      <DownloadMenu doc={d} onPick={download} />
                      <button type="button" aria-label="Tampilkan QR" title="Tampilkan QR" onClick={() => setQrDoc(d)} className={`${iconBtn} bg-light-primary-container text-light-on-primary-container hover:bg-brand-blue hover:text-light-on-primary`}>
                        <Icon name="qr_code_2" className="text-title-md" />
                      </button>
                      <button type="button" aria-label="Cabut tanda tangan" title="Cabut" disabled={d.status === 'revoked'} onClick={() => setRevokeDoc(d)} className={`${iconBtn} bg-status-revoked-container text-on-status-revoked-container hover:bg-action-red hover:text-on-action-red`}>
                        <Icon name="block" className="text-title-md" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list && rows.length === 0 && (
                <tr><td colSpan={9} className="py-10 px-4 text-center font-body text-body-sm text-light-on-surface-variant">
                  {list.length === 0 ? 'Belum ada dokumen. Mulai dari menu “Tanda Tangani”.' : 'Tidak ada dokumen yang cocok dengan filter.'}
                </td></tr>
              )}
              {!list && !error && (
                <tr><td colSpan={9} className="py-10 px-4 text-center font-body text-body-sm text-light-on-surface-variant">Memuat dokumen…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-light-outline-variant bg-light-surface-container-low">
          <p className="font-body text-body-sm text-light-on-surface-variant tabular-nums">
            {filtered.length === 0 ? 'Tidak ada dokumen' : `Menampilkan ${(cur - 1) * PAGE_SIZE + 1}–${(cur - 1) * PAGE_SIZE + rows.length} dari ${filtered.length} dokumen`}
            {selected.size > 0 && ` • ${selected.size} dipilih`}
          </p>
          <nav aria-label="Navigasi halaman" className="flex items-center gap-1.5">
            <button type="button" aria-label="Halaman sebelumnya" disabled={cur === 1} onClick={() => setPage(cur - 1)} className="w-8 h-8 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface-variant hover:bg-light-surface-container flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Icon name="chevron_left" className="text-title-md" />
            </button>
            {pageButtons.map((p, idx) => (
              <span key={p} className="flex items-center gap-1.5">
                {idx > 0 && p - pageButtons[idx - 1] > 1 && <span className="px-1 font-body text-body-sm text-light-on-surface-variant">...</span>}
                <button type="button" aria-current={p === cur ? 'page' : undefined} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded font-body text-label-sm tabular-nums cursor-pointer ${p === cur ? 'bg-brand-blue text-light-on-primary' : 'border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface hover:bg-light-surface-container'}`}>
                  {p}
                </button>
              </span>
            ))}
            <button type="button" aria-label="Halaman berikutnya" disabled={cur === pages} onClick={() => setPage(cur + 1)} className="w-8 h-8 rounded border border-light-outline-variant bg-light-surface-container-lowest text-light-on-surface-variant hover:bg-light-surface-container flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Icon name="chevron_right" className="text-title-md" />
            </button>
          </nav>
        </footer>
      </section>

      {qrDoc && <QrModal doc={qrDoc} onClose={() => setQrDoc(null)} />}
      {revokeDoc && <RevokeModal doc={revokeDoc} onClose={() => setRevokeDoc(null)} onDone={() => { setRevokeDoc(null); load(); }} />}
    </>
  );
}

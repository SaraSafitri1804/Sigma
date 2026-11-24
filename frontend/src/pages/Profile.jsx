import { useEffect, useState } from 'react';
import { PageHeader, Avatar } from '../components/Layout';
import Icon from '../components/Icon';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/api';
import { fullName } from '../lib/format';

const input =
  'w-full rounded border border-light-outline-variant bg-light-surface-container-lowest px-3.5 py-2.5 font-body text-body-md text-light-on-surface focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: user.full_name, title: user.title || '', position: user.position || '' });
  const [saving, setSaving] = useState(false);
  const [sigUrl, setSigUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadSig = () => {
    if (!user.has_signature) return setSigUrl('');
    auth.signatureUrl().then((u) => setSigUrl((old) => { old && URL.revokeObjectURL(old); return u; })).catch(() => setSigUrl(''));
  };
  useEffect(loadSig, [user.has_signature]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    if (!form.full_name.trim()) return toast('Nama lengkap wajib diisi.', 'error');
    setSaving(true);
    try {
      await auth.updateMe(form);
      await refresh();
      toast('Perubahan profil disimpan.');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function onSignature(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast('Gambar harus berformat PNG atau JPG.', 'error');
    if (file.size > 2 * 1024 * 1024) return toast('Ukuran gambar maksimal 2 MB.', 'error');
    setUploading(true);
    try {
      await auth.uploadSignature(file);
      await refresh();
      loadSig();
      toast('Tanda tangan diperbarui.');
    } catch (err) {
      toast(err.message, 'error');
    } finally { setUploading(false); }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const card = 'bg-light-surface-container-lowest rounded-md p-6 shadow-[0_4px_16px_rgba(11,79,158,0.06)]';

  return (
    <>
      <PageHeader title="Profil" subtitle="Kelola identitas dan gambar tanda tangan Anda." />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className={`lg:col-span-7 ${card} flex flex-col gap-6`}>
          <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-light-outline-variant">
            <Avatar user={user} className="w-20 h-20 text-headline-md" />
            <div className="flex flex-col text-center sm:text-left gap-1">
              <h2 className="font-headline text-headline-md text-light-on-surface">{fullName(user)}</h2>
              <p className="font-body text-body-md text-brand-blue font-medium">{user.position || 'Jabatan belum diisi'}</p>
              <p className="font-body text-body-sm text-light-on-surface-variant">Nama, gelar, dan jabatan ini tampil pada halaman verifikasi publik.</p>
            </div>
          </div>
          <form onSubmit={save} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Nama Lengkap</span>
              <input value={form.full_name} onChange={set('full_name')} className={input} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-label-sm text-light-on-surface">Gelar</span>
                <input value={form.title} onChange={set('title')} placeholder="S.Kom., M.T.I." className={input} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-body text-label-sm text-light-on-surface">Jabatan</span>
                <input value={form.position} onChange={set('position')} placeholder="Kaprodi" className={input} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="font-body text-label-sm text-light-on-surface">Email</span>
              <input type="email" value={user.email} readOnly className={`${input} bg-light-surface-container-low text-light-on-surface-variant`} />
            </label>
            <footer className="flex justify-end pt-3 border-t border-light-outline-variant">
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-sm cursor-pointer disabled:opacity-60">
                <span className="font-body text-label-lg">{saving ? 'Menyimpan…' : 'Simpan Perubahan'}</span>
              </button>
            </footer>
          </form>
        </section>

        <section className={`lg:col-span-5 ${card} flex flex-col gap-5`}>
          <header className="flex flex-col gap-1 border-b border-light-outline-variant pb-4">
            <h2 className="font-headline text-headline-sm text-light-on-surface">Tanda Tangan Saya</h2>
            <p className="font-body text-body-sm text-light-on-surface-variant">Gambar ini ditempelkan otomatis bersama QR Code saat menandatangani dokumen.</p>
          </header>
          <div className="rounded-md border border-light-outline-variant bg-light-surface-container-low p-6 flex flex-col items-center justify-center gap-3">
            {sigUrl ? (
              <img src={sigUrl} alt={`Pratinjau tanda tangan ${user.full_name}`} className="w-full max-w-xs h-36 object-contain rounded bg-light-surface-container-lowest p-3 border border-light-outline-variant" />
            ) : (
              <div className="w-full max-w-xs h-36 rounded bg-light-surface-container-lowest border border-dashed border-light-outline flex flex-col items-center justify-center gap-1 text-light-on-surface-variant">
                <Icon name="draw" className="text-headline-md" />
                <span className="font-body text-body-sm">Belum ada tanda tangan</span>
              </div>
            )}
            <span className="font-body text-body-sm text-light-on-surface-variant">Format PNG/JPG transparan, maksimal 2 MB</span>
          </div>
          <label className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded border border-brand-blue text-brand-blue hover:bg-light-primary-container/30 transition-colors duration-state-change cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Icon name="upload" className="text-title-md" />
            <span className="font-body text-label-lg">{uploading ? 'Mengunggah…' : user.has_signature ? 'Ganti Tanda Tangan' : 'Unggah Tanda Tangan'}</span>
            <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={onSignature} />
          </label>
        </section>
      </div>
    </>
  );
}

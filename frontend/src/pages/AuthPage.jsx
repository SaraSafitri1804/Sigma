import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import illustration from '../assets/login-illustration.png';

const inputBase =
  'w-full rounded border-0 bg-light-surface-container-lowest font-body text-body-md text-light-on-surface placeholder:text-light-outline focus:ring-2 focus:ring-light-secondary-container focus:outline-none';
const btnRed =
  'w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

export default function AuthPage({ initialMode = 'login' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sigName, setSigName] = useState('');

  const isLogin = mode === 'login';
  const switchTo = (m) => { setMode(m); setError(''); };

  async function onLogin(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try {
      await login(f.get('email'), f.get('password'));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  async function onRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sig = fd.get('signature');
    if (sig && sig.size === 0) fd.delete('signature');
    if (sig && sig.size > 2 * 1024 * 1024) { setError('Gambar tanda tangan maksimal 2 MB.'); return; }
    setBusy(true); setError('');
    try {
      await register(fd);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  const tab = (active) =>
    `px-4 py-1.5 rounded-full font-body text-label-sm transition-colors duration-state-change cursor-pointer ${
      active ? 'bg-light-surface-container-lowest text-brand-blue' : 'text-light-on-primary hover:bg-light-on-primary/10'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <main className="w-full max-w-5xl bg-light-surface-container-lowest rounded-lg shadow-[0_12px_40px_rgba(11,79,158,0.10)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Kiri: kartu biru + form */}
        <section className="lg:col-span-5 bg-brand-blue text-light-on-primary p-8 md:p-10 relative overflow-hidden flex flex-col justify-between">
          <svg aria-hidden="true" className="absolute inset-0 w-full h-full opacity-10 pointer-events-none" viewBox="0 0 400 600" preserveAspectRatio="none">
            <path d="M0,120 C120,180 280,60 400,140 L400,0 L0,0 Z" fill="currentColor" />
            <path d="M0,460 C140,390 260,520 400,440 L400,600 L0,600 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="inline-flex self-start p-1 rounded-full border border-light-on-primary/30" role="tablist">
              <button type="button" role="tab" aria-selected={isLogin} onClick={() => switchTo('login')} className={tab(isLogin)}>Masuk</button>
              <button type="button" role="tab" aria-selected={!isLogin} onClick={() => switchTo('register')} className={tab(!isLogin)}>Daftar</button>
            </div>

            <header className="flex flex-col gap-2">
              <h1 className="font-headline text-headline-lg text-light-on-primary text-balance">
                {isLogin ? 'Selamat Datang di SIGMA' : 'Buat Akun Penanda Tangan'}
              </h1>
              <p className="font-body text-body-md text-light-on-primary text-pretty">
                {isLogin ? 'Tanda tangan digital yang aman dengan QR Code' : 'Daftarkan identitas dan gambar tanda tangan Anda'}
              </p>
            </header>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded bg-light-error-container text-light-on-error-container px-3.5 py-2.5 font-body text-body-sm">
                <Icon name="error" className="text-title-md shrink-0" fill />
                <span>{error}</span>
              </div>
            )}

            {isLogin ? (
              <form onSubmit={onLogin} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-label-sm text-light-on-primary">Email</span>
                  <div className="relative flex items-center">
                    <Icon name="mail" className="text-title-md text-light-on-surface-variant absolute left-3.5 pointer-events-none" />
                    <input name="email" type="email" required autoComplete="email" placeholder="nama@kampus.ac.id" className={`${inputBase} pl-10 pr-3.5 py-2.5`} />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-body text-label-sm text-light-on-primary">Password</span>
                  <div className="relative flex items-center">
                    <Icon name="lock" className="text-title-md text-light-on-surface-variant absolute left-3.5 pointer-events-none" />
                    <input name="password" type="password" required autoComplete="current-password" placeholder="Masukkan kata sandi" className={`${inputBase} pl-10 pr-3.5 py-2.5`} />
                  </div>
                </label>
                <div className="pt-2 flex flex-col gap-4">
                  <button type="submit" disabled={busy} className={btnRed}>
                    <span className="font-body text-label-lg">{busy ? 'Memproses…' : 'Masuk'}</span>
                  </button>
                  <p className="font-body text-body-sm text-light-on-primary text-center">
                    Belum punya akun?{' '}
                    <button type="button" onClick={() => switchTo('register')} className="font-body text-label-sm underline underline-offset-4 hover:text-light-primary-container cursor-pointer">Daftar</button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={onRegister} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-body text-label-sm text-light-on-primary/90">Nama Lengkap</span>
                  <input name="full_name" required placeholder="Contoh: Andi Aljabar" className={`${inputBase} px-3.5 py-2`} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="font-body text-label-sm text-light-on-primary/90">Gelar</span>
                    <input name="title" placeholder="S.Kom., M.T.I." className={`${inputBase} px-3.5 py-2`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-body text-label-sm text-light-on-primary/90">Jabatan</span>
                    <input name="position" placeholder="Kaprodi" className={`${inputBase} px-3.5 py-2`} />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="font-body text-label-sm text-light-on-primary/90">Email</span>
                  <input name="email" type="email" required autoComplete="email" placeholder="nama@kampus.ac.id" className={`${inputBase} px-3.5 py-2`} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-body text-label-sm text-light-on-primary/90">Password</span>
                  <input name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="Minimal 6 karakter" className={`${inputBase} px-3.5 py-2`} />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="font-body text-label-sm text-light-on-primary/90">Unggah Gambar Tanda Tangan (PNG/JPG)</span>
                  <label className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-light-on-primary/50 bg-light-on-primary/10 px-4 py-3 text-center hover:bg-light-on-primary/15 transition-colors cursor-pointer">
                    <Icon name="upload_file" className="text-title-md text-light-on-primary" />
                    <span className="font-body text-body-sm text-light-on-primary/90">{sigName || 'Pilih berkas PNG/JPG (maks. 2 MB)'}</span>
                    <input name="signature" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => setSigName(e.target.files?.[0]?.name || '')} />
                  </label>
                </div>
                <div className="pt-2 flex flex-col gap-3">
                  <button type="submit" disabled={busy} className={btnRed.replace('py-3', 'py-2.5')}>
                    <span className="font-body text-label-lg">{busy ? 'Memproses…' : 'Daftar Sekarang'}</span>
                  </button>
                  <p className="font-body text-body-sm text-light-on-primary/85 text-center">
                    Sudah punya akun?{' '}
                    <button type="button" onClick={() => switchTo('login')} className="font-body text-label-sm text-light-on-primary underline underline-offset-4 hover:text-light-primary-container cursor-pointer">Masuk</button>
                  </p>
                </div>
              </form>
            )}
          </div>

          <footer className="relative z-10 pt-6 border-t border-light-on-primary/20 mt-6">
            <p className="font-body text-body-sm text-light-on-primary">Dilindungi enkripsi SHA-256 dan verifikasi QR publik.</p>
          </footer>
        </section>

        {/* Kanan: merek + ilustrasi */}
        <section className="lg:col-span-7 bg-light-surface-container-lowest p-8 md:p-12 flex flex-col items-center justify-between gap-8 text-center">
          <div className="flex items-center gap-3 self-center lg:self-end">
            <div className="w-10 h-10 rounded-md bg-brand-blue text-light-on-primary flex items-center justify-center shadow-sm">
              <Icon name="qr_code_scanner" className="text-headline-md" />
            </div>
            <div className="text-left">
              <p className="font-headline text-headline-sm text-brand-blue leading-none">SIGMA</p>
              <p className="font-body text-body-sm text-light-on-surface-variant">Sistem Tanda Tangan Digital</p>
            </div>
          </div>
          <div className="w-full max-w-md flex flex-col items-center gap-4">
            <img src={illustration} alt="Ilustrasi isometrik laptop menampilkan dokumen dengan tanda tangan digital dan QR Code" className="w-full h-auto max-h-72 object-contain rounded-md" />
          </div>
          <div className="flex flex-col items-center gap-2 max-w-md">
            <h2 className="font-headline text-headline-lg text-brand-blue tracking-wide text-balance">SIGMA</h2>
            <p className="font-body text-title-md text-light-on-surface text-balance">Tanda Tangan Digital Anti Penyalahgunaan</p>
            <p className="font-body text-body-sm text-light-on-surface-variant text-pretty">
              Setiap tanda tangan dikunci ke satu dokumen tertentu melalui QR Code unik dan hash SHA-256 yang dapat diverifikasi siapa saja.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

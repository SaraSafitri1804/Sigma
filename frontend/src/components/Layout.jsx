import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fmtClock, fullName, initials } from '../lib/format';
import Icon from './Icon';
import { useToast } from './Toast';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/dokumen', label: 'Dokumen', icon: 'description' },
  { to: '/tanda-tangani', label: 'Tanda Tangani', icon: 'draw' },
  { to: '/profil', label: 'Profil', icon: 'person' },
];

const linkBase = 'flex items-center gap-3 px-4 py-2.5 rounded-full transition-colors duration-state-change';

function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {open && <div className="md:hidden fixed inset-0 z-30 bg-light-on-surface/50" onClick={onClose} />}
      <aside
        className={`${open ? 'flex fixed inset-y-0 left-0' : 'hidden'} md:flex md:sticky md:top-0 md:h-screen w-64 shrink-0 bg-brand-blue text-light-on-primary flex-col justify-between p-5 z-40`}
      >
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-md bg-light-on-primary/15 flex items-center justify-center shrink-0">
              <Icon name="qr_code_scanner" className="text-headline-md text-light-on-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline text-headline-sm text-light-on-primary leading-tight">SIGMA</span>
              <span className="font-body text-body-sm text-light-on-primary/75">Tanda Tangan Digital</span>
            </div>
          </div>
          <nav aria-label="Menu utama" className="flex flex-col gap-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to} to={n.to} end={n.end} onClick={onClose}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? 'bg-light-surface-container-lowest text-brand-blue shadow-sm' : 'text-light-on-primary/85 hover:bg-light-on-primary/10'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={n.icon} className="text-title-md" fill={isActive} />
                    <span className="font-body text-label-lg">{n.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="pt-4 border-t border-light-on-primary/15">
          <button type="button" onClick={doLogout} className={`${linkBase} w-full text-light-on-primary/85 hover:bg-light-on-primary/10 cursor-pointer`}>
            <Icon name="logout" className="text-title-md" />
            <span className="font-body text-label-lg">Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Avatar({ user, className = 'w-9 h-9' }) {
  return (
    <span className={`${className} rounded-full bg-brand-blue text-light-on-primary flex items-center justify-center font-headline text-label-lg shrink-0`} aria-hidden="true">
      {initials(user?.full_name)}
    </span>
  );
}
export { Avatar };

export function PageHeader({ title, subtitle }) {
  const { user } = useAuth();
  const toast = useToast();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-headline text-headline-lg text-light-on-surface">{title}</h1>
        {subtitle && <p className="font-body text-body-md text-light-on-surface-variant">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4 self-start sm:self-auto">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-light-surface-container-lowest shadow-sm">
          <Icon name="schedule" className="text-title-md text-brand-blue" />
          <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">{fmtClock(now)}</span>
        </div>
        <button
          type="button" aria-label="Notifikasi" onClick={() => toast('Belum ada notifikasi baru.', 'info')}
          className="relative w-10 h-10 rounded-full bg-light-surface-container-lowest shadow-sm flex items-center justify-center text-light-on-surface-variant hover:text-brand-blue transition-colors cursor-pointer"
        >
          <Icon name="notifications" className="text-title-md" />
        </button>
        <div className="flex items-center gap-3 bg-light-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm" title={fullName(user)}>
          <Avatar user={user} />
          <div className="hidden lg:flex flex-col pr-1">
            <span className="font-body text-label-sm text-light-on-surface">{user?.full_name}</span>
            <span className="font-body text-body-sm text-light-on-surface-variant">{user?.position || 'Penanda tangan'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between bg-brand-blue text-light-on-primary px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpen(true)} aria-label="Buka menu navigasi" className="p-1.5 rounded hover:bg-light-on-primary/10 cursor-pointer">
            <Icon name="menu" className="text-headline-md" />
          </button>
          <div className="flex items-center gap-2">
            <Icon name="qr_code_scanner" className="text-headline-md" />
            <span className="font-headline text-headline-sm">SIGMA</span>
          </div>
        </div>
        <span className="w-8 h-8 rounded-full bg-light-on-primary/20 border border-light-on-primary/40 flex items-center justify-center font-headline text-label-sm">{initials(user?.full_name)}</span>
      </div>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

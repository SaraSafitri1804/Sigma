import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Layout';
import Icon from '../components/Icon';
import Donut from '../components/Donut';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { docs } from '../lib/api';
import { fmtDateTime, fullName, isThisMonth, pct, relativeLabel } from '../lib/format';

const card = 'bg-light-surface-container-lowest rounded-md shadow-[0_4px_16px_rgba(11,79,158,0.06)]';
const ACT = {
  sign: { icon: 'draw', cls: 'bg-light-primary-container text-light-on-primary-container' },
  scan: { icon: 'qr_code_scanner', cls: 'bg-light-primary-container text-light-on-primary-container' },
  revoke: { icon: 'cancel', cls: 'bg-status-revoked-container text-on-status-revoked-container' },
};
const TYPE_COLORS = ['#0B4F9E', '#1E7BD8', '#15803D', '#D71920'];
const TYPE_TEXT = ['text-brand-blue', 'text-light-secondary', 'text-status-valid', 'text-action-red'];

export default function Dashboard() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([docs.list(), docs.activity()])
      .then(([l, a]) => { setList(l); setActivity(a); })
      .catch((e) => setError(e.message));
  }, []);

  const s = useMemo(() => {
    const l = list || [];
    const valid = l.filter((d) => d.status === 'valid').length;
    const revoked = l.filter((d) => d.status === 'revoked').length;
    const invalid = l.filter((d) => d.status === 'invalid').length;
    const byType = {};
    l.forEach((d) => { byType[d.type] = (byType[d.type] || 0) + 1; });
    const types = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return {
      total: l.length, valid, revoked, invalid,
      month: l.filter((d) => isThisMonth(d.signed_at)).length,
      validPct: l.length ? (valid / l.length) * 100 : 0,
      types,
    };
  }, [list]);

  const stat = (label, value, icon, wrap, iconWrap, textCls = '') => (
    <article className={`${wrap} rounded-md p-5 flex items-center gap-4 h-full`}>
      <div className={`w-12 h-12 rounded-md flex items-center justify-center shrink-0 ${iconWrap}`}>
        <Icon name={icon} className="text-headline-md" />
      </div>
      <div className="flex flex-col">
        <span className={`font-body text-label-sm ${textCls}`}>{label}</span>
        <span className={`font-headline text-headline-lg tabular-nums ${textCls}`}>{list ? value : '–'}</span>
      </div>
    </article>
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Halo, ${fullName(user)}`} />

      {error && <div role="alert" className="rounded-md bg-light-error-container text-light-on-error-container px-4 py-3 font-body text-body-sm">{error}</div>}

      <section aria-label="Statistik dokumen" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        {stat('Total Dokumen', s.total, 'description', 'bg-action-red text-on-action-red shadow-[0_4px_16px_rgba(215,25,32,0.18)]', 'bg-on-action-red/15', 'text-on-action-red')}
        {stat('Tanda Tangan Valid', s.valid, 'verified', 'bg-brand-blue text-light-on-primary shadow-[0_4px_16px_rgba(11,79,158,0.16)]', 'bg-light-on-primary/15', 'text-light-on-primary')}
        {stat('Dicabut', s.revoked, 'block', 'bg-light-secondary text-light-on-secondary shadow-[0_4px_16px_rgba(0,95,174,0.16)]', 'bg-light-on-secondary/15', 'text-light-on-secondary')}
        {stat('Bulan Ini', s.month, 'calendar_month', 'bg-light-surface-container-highest text-light-on-surface shadow-[0_4px_16px_rgba(11,79,158,0.06)]', 'bg-light-surface-container-lowest text-brand-blue', 'text-light-on-surface')}
      </section>

      <section className={`${card} px-6 py-4 flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-4">
          <span className="font-body text-label-lg text-light-on-surface">Persentase Dokumen Valid</span>
          <span className="font-headline text-headline-sm text-brand-blue tabular-nums">{pct(s.valid, s.total)}%</span>
        </div>
        <div className="w-full h-3 rounded-full bg-light-surface-container-high overflow-hidden" role="progressbar" aria-valuenow={Math.round(s.validPct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Persentase dokumen valid ${pct(s.valid, s.total)} persen`}>
          <div className="h-full rounded-full bg-brand-blue" style={{ width: `${s.validPct}%` }} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <article className={`${card} p-6 flex flex-col justify-between gap-4`}>
            <header className="flex flex-col gap-1">
              <h2 className="font-headline text-headline-sm text-light-on-surface">Persentase Valid vs Dicabut</h2>
              <p className="font-body text-body-sm text-light-on-surface-variant">Distribusi keabsahan seluruh dokumen yang ditandatangani</p>
            </header>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <Donut
                  total={s.total} track="#FEE2E2" label={`Grafik donat: ${pct(s.valid, s.total, 0)} persen valid`}
                  segments={[{ value: s.valid, color: '#0B4F9E' }, { value: s.revoked, color: '#D71920' }, { value: s.invalid, color: '#C2410C' }]}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-headline text-headline-md text-brand-blue tabular-nums">{pct(s.valid, s.total)}%</span>
                  <span className="font-body text-body-sm text-light-on-surface-variant">Valid</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full sm:w-auto">
                {[
                  ['Valid', s.valid, 'bg-brand-blue', 'text-brand-blue'],
                  ['Dicabut', s.revoked, 'bg-action-red', 'text-action-red'],
                  ...(s.invalid ? [['Tidak Valid', s.invalid, 'bg-status-invalid', 'text-status-invalid']] : []),
                ].map(([label, n, dot, txt]) => (
                  <div key={label} className="flex items-center justify-between gap-4 p-3 rounded bg-light-surface-container-low">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${dot} shrink-0`} />
                      <span className="font-body text-body-md text-light-on-surface">{label}</span>
                    </div>
                    <span className={`font-body text-label-lg tabular-nums ${txt}`}>{n} ({pct(n, s.total)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={`${card} p-6 flex flex-col justify-between gap-4`}>
            <header className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-headline text-headline-sm text-light-on-surface">Aktivitas Terbaru</h2>
                <p className="font-body text-body-sm text-light-on-surface-variant">Riwayat penandatanganan, pemindaian QR, dan pencabutan</p>
              </div>
              <Link to="/dokumen" className="font-body text-label-sm text-brand-blue hover:underline shrink-0">Lihat semua</Link>
            </header>
            {activity.length === 0 ? (
              <p className="font-body text-body-sm text-light-on-surface-variant py-4">Belum ada aktivitas. Tanda tangani dokumen pertama Anda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-light-outline-variant">
                {activity.map((a) => {
                  const m = ACT[a.kind] || ACT.sign;
                  return (
                    <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.cls}`}>
                          <Icon name={m.icon} className="text-title-md" />
                        </span>
                        <div className="flex flex-col">
                          <span className="font-body text-body-md font-medium text-light-on-surface">{a.title}</span>
                          <span className="font-body text-body-sm text-light-on-surface-variant">{a.detail}</span>
                        </div>
                      </div>
                      <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums shrink-0">{relativeLabel(a.at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </div>

        <aside className={`lg:col-span-4 ${card} p-6 flex flex-col gap-4 h-full`}>
          <header className="flex flex-col gap-1">
            <h2 className="font-headline text-headline-sm text-light-on-surface">Indikator Umum</h2>
            <p className="font-body text-body-sm text-light-on-surface-variant">Proporsi jenis dokumen yang ditandatangani</p>
          </header>
          <div className="flex flex-col gap-3">
            {s.types.length === 0 && <p className="font-body text-body-sm text-light-on-surface-variant">Belum ada data.</p>}
            {s.types.map(([type, n], i) => (
              <div key={type} className="flex items-center gap-3 p-3.5 rounded-md bg-light-surface-container-low">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <Donut size={48} r={18} stroke={5} total={s.total} segments={[{ value: n, color: TYPE_COLORS[i] }]} />
                  <span className={`absolute font-body text-label-sm tabular-nums ${TYPE_TEXT[i]}`}>{pct(n, s.total, 0)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-body text-label-sm text-light-on-surface">{type}</span>
                  <span className="font-body text-body-sm text-light-on-surface-variant tabular-nums">{n} dokumen</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className={`${card} p-6 flex flex-col gap-4`}>
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-headline-sm text-light-on-surface">Dokumen Terbaru</h2>
            <p className="font-body text-body-sm text-light-on-surface-variant">Daftar dokumen terakhir yang diproses melalui sistem SIGMA</p>
          </div>
          <Link to="/tanda-tangani" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-action-red text-on-action-red hover:bg-light-tertiary-container hover:text-light-on-tertiary-container transition-colors duration-state-change shadow-sm self-start sm:self-auto">
            <Icon name="draw" className="text-title-md" />
            <span className="font-body text-label-lg">Tanda Tangani Dokumen Baru</span>
          </Link>
        </header>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-light-outline-variant bg-light-surface-container-low">
                {['Nama Dokumen', 'Jenis', 'Waktu', 'Status'].map((h) => (
                  <th key={h} scope="col" className="py-3.5 px-4 font-body text-label-sm text-light-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-light-outline-variant">
              {(list || []).slice(0, 4).map((d) => (
                <tr key={d.id} className="hover:bg-light-surface-container-low transition-colors duration-state-change">
                  <td className="py-3.5 px-4 font-body text-body-md font-medium text-light-on-surface">{d.name}</td>
                  <td className="py-3.5 px-4 font-body text-body-md text-light-on-surface-variant">{d.type}</td>
                  <td className="py-3.5 px-4 font-body text-body-md text-light-on-surface-variant tabular-nums whitespace-nowrap">{fmtDateTime(d.signed_at)}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={d.status} /></td>
                </tr>
              ))}
              {list && list.length === 0 && (
                <tr><td colSpan={4} className="py-8 px-4 text-center font-body text-body-sm text-light-on-surface-variant">Belum ada dokumen. Klik “Tanda Tangani Dokumen Baru” untuk memulai.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

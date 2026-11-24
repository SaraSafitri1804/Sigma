const TZ = 'Asia/Jakarta';

const pad = (n) => String(n).padStart(2, '0');

// Ambil bagian tanggal/jam dalam zona WIB, terlepas dari zona waktu komputer.
function parts(iso) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour === '24' ? '00' : p.hour, mm: p.minute };
}

const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MON_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function fmtDateTime(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${pad(p.d)} ${MON_SHORT[p.m - 1]} ${p.y}, ${p.hh}:${p.mm}`;
}

export function fmtLong(iso) {
  if (!iso) return '-';
  const p = parts(iso);
  return `${p.d} ${MON_LONG[p.m - 1]} ${p.y}, ${p.hh}:${p.mm} WIB`;
}

export function fmtClock(date = new Date()) {
  const p = parts(date.toISOString());
  return `${pad(p.d)} ${MON_SHORT[p.m - 1]} ${p.y} • ${p.hh}:${p.mm} WIB`;
}

export function dayKey(iso) {
  const p = parts(iso);
  return p.y * 10000 + p.m * 100 + p.d;
}

export function isThisMonth(iso, now = new Date()) {
  const a = parts(iso);
  const b = parts(now.toISOString());
  return a.y === b.y && a.m === b.m;
}

// "09:45 WIB" untuk hari ini, "Kemarin", atau tanggal.
export function relativeLabel(iso, now = new Date()) {
  const a = dayKey(iso);
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86400000).toISOString());
  const p = parts(iso);
  if (a === today) return `${p.hh}:${p.mm} WIB`;
  if (a === yesterday) return 'Kemarin';
  return `${pad(p.d)} ${MON_SHORT[p.m - 1]} ${p.y}`;
}

export function fullName(user) {
  if (!user) return '';
  return user.title ? `${user.full_name}, ${user.title}` : user.full_name;
}

export function initials(name = '') {
  const w = name.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '?';
}

export function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function pct(part, total, digits = 1) {
  if (!total) return '0';
  return ((part / total) * 100).toFixed(digits).replace('.', ',');
}

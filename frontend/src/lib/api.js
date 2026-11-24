import * as store from './mockStore';

const BASE = import.meta.env.VITE_API_URL || '';
// true = Dokumen/Tanda Tangan/Verifikasi memakai data contoh di browser (tanpa backend Tahap 2-4).
// Bawaan: false -> memakai API sungguhan lewat Gateway.
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const isMock = USE_MOCK;
export const publicUrl = () =>
  (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
export const verifyUrl = (token) => `${publicUrl()}/verify/${token}`;

/* ---------------------------------------------------------------- token */
const TOKEN_KEY = 'sigma_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, json, raw = false, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Pastikan backend (npm run dev) sudah jalan.', 0);
  }

  if (res.status === 401 && token && auth) {
    clearToken();
    window.dispatchEvent(new Event('sigma:unauthorized'));
  }
  if (raw) {
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new ApiError(d?.message || 'Terjadi kesalahan', res.status);
    }
    return res;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || 'Terjadi kesalahan', res.status);
  return data;
}

/* ----------------------------------------------------------------- auth (selalu API sungguhan) */
export const auth = {
  async login(email, password) {
    const d = await request('/api/auth/login', { method: 'POST', json: { email, password }, auth: false });
    setToken(d.token);
    return d.user;
  },
  async register(formData) {
    const d = await request('/api/auth/register', { method: 'POST', body: formData, auth: false });
    setToken(d.token);
    return d.user;
  },
  me: () => request('/api/auth/me'),
  updateMe: (data) => request('/api/auth/me', { method: 'PUT', json: data }),
  uploadSignature(file) {
    const fd = new FormData();
    fd.append('signature', file);
    return request('/api/auth/me/signature', { method: 'POST', body: fd });
  },
  // Gambar tanda tangan butuh header Authorization, jadi diambil sebagai blob.
  async signatureUrl() {
    const res = await request('/api/auth/me/signature', { raw: true });
    return URL.createObjectURL(await res.blob());
  },
  logout: clearToken,
};

/* ----------------------------------------------------------------- helper */
export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  if (window.crypto?.subtle) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (halaman http non-localhost tidak punya crypto.subtle). Hanya untuk mode contoh.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < u8.length; i++) {
    h1 = Math.imul(h1 ^ u8[i], 16777619) >>> 0;
    h2 = Math.imul(h2 + u8[i], 2246822519) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4);
}

const randomToken = () => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return 'sigma-' + [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const extOf = (name = '') => (name.split('.').pop() || '').toLowerCase();
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------- MOCK */
const mock = {
  async list() {
    await delay(150);
    return [...store.load().docs].sort((a, b) => new Date(b.signed_at) - new Date(a.signed_at));
  },
  async activity() {
    await delay(100);
    const { docs, activity } = store.load();
    const ev = [...activity];
    docs.forEach((d) => {
      ev.push({ id: `s-${d.id}`, kind: 'sign', title: `Menandatangani ${d.name}`, detail: 'Token QR dibuat dan ditempel pada dokumen', at: d.signed_at });
      if (d.revoked_at)
        ev.push({ id: `r-${d.id}`, kind: 'revoke', title: `Mencabut tanda tangan ${d.name}`, detail: `Alasan: ${d.revoke_reason || '-'}`, at: d.revoked_at });
    });
    return ev.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
  },
  async sign({ file, name, type, additional_info, field_of_study, user }) {
    await delay(500);
    const state = store.load();
    const doc = {
      id: `mock-${Date.now()}`,
      name: name.trim(), type, additional_info: additional_info.trim(), field_of_study: field_of_study.trim(),
      status: 'valid', signed_at: new Date().toISOString(), token: randomToken(),
      revoked_at: null, revoke_reason: null,
      signer_name: user.title ? `${user.full_name}, ${user.title}` : user.full_name,
      signer_position: user.position || '',
      original_format: extOf(file.name),
      file_hash: await hashFile(file),
    };
    state.docs.unshift(doc);
    store.save(state);
    return doc;
  },
  async revoke(id, reason) {
    await delay(300);
    const state = store.load();
    const d = state.docs.find((x) => x.id === id);
    if (!d) throw new ApiError('Dokumen tidak ditemukan', 404);
    d.status = 'revoked';
    d.revoked_at = new Date().toISOString();
    d.revoke_reason = reason || null;
    store.save(state);
    return d;
  },
  async download() {
    await delay(200);
    throw new ApiError('Mode contoh: unduhan aktif setelah QR & PDF Service (Tahap 3) tersambung.', 501);
  },
  async verify(token) {
    await delay(250);
    const state = store.load();
    const d = state.docs.find((x) => x.token === token);
    if (!d) throw new ApiError('Token tidak ditemukan', 404);
    state.activity.unshift({
      id: `scan-${Date.now()}`, kind: 'scan',
      title: `Verifikasi QR ${d.name}`,
      detail: `Dipindai oleh pemeriksa publik — status ${d.status === 'valid' ? 'Valid' : d.status === 'revoked' ? 'Dicabut' : 'Tidak Valid'}`,
      at: new Date().toISOString(),
    });
    state.activity = state.activity.slice(0, 50);
    store.save(state);
    return {
      status: d.status, token: d.token,
      name: d.name, type: d.type, additional_info: d.additional_info,
      approved_by: d.signer_name, approved_at: d.signed_at, signed_by: d.signer_name,
      field_of_study: d.field_of_study, revoked_at: d.revoked_at,
    };
  },
  async checkFile(token, file) {
    await delay(400);
    const d = store.load().docs.find((x) => x.token === token);
    if (!d) throw new ApiError('Token tidak ditemukan', 404);
    return { authentic: (await hashFile(file)) === d.file_hash };
  },
};

/* ----------------------------------------------------------------- REAL (sesuai README bagian 12) */
const real = {
  list: () => request('/api/signatures'),
  async activity() {
    const docs = await request('/api/signatures');
    const ev = [];
    docs.forEach((d) => {
      ev.push({ id: `s-${d.id}`, kind: 'sign', title: `Menandatangani ${d.name}`, detail: 'Token QR dibuat dan ditempel pada dokumen', at: d.signed_at });
      if (d.revoked_at)
        ev.push({ id: `r-${d.id}`, kind: 'revoke', title: `Mencabut tanda tangan ${d.name}`, detail: `Alasan: ${d.revoke_reason || '-'}`, at: d.revoked_at });
    });
    return ev.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
  },
  // Unggah file; server mengubahnya ke PDF (bila perlu) dan mengembalikan jumlah halaman.
  upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/documents', { method: 'POST', body: fd });
  },
  // Pratinjau satu halaman (PNG dari server). Butuh header Authorization, jadi diambil sebagai blob.
  async previewUrl(docId, page) {
    const res = await request(`/api/documents/${docId}/preview/${page}`, { raw: true });
    return URL.createObjectURL(await res.blob());
  },
  async sign({ docId, name, type, additional_info, field_of_study, label, page, x, y }) {
    await request(`/api/documents/${docId}`, { method: 'PUT', json: { name, type, additional_info, field_of_study } });
    return request('/api/signatures', { method: 'POST', json: { document_id: docId, label, page, x, y } });
  },
  revoke: (id, reason) => request(`/api/signatures/${id}/revoke`, { method: 'POST', json: { reason } }),
  async download(id, format, fallbackName = 'dokumen') {
    const res = await request(`/api/signatures/${id}/download?format=${format}`, { raw: true });
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd);
    const filename = m ? decodeURIComponent(m[1]) : `${fallbackName}.${format}`;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  verify: (token) => request(`/api/verify/${token}`, { auth: false }),
  checkFile(token, file) {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/api/verify/${token}/check-file`, { method: 'POST', body: fd, auth: false });
  },
};

export const docs = USE_MOCK ? mock : real;

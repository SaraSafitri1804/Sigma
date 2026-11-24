// Data contoh yang disimpan di localStorage browser.
// Dipakai selama Document / Signing / Verification Service (Tahap 2-4) belum jadi.
const KEY = 'sigma_mock_v1';

const seedDocs = [
  ['KELAS PELATIHAN HARDWARE RAKIT PC', 'Persetujuan KProdi', 'Teknik Informatika', 'Pelatihan Mahasiswa Angkatan 2026 — Lab Jaringan', 'valid', '2026-11-21T02:45:00Z', 'sigma-9f8a2c41e7b0'],
  ['SURAT IZIN PENELITIAN SKRIPSI', 'Rekomendasi Dosen', 'Sistem Informasi', 'Penelitian di PT Nusantara Digital', 'valid', '2026-11-20T07:20:00Z', 'sigma-3c71d0a95b2e'],
  ['SURAT TUGAS KUNJUNGAN INDUSTRI', 'Surat Tugas', 'Teknik Informatika', 'Kunjungan industri semester ganjil', 'revoked', '2026-11-19T04:05:00Z', 'sigma-b64e19f08a37', '2026-11-19T08:30:00Z', 'Perubahan jadwal dan peserta kegiatan'],
  ['PENGESAHAN PROPOSAL SEMINAR HASIL', 'Pengesahan Proposal', 'Teknik Informatika', 'Seminar hasil gelombang 2', 'invalid', '2026-11-18T09:10:00Z', 'sigma-71ae5c2d9e04'],
  ['SURAT KETERANGAN AKTIF KULIAH', 'Surat Keterangan', 'Sistem Informasi', 'Untuk keperluan beasiswa', 'valid', '2026-11-17T03:00:00Z', 'sigma-e20b8d7f4a15'],
  ['PERSETUJUAN JUDUL SKRIPSI', 'Persetujuan KProdi', 'Teknik Informatika', 'Judul disetujui tanpa revisi', 'valid', '2026-11-14T06:40:00Z', 'sigma-5d93a1c6b782'],
  ['REKOMENDASI MAGANG SEMESTER GENAP', 'Rekomendasi Dosen', 'Sistem Informasi', 'Magang 4 bulan', 'valid', '2026-11-12T02:15:00Z', 'sigma-0a4f7e38c9d1'],
  ['SURAT TUGAS PANITIA SEMINAR NASIONAL', 'Surat Tugas', 'Teknik Informatika', 'Seminar nasional teknologi informasi', 'revoked', '2026-11-10T05:30:00Z', 'sigma-c8d26b05e3f9', '2026-11-11T01:00:00Z', 'Salah penulisan nama panitia'],
  ['PENGESAHAN PROPOSAL KKN TEMATIK', 'Pengesahan Proposal', 'Sistem Informasi', 'KKN tematik desa digital', 'valid', '2026-11-07T08:50:00Z', 'sigma-92b1e47d0c6a'],
  ['SURAT KETERANGAN LULUS MATA KULIAH', 'Surat Keterangan', 'Teknik Informatika', 'Mata kuliah Jaringan Komputer', 'valid', '2026-11-05T04:25:00Z', 'sigma-4e07f93a1b58'],
  ['PERSETUJUAN CUTI AKADEMIK', 'Persetujuan KProdi', 'Sistem Informasi', 'Cuti semester genap 2026/2027', 'valid', '2026-11-03T07:05:00Z', 'sigma-a73c0d58e921'],
  ['REKOMENDASI BEASISWA PRESTASI', 'Rekomendasi Dosen', 'Teknik Informatika', 'Beasiswa prestasi akademik', 'valid', '2026-11-02T03:35:00Z', 'sigma-18fd6a2b7c40'],
];

function seed() {
  const docs = seedDocs.map((r, i) => ({
    id: `mock-${i + 1}`,
    name: r[0], type: r[1], field_of_study: r[2], additional_info: r[3],
    status: r[4], signed_at: r[5], token: r[6],
    revoked_at: r[7] || null, revoke_reason: r[8] || null,
    signer_name: 'Andi Aljabar, S.Kom., M.T.I.', signer_position: 'Kaprodi',
    original_format: 'pdf',
    file_hash: Array.from({ length: 64 }, (_, k) => ((i * 7 + k * 3) % 16).toString(16)).join(''),
  }));
  const activity = [
    { id: 'a1', kind: 'scan', title: 'Verifikasi QR SURAT IZIN PENELITIAN SKRIPSI', detail: 'Dipindai oleh pemeriksa publik — status Valid', at: '2026-11-20T10:00:00Z' },
  ];
  return { docs, activity };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* abaikan */ }
  const s = seed();
  save(s);
  return s;
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* abaikan */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
}

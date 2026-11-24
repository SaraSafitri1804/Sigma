# SIGMA: Sistem Tanda Tangan Digital Berbasis QR Code

> **SIGMA** (Sistem Informasi Tanda Tangan Digital berbasis QR untuk Dokumen Akademik)
> Tagline: *Tanda Tangan Digital Anti Penyalahgunaan*

Aplikasi web (microservice) untuk memberi tanda tangan pada dokumen. Setiap tanda tangan disertai **QR code** yang berisi tautan verifikasi, sehingga tanda tangan **tidak bisa disalahgunakan** di dokumen lain. Tanpa Docker.

---

## 1. Latar Belakang

Gambar tanda tangan mudah dicopy lalu ditempel ke dokumen lain. Sistem ini mengunci setiap tanda tangan ke **satu dokumen tertentu** lewat QR code. Siapa pun yang scan QR bisa melihat informasi dokumen aslinya dan mengecek apakah tanda tangan itu valid.

## 2. Siapa Pemakainya

| Peran | Perlu akun? | Keterangan |
|---|---|---|
| **Penanda tangan** (dosen, kaprodi, dekan, dll.) | Ya (register + login) | Upload dokumen, lalu menandatangani dengan tanda tangannya sendiri |
| **Pengirim surat** (mis. mahasiswa) | Tidak | Mengirim surat ke penanda tangan lewat WhatsApp, di luar sistem |
| **Pemeriksa** (siapa pun yang scan QR) | Tidak | Membuka halaman verifikasi publik |

Semua akun setara, tidak ada role khusus. Jabatan hanya teks yang tampil di dokumen. Register terbuka untuk siapa saja.

## 3. Alur Penggunaan

1. Mahasiswa mengirim surat ke dosen lewat **WhatsApp**.
2. Dosen login, lalu **upload file** (PDF, Word, Excel, PowerPoint, atau gambar). Server mengubahnya ke PDF dan menampilkan **pratinjau halaman**.
3. Dosen mengisi data dokumen (nama, jenis, informasi tambahan, bidang studi), memilih halaman, dan **menggeser kotak tanda tangan + QR** ke posisi yang diinginkan.
4. Dosen menekan **Tanda Tangani Sekarang**. Sistem mencatat waktu, membuat token unik, menempelkan **gambar tanda tangan + QR** ke PDF, dan menambah halaman **"Description of The Signed Document"**.
5. Dosen mengunduh hasilnya (PDF, gambar, Word, atau ZIP semua format) dan mengirimkannya kembali lewat WhatsApp.
6. Siapa pun yang scan QR membuka halaman verifikasi: info dokumen dan status **Valid / Dicabut / Tidak Valid**. Di sana juga ada **Cek Keaslian File** untuk mencocokkan file yang diterima.
7. Jika tanda tangan disalahgunakan, dosen membuka menu **Dokumen** lalu menekan **Cabut**.

## 4. Format File

**Boleh diupload:** PDF, Word (`.doc`, `.docx`), Excel (`.xls`, `.xlsx`), PowerPoint (`.ppt`, `.pptx`), gambar (`.png`, `.jpg`, `.jpeg`). Maksimal **10 MB** dan **30 halaman**. Semua format selain PDF diubah ke PDF oleh server (preview dan penentuan posisi tanda tangan selalu pada PDF).

| Jenis file | Cara konversi | Perlu LibreOffice? |
|---|---|---|
| PDF | dipakai apa adanya | Tidak |
| PNG / JPG | dibuat jadi PDF satu halaman A4 | Tidak |
| Word / Excel / PowerPoint | LibreOffice (headless) | **Ya** |

**Hasil setelah ditandatangani** (semuanya dibuat saat menandatangani, dengan hash SHA-256 masing-masing):

| Format | Keterangan |
|---|---|
| **PDF** | Versi utama dan paling aman. Dianjurkan untuk dikirim |
| **Gambar** | Dokumen 1 halaman: file PNG. Lebih dari 1 halaman: ZIP berisi `halaman-1.png`, `halaman-2.png`, ... |
| **Word (.docx)** | Setiap halaman berupa gambar dalam file Word (tampilan sama persis dengan PDF, **tetapi teksnya tidak bisa diedit**) |
| **ZIP** | PDF + semua gambar halaman + Word dalam satu unduhan |

## 5. Mekanisme Keamanan

- QR berisi `PUBLIC_URL/verify/{token}`. Token acak (`sigma-` + 12 karakter heksadesimal).
- Server menyimpan token bersama salinan data dokumen (nama, jenis, penanda tangan, waktu) dan **hash SHA-256 setiap file hasil**.
- Tanda tangan + QR dicopy ke dokumen lain: hasil scan tetap menampilkan dokumen **asli**, sehingga ketahuan tidak cocok.
- **Cek Keaslian File**: pemeriksa meng-upload file yang dia terima, sistem menghitung hash-nya dan mencocokkan dengan file hasil di server. File yang diubah 1 byte pun akan **tidak cocok**. File asli sebelum ditandatangani juga tidak cocok.
- Jika salinan PDF di server berubah atau hilang, status verifikasi menjadi **Tidak Valid**.
- Penanda tangan dapat **mencabut** tanda tangannya (status **Dicabut**).
- Hanya pemilik yang bisa melihat, mengunduh, dan mencabut tanda tangannya (pengguna lain mendapat 403).
- Password disimpan sebagai hash bcrypt. Login memakai JWT. Rute `/internal/*` diblokir di Gateway dan hanya bisa dipanggil antar service dengan header `x-internal-key`.

## 6. Arsitektur Microservice

```
 Browser / HP
      |
 +----v-----+
 | Gateway  | :3000  routing + verifikasi JWT
 +----+-----+
      |
 +----+--------+------------+-------------+----------------+
 |             |            |             |                |
Auth        Document     Signing      Verification    (publik, tanpa login)
:3001        :3002        :3003          :3005
auth_db    document_db  signing_db     (tanpa DB)
                           |
                           +------> QR & PDF :3004 (tanpa DB, hanya antar service)
```

| Service | Port | Database | Tugas |
|---|---|---|---|
| Gateway | 3000 | - | Pintu masuk tunggal, verifikasi JWT, meneruskan request, memblokir rute internal |
| Auth | 3001 | `auth_db` | Register, login, profil, gambar tanda tangan |
| Document | 3002 | `document_db` | Simpan file asli + PDF hasil konversi, jumlah halaman, pratinjau halaman, hash |
| Signing | 3003 | `signing_db` | Proses tanda tangan, token, status, cabut, simpan file hasil + hash, unduhan |
| QR & PDF | 3004 | - | Konversi ke PDF, buat QR, tempel tanda tangan + QR, halaman deskripsi, buat PNG / Word / ZIP |
| Verification | 3005 | - | API verifikasi publik dan cek keaslian file (data dari Signing) |
| Frontend | 5173 | - | Tampilan web (React + Vite + Tailwind), sesuai desain Stitch |

Aturan: satu service memiliki database sendiri dan tidak boleh membaca database service lain (hanya lewat REST). Port 3001 sampai 3005 hanya untuk antar service; yang dibuka ke pengguna cukup Gateway (3000) dan Frontend (5173).

## 7. Teknologi

| Bagian | Teknologi |
|---|---|
| Backend | Node.js + Express (tiap service terpisah) |
| Database | PostgreSQL (satu server, database dipisah per service) |
| Auth | JWT + bcryptjs |
| Upload file | multer |
| QR & PDF | `qrcode` + `pdf-lib` (tempel QR/tanda tangan, halaman deskripsi) |
| PDF ke gambar | `pdfjs-dist` + `@napi-rs/canvas` (tanpa Poppler) |
| Word & ZIP hasil | `docx` + `archiver` |
| Konversi Word/Excel/PowerPoint | LibreOffice (opsional) |
| Frontend | React 18 + Vite + Tailwind CSS (tema dari desain Stitch), React Router, `qrcode` |
| Tools | DBeaver (cek database), Postman (tes API) |
| Deployment | Tanpa Docker, semua service dijalankan dengan `npm run dev` |

## 8. Rancangan Tampilan

Mengikuti gaya Dashboard UI Kit: sidebar biru di kiri, kartu putih bersudut membulat, kartu statistik berwarna, tombol aksi merah, latar abu muda.

| Layar | Isi |
|---|---|
| **Login / Register** | Kartu biru berisi form di kiri, logo dan ilustrasi di kanan |
| **Dashboard** | Kartu ringkasan, donat valid vs dicabut, aktivitas terbaru, dokumen terbaru |
| **Daftar Dokumen** | Tabel dengan filter dan paginasi; aksi lihat, **unduh (PDF / Gambar / Word / ZIP)**, tampilkan QR, cabut |
| **Tanda Tangani** | Upload file, pratinjau halaman asli dari server, kotak tanda tangan + QR yang bisa digeser |
| **Profil** | Nama, gelar, jabatan, upload gambar tanda tangan |
| **Verifikasi Publik** | `/verify/:token`, tanpa sidebar: tabel 7 baris, badge status, **Cek Keaslian File** |

Isi halaman "Description of The Signed Document" (di PDF dan di halaman verifikasi):

| No | Label | Contoh isi |
|---|---|---|
| 1 | Name of Document | KELAS PELATIHAN HARDWARE RAKIT PC |
| 2 | Type of Documents | Persetujuan KProdi |
| 3 | Additional Information | (info tambahan) |
| 4 | Approved By | Nama penanda tangan |
| 5 | Approved At | 21 November 2026, 09:45 WIB |
| 6 | Signed By | Nama penanda tangan |
| 7 | Field of Study | Bidang studi |

## 9. Struktur Folder

```
sigma/
├── package.json            (npm workspaces + skrip "npm run dev")
├── .env.example
├── README.md
├── database/
│   ├── 01_create_databases.sql
│   ├── 02_auth_db.sql
│   ├── 03_document_db.sql
│   └── 04_signing_db.sql
├── postman/sigma.postman_collection.json
├── gateway/
├── auth-service/
├── document-service/
├── signing-service/
├── qrpdf-service/          (lib: stamp, convert, formats, pdfimage, soffice)
├── verification-service/
└── frontend/
    ├── src/pages/          AuthPage, Dashboard, Documents, SignDocument, Profile, Verify
    ├── src/components/     Layout, Modal, Toast, Donut, StatusBadge, Icon
    ├── src/lib/            api.js (API nyata + data contoh), mockStore.js, format.js
    └── tailwind.config.js
```

## 10. Cara Menjalankan

**Kebutuhan:** Node.js 18+ (disarankan 20+), PostgreSQL, DBeaver, Postman. **LibreOffice** hanya jika ingin mengunggah Word/Excel/PowerPoint (PDF dan gambar tidak perlu).

1. **Buat database.** Di DBeaver, konek ke database `postgres`, lalu jalankan `database/01_create_databases.sql` (satu per satu). Tabel dibuat otomatis oleh tiap service saat start.
2. **Siapkan env.** Salin `.env.example` menjadi `.env`, lalu isi:
   - `DB_PASSWORD`: password PostgreSQL kamu
   - `JWT_SECRET` dan `INTERNAL_KEY`: teks acak yang berbeda satu sama lain
   - `PUBLIC_URL`: alamat yang ditulis di QR (lihat bagian 13)
   - `SOFFICE_PATH`: kosongkan; isi hanya jika LibreOffice tidak terdeteksi otomatis
3. **Install dependency** (sekali, di folder utama, dan ulangi setiap ada service baru):
   ```
   npm install
   ```
4. **Jalankan semua service:**
   ```
   npm run dev
   ```
   Tunggu sampai muncul `jalan di ...` untuk gateway, auth, document, signing, qrpdf, verification, dan alamat Vite.
5. Buka **http://localhost:5173**, klik **Daftar**, unggah gambar tanda tangan, lalu coba **Tanda Tangani**.
6. **Tes API.** Import `postman/sigma.postman_collection.json` ke Postman. Jalankan *Register* atau *Login*; token tersimpan otomatis.

Setiap mengubah `.env`, hentikan (`Ctrl + C`) lalu jalankan `npm run dev` lagi.

## 11. Rancangan Database

**auth_db** → `users`: id, full_name, title (gelar), position (jabatan), email (unik), password_hash, signature_path, created_at, updated_at.

**document_db** → `documents`: id, owner_id, name, type, additional_info, field_of_study, original_format, original_filename, original_path, pdf_path, page_count, file_hash (SHA-256 file asli), created_at, updated_at.

**signing_db**
- `signatures`: id, document_id, signer_id, token (unik), status (`valid`/`revoked`), salinan data dokumen (doc_name, doc_type, additional_info, field_of_study, original_format, page_count), signer_name, signer_position, label, qr_page, qr_x, qr_y (0..1), signed_at, revoked_at, revoke_reason.
- `signed_files`: id, signature_id, format (`pdf`/`png`/`pngzip`/`docx`/`zip`), page, file_path, file_hash (SHA-256), size_bytes.

Tidak ada foreign key antar database; relasi lintas service hanya berupa id.

## 12. Daftar Endpoint

Semua lewat Gateway (`http://localhost:3000`). Kolom "Login" berarti butuh header `Authorization: Bearer <token>`.

| Method | Path | Login | Keterangan |
|---|---|---|---|
| POST | /api/auth/register | tidak | form-data: full_name, title, position, email, password, signature (opsional) |
| POST | /api/auth/login | tidak | JSON: email, password |
| GET | /api/auth/me | ya | Profil sendiri |
| PUT | /api/auth/me | ya | Ubah full_name, title, position |
| POST | /api/auth/me/signature | ya | Upload gambar PNG/JPG maks 2 MB |
| GET | /api/auth/me/signature | ya | Lihat gambar tanda tangan |
| POST | /api/documents | ya | form-data: file (+ name, type, additional_info, field_of_study opsional). Mengembalikan id dan page_count |
| GET | /api/documents | ya | Daftar dokumen milik sendiri |
| GET | /api/documents/:id | ya | Detail dokumen |
| PUT | /api/documents/:id | ya | Ubah name, type, additional_info, field_of_study |
| GET | /api/documents/:id/preview/:page | ya | Gambar PNG satu halaman |
| GET | /api/signatures | ya | Daftar dokumen bertanda tangan milik sendiri |
| POST | /api/signatures | ya | JSON: document_id, label, page, x, y (x dan y = 0..1 dari ruang bebas di halaman) |
| POST | /api/signatures/:id/revoke | ya | JSON: reason (opsional) |
| GET | /api/signatures/:id/download?format=pdf\|png\|docx\|zip | ya | Unduh hasil |
| GET | /api/verify/:token | tidak | Data verifikasi: status (`valid`/`revoked`/`invalid`), name, type, additional_info, approved_by, approved_at, signed_by, field_of_study, revoked_at |
| POST | /api/verify/:token/check-file | tidak | form-data: file. Mengembalikan `{ "authentic": true/false }` |

Halaman verifikasi untuk pemindai QR adalah rute Frontend `/verify/:token`.

## 13. Frontend dan QR di HP

Frontend memakai API sungguhan. Untuk melihat tampilan saja tanpa backend, isi `frontend/.env` dengan `VITE_USE_MOCK=true` (data contoh disimpan di browser; unduhan tidak aktif).

**Alamat di dalam QR** ditentukan oleh `PUBLIC_URL` di `.env` utama saat tanda tangan dibuat:

| Situasi | Isi `PUBLIC_URL` |
|---|---|
| Hanya dites di laptop sendiri | `http://localhost:5173` |
| Dipindai dari HP di WiFi yang sama | `http://IP-LAPTOP:5173` (mis. `http://192.168.1.5:5173`) |
| Dipakai sungguhan | domain publik berHTTPS, atau tunnel (Cloudflare Tunnel / ngrok) |

Catatan penting: alamat di QR **tidak bisa diubah setelah dokumen ditandatangani**. QR pada dokumen lama tetap memakai alamat saat itu.

## 14. Status Pengerjaan

- [x] Gateway + Auth Service (register, login, profil, tanda tangan)
- [x] Document Service (upload, konversi, pratinjau, metadata)
- [x] Signing Service (tanda tangan, token, status, cabut, unduhan)
- [x] QR & PDF Service (QR, tempel tanda tangan, halaman deskripsi, PNG / Word / ZIP)
- [x] Verification Service (verifikasi publik, cek keaslian file)
- [x] Frontend sesuai desain Stitch, tersambung ke API

## 15. Pengembangan Lanjutan (opsional)

- Banyak penanda tangan pada satu dokumen
- Hasil Word yang teksnya bisa diedit
- Notifikasi email dan log aktivitas (audit log)
- Rate limiting pada endpoint publik
- Dibungkus jadi APK Android dengan Capacitor

# Tracking OS

Frontend prototype untuk pelacakan dan pengelolaan proses izin PB UMKU/OSS Penyelenggaraan Pemagangan Luar Negeri. Aplikasi ini menyediakan:

- Portal publik untuk melacak progres permohonan berdasarkan nomor permohonan.
- Portal admin untuk membuat, mengelola, memverifikasi, meninjau, menyetujui, dan menerbitkan izin.
- Simulasi alur dokumen multi-tahap lengkap dengan timeline, riwayat sesi, dan unggah revisi.

## Stack

- Vite
- React 18
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui
- Vitest + Testing Library

## Cara Menjalankan

```sh
npm install
npm run dev
```

Perintah lain:

```sh
npm run lint
npm run test
npm run build
```

Untuk mode full-stack yang memakai API Vercel Functions, jalankan aplikasi melalui `vercel dev` setelah env backend lengkap.

## Arsitektur Singkat

### Routing

- `/`: portal publik
- `/admin/login`: login admin
- `/admin`: dashboard admin
- `/admin/kelola/:id`: detail pengelolaan satu permohonan

### State dan penyimpanan

- `src/contexts/AuthContext.tsx`
  Menyimpan status login admin di `localStorage`. Jika mode backend aktif, login diverifikasi ke API dan token admin disimpan di browser.
- `src/contexts/SubmissionContext.tsx`
  Menyimpan seluruh data permohonan, timeline, riwayat dokumen, unggahan revisi, dan transisi workflow di `localStorage` untuk mode lokal, atau sinkron ke API + PostgreSQL untuk mode remote/Vercel.

### Backend testing

- `api/`
  Berisi Vercel Functions untuk auth admin, upload PDF, dan CRUD/action submission.
- `db/schema.ts`
  Skema PostgreSQL yang dipakai backend testing.
- `vercel.json`
  Rewrite SPA dan konfigurasi runtime fungsi serverless.

### Halaman utama

- `src/pages/Index.tsx`
  Pencarian nomor permohonan, detail progres publik, dan daftar izin yang sudah terbit.
- `src/pages/AdminDashboard.tsx`
  Ringkasan statistik, daftar permohonan, tambah data baru, pencarian, sortir, dan hapus.
- `src/pages/AdminKelola.tsx`
  Detail setiap tahap permohonan untuk admin.

### Komponen domain penting

- `src/components/StageDetailAdmin.tsx`
  UI paling kompleks untuk workflow admin: pengajuan, verifikasi, peninjauan, persetujuan, izin terbit.
- `src/components/StageDetailUser.tsx`
  Tampilan detail tahapan dari sisi pemohon.
- `src/components/Timeline.tsx`
  Riwayat aktivitas dengan filter tahapan, status, dan tanggal.
- `src/components/PublishedTable.tsx`
  Daftar izin yang sudah diterbitkan.
- `src/data/mockData.ts`
  Tipe domain, helper status/stage, dan utilitas format tanggal/status.

## Workflow Bisnis Saat Ini

1. Pengajuan dibuat admin.
2. Admin mengonfirmasi pengajuan.
3. Admin melakukan verifikasi dokumen.
4. Jika ada revisi, pemohon mengunggah dokumen perbaikan.
5. Admin melakukan peninjauan dokumen.
6. Admin menyimpan data persetujuan.
7. Admin menetapkan status izin pada tahap izin terbit.

Semua perubahan menambah timeline dan memperbarui status aktif tahap secara otomatis.

## Pengujian

Test utama ada di `src/test/session-flow.test.tsx` dan sudah mencakup:

- validasi sesi verifikasi/peninjauan
- upload revisi dokumen
- finalisasi persetujuan dan izin terbit
- edit data pengajuan
- konfirmasi aksi penting
- pembuatan permohonan baru
- persistence `localStorage`

## Kondisi Saat Ini

Yang sudah baik:

- Alur bisnis frontend sudah cukup lengkap.
- State persist antar refresh/tab dengan `localStorage`.
- Sudah ada backend testing berbasis Vercel Functions + PostgreSQL + Blob.
- Build produksi berhasil.
- Test flow utama sudah tersedia.

Batasan saat ini:

- Auth admin masih minimum untuk environment testing dan masih berbasis env statis, belum role management penuh.
- Public portal masih memakai data context frontend yang ditarik dari endpoint yang sama, jadi pemisahan akses publik vs admin belum final.
- Lint masih menyisakan beberapa warning `react-refresh` pada file utilitas/shadcn bawaan.

## Pengembangan Terbaru

Perubahan terakhir yang sudah diterapkan:

- route-level lazy loading di `App.tsx`
- lazy loading komponen berat di halaman publik dan detail admin
- perbaikan lint error pada pemanggilan date picker
- perbaikan aksesibilitas dialog edit data permohonan
- pemecahan bundle agar initial load lebih ringan

## Prioritas Lanjutan yang Disarankan

- Pisahkan endpoint/public payload agar portal publik tidak membawa data admin yang tidak diperlukan
- Ganti auth testing menjadi auth production-ready dengan session/cookie httpOnly dan role admin riil
- Tambah migrasi Drizzle yang formal dan seed command terpisah
- Rapikan warning lint bawaan shadcn/context export
- Tambah test integrasi untuk routing dan error states

## Env Testing di Vercel

Salin `.env.example`, lalu isi minimal:

- `VITE_ENABLE_REMOTE_STORAGE=true`
- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL_2` dan `ADMIN_PASSWORD_2` jika ingin menambah login admin kedua
- `ADMIN_SESSION_SECRET`

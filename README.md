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

## Arsitektur Singkat

### Routing

- `/`: portal publik
- `/admin/login`: login admin
- `/admin`: dashboard admin
- `/admin/kelola/:id`: detail pengelolaan satu permohonan

### State dan penyimpanan

- `src/contexts/AuthContext.tsx`
  Menyimpan status login admin di `localStorage`.
- `src/contexts/SubmissionContext.tsx`
  Menyimpan seluruh data permohonan, timeline, riwayat dokumen, unggahan revisi, dan transisi workflow di `localStorage`.

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
- Build produksi berhasil.
- Test flow utama sudah tersedia.

Batasan saat ini:

- Belum ada backend/API nyata.
- Login admin masih placeholder frontend dan belum memakai autentikasi riil.
- File yang diunduh/di-preview masih simulasi metadata.
- Lint masih menyisakan beberapa warning `react-refresh` pada file utilitas/shadcn bawaan.

## Pengembangan Terbaru

Perubahan terakhir yang sudah diterapkan:

- route-level lazy loading di `App.tsx`
- lazy loading komponen berat di halaman publik dan detail admin
- perbaikan lint error pada pemanggilan date picker
- perbaikan aksesibilitas dialog edit data permohonan
- pemecahan bundle agar initial load lebih ringan

## Prioritas Lanjutan yang Disarankan

- Integrasi backend untuk auth, persistence, dan file storage
- Validasi role/credential admin yang sebenarnya
- Refactor domain workflow agar logika context lebih modular
- Rapikan warning lint bawaan shadcn/context export
- Tambah test integrasi untuk routing dan error states

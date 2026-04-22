# Checklist UAT Flow Bisnis

Dokumen ini dipakai untuk menguji flow bisnis frontend secara end-to-end sebelum integrasi backend dan database.

## Ruang Lingkup

- Halaman publik pelacakan permohonan
- Dashboard admin
- Tahap `Pengajuan`
- Tahap `Verifikasi Dokumen`
- Tahap `Peninjauan`
- Tahap `Persetujuan`
- Tahap `Izin Terbit`
- Riwayat aktivitas dan riwayat sesi pemeriksaan

## Aturan Uji

- Gunakan data demo yang memang tersedia di aplikasi
- Jangan menambah flow baru di luar yang sudah ada
- Catat hanya mismatch yang benar-benar terlihat pada UI, status, aksi, atau hasil proses
- Jika ada istilah yang terasa janggal tetapi flow-nya benar, catat sebagai `copy/label`, bukan `bug flow`

## A. Halaman Publik

### A1. Pelacakan nomor permohonan valid

- Masukkan nomor permohonan yang tersedia
- Klik `Lacak Permohonan`
- Pastikan detail permohonan tampil
- Pastikan progress stepper sesuai status terakhir permohonan
- Pastikan detail stage yang aktif dapat dibaca dengan jelas

### A2. Pelacakan nomor permohonan tidak valid

- Masukkan nomor permohonan yang tidak tersedia
- Klik `Lacak Permohonan`
- Pastikan pesan error tampil dengan jelas
- Pastikan hasil lama tidak menyesatkan atau tertinggal

### A3. Reset pencarian

- Setelah hasil tampil, reset pencarian dari logo/aksi beranda
- Pastikan halaman kembali ke kondisi awal
- Pastikan detail permohonan sebelumnya tidak lagi tampil

## B. Dashboard Admin

### B1. Login admin

- Buka halaman login admin
- Coba submit tanpa email/password
- Pastikan validasi tampil
- Login dengan kredensial demo
- Pastikan masuk ke dashboard admin

### B2. Daftar permohonan

- Pastikan tabel menampilkan data permohonan
- Coba pencarian berdasarkan nomor permohonan
- Coba pencarian berdasarkan nama perusahaan/LPK
- Coba pencarian berdasarkan NIB
- Pastikan hasil filter sesuai

### B3. Kelola permohonan

- Buka aksi `Kelola Permohonan`
- Pastikan dialog aksi tampil
- Pastikan navigasi ke halaman kelola berjalan

### B4. Tambah permohonan

- Buka form tambah permohonan
- Coba submit form kosong
- Pastikan validasi wajib isi tampil
- Isi data valid
- Konfirmasi simpan
- Pastikan permohonan baru masuk daftar dan status awal sesuai

### B5. Hapus permohonan

- Pilih salah satu permohonan
- Jalankan aksi hapus
- Pastikan dialog konfirmasi tampil
- Konfirmasi hapus
- Pastikan data hilang dari daftar

## C. Tahap Pengajuan

### C1. Lihat detail pengajuan

- Buka halaman kelola pada permohonan di tahap `Pengajuan`
- Pastikan data inti tampil lengkap:
- Nomor permohonan
- Nama perusahaan/LPK
- NIB
- KBLI
- Jenis permohonan
- Tanggal pengajuan

### C2. Edit data pengajuan

- Klik `Edit data permohonan`
- Pastikan dialog edit tampil
- Pastikan tombol simpan nonaktif jika belum ada perubahan
- Ubah salah satu field
- Pastikan tombol simpan aktif
- Simpan perubahan
- Pastikan data detail langsung terbarui

### C3. Konfirmasi pengajuan

- Klik `Konfirmasi Pengajuan`
- Pastikan dialog konfirmasi tampil
- Konfirmasi aksi
- Pastikan tahap aktif berpindah ke `Verifikasi Dokumen`
- Pastikan timeline mencatat perpindahan tahap

## D. Tahap Verifikasi Dokumen

### D1. Pemeriksaan pertama tanpa revisi

- Buka permohonan yang sedang aktif di `Verifikasi Dokumen`
- Beri keputusan `Sesuai Persyaratan` untuk semua dokumen
- Simpan sesi
- Pastikan tahap `Verifikasi Dokumen` selesai
- Pastikan tahap aktif berpindah ke `Peninjauan`

### D2. Pemeriksaan pertama dengan revisi

- Pilih beberapa dokumen sebagai `Memerlukan Perbaikan`
- Isi catatan pada dokumen revisi
- Simpan sesi
- Pastikan tahap tetap di `Verifikasi Dokumen`
- Pastikan dokumen revisi ditandai merah
- Pastikan dokumen non-revisi tidak ikut diberi border revisi

### D3. Pemeriksaan lanjutan

- Masuk ke sesi verifikasi berikutnya
- Pastikan semua dokumen tetap terbuka untuk diperiksa
- Pastikan dokumen yang sebelumnya revisi masih punya penanda revisi
- Pastikan riwayat sesi terakhir default terbuka di section utama
- Pastikan detail dokumen di dalam riwayat tidak auto-expand

### D4. Border dinamis pada sesi aktif

- Pada dokumen yang sebelumnya revisi, pilih `Memerlukan Perbaikan`
- Pastikan border kartu merah
- Ubah ke `Sesuai Persyaratan`
- Pastikan border kembali netral
- Pastikan tidak ada border hijau

### D5. Upload revisi dari sisi pemohon

- Dari halaman publik, buka dokumen yang statusnya revisi
- Pastikan hanya dokumen revisi yang punya panel upload
- Upload file PDF valid
- Pastikan muncul status `Menunggu Pemeriksaan Ulang`
- Kembali ke admin
- Pastikan dokumen tersebut ditandai `Siap Diperiksa Ulang`

### D6. Revisi ulang setelah upload perbaikan

- Pada dokumen yang sudah diunggah ulang, pilih lagi `Memerlukan Perbaikan`
- Pastikan catatan baru wajib diisi
- Coba simpan tanpa catatan
- Pastikan sistem menolak

## E. Tahap Peninjauan

### E1. Pemeriksaan pertama tanpa revisi

- Beri keputusan `Sesuai Persyaratan` untuk semua dokumen
- Simpan sesi
- Pastikan tahap `Peninjauan` selesai
- Pastikan tahap aktif berpindah ke `Persetujuan`

### E2. Pemeriksaan pertama dengan revisi

- Pilih beberapa dokumen sebagai `Memerlukan Perbaikan`
- Isi catatan revisi
- Simpan sesi
- Pastikan tahap tetap di `Peninjauan`

### E3. Pemeriksaan lanjutan

- Masuk ke sesi peninjauan berikutnya
- Pastikan semua dokumen tetap terbuka
- Pastikan konsep border, label revisi, dan icon mengikuti aturan yang sama seperti verifikasi
- Pastikan riwayat sesi terakhir tampil konsisten

### E4. Upload revisi peninjauan

- Dari sisi pemohon, upload revisi pada dokumen peninjauan yang diminta
- Pastikan status `Menunggu Pemeriksaan Ulang` tampil
- Kembali ke admin
- Pastikan badge `Siap Diperiksa Ulang` tampil

## F. Tahap Persetujuan

### F1. Validasi form persetujuan

- Buka permohonan pada tahap `Persetujuan`
- Coba simpan tanpa tanggal persetujuan
- Pastikan validasi tampil
- Coba simpan tanpa nomor izin PB UMKU
- Pastikan validasi tampil
- Coba simpan tanpa file izin
- Pastikan validasi tampil

### F2. Nomor izin duplikat

- Gunakan nomor izin yang sudah dipakai permohonan lain
- Simpan
- Pastikan sistem menolak dan memberi pesan duplikat

### F3. Nomor izin fleksibel

- Isi nomor izin dengan format bebas yang masih masuk akal
- Simpan
- Pastikan sistem menerima selama terisi dan tidak duplikat

### F4. Selesai persetujuan

- Isi seluruh data valid
- Simpan persetujuan
- Pastikan tahap aktif berpindah ke `Izin Terbit`
- Pastikan timeline mencatat bahwa data persetujuan disimpan

## G. Tahap Izin Terbit

### G1. Guard sebelum terbit

- Buka permohonan yang draft persetujuannya belum lengkap
- Coba simpan `Izin Terbit`
- Pastikan sistem menolak

### G2. Penetapan status izin

- Pilih status izin yang valid
- Simpan
- Pastikan tahap `Izin Terbit` selesai
- Pastikan status global permohonan ikut sesuai
- Pastikan timeline mencatat izin telah diterbitkan

### G3. Detail izin terbit

- Dari sisi publik, buka permohonan yang sudah selesai
- Pastikan nomor izin, tanggal terbit, status izin, dan file izin tampil
- Pastikan tombol simulasi unduh berfungsi

## H. Timeline dan Riwayat

### H1. Timeline utama

- Pastikan event penting tercatat:
- Pengajuan dibuat
- Pengajuan dikonfirmasi
- Keputusan per dokumen
- Ringkasan sesi
- Upload revisi
- Persetujuan disimpan
- Izin diterbitkan

### H2. Konsistensi wording timeline

- Pastikan wording event tidak campur istilah yang membingungkan
- Pastikan label event sesuai konteks:
- `Berhasil`
- `Perlu Tindak Lanjut`
- `Memerlukan Perbaikan`

### H3. Riwayat sesi pemeriksaan

- Pastikan sesi verifikasi/peninjauan tersusun per siklus
- Pastikan dokumen di dalam setiap sesi sesuai keputusan yang pernah disimpan
- Pastikan catatan revisi tampil bila ada

## I. Smoke Check UI/UX

- Tidak ada tombol utama yang ambigu
- Tidak ada dialog konfirmasi yang wording-nya bertentangan dengan aksi
- Tidak ada status yang berubah sendiri tanpa aksi pengguna
- Tidak ada dokumen revisi yang kehilangan penanda historinya
- Tidak ada dokumen non-revisi yang salah terlihat sebagai revisi
- Tidak ada istilah yang terasa acak antara `revisi`, `perbaikan`, `pemeriksaan ulang`, dan `persetujuan`

## Template Catatan Temuan

Gunakan format ini saat menemukan mismatch:

- ID: `UAT-001`
- Area: `Verifikasi Dokumen`
- Skenario: `D4`
- Langkah reproduksi:
- Hasil saat ini:
- Hasil yang diharapkan:
- Kategori: `Flow` / `UI` / `Copy` / `Validasi`
- Prioritas: `Tinggi` / `Sedang` / `Rendah`


# Aturan proyek untuk AI (SINAR BMKG)

Baca `docs/SPEC.md` sebelum mengerjakan apa pun. SPEC adalah sumber kebenaran fitur. Tampilan merujuk `docs/prototype/*.html`. Skema data ada di `server/prisma/schema.prisma`.

## Cara kerja
1. Kerjakan **satu fitur per sesi**, sesuai sprint yang disebut pengguna. Jangan menambah fitur di luar SPEC.
2. Mulai dengan **rencana singkat** (file yang diubah dan alasannya), tunggu persetujuan, baru menulis kode.
3. Ubah skema hanya lewat migrasi Prisma. Jangan hapus data atau tabel tanpa bertanya.
4. Tanyakan dulu sebelum menambah dependensi baru. Pakai yang sudah ada di SPEC.
5. Setelah selesai: jalankan type-check dan build, lalu jelaskan **cara mengujinya di browser** (termasuk kasus gagal).
6. Jelaskan kode penting dengan bahasa sederhana. Pengguna wajib memahami alur React dan Express, jadi jangan menyembunyikan logika di abstraksi rumit.

## Teknis
- TypeScript ketat di `client/` (Vite + React Router) dan `server/` (Express). API di bawah `/api`.
- Validasi input di server dengan zod. Hak akses lewat middleware peran (ADMIN, USER), bukan hanya di UI.
- Unggahan: multer, cek ekstensi + MIME sebenarnya + ukuran, nama acak, simpan di `UPLOAD_DIR` (di luar folder publik), unduh lewat rute berotorisasi.
- Zona waktu WIB. Tanggal seminar disimpan sebagai tanggal + jam teks "HH:mm".
- Email hanya lewat tabel `EmailJob` dan pekerja node-cron. Jangan kirim email langsung di handler request.
- Rahasia hanya di `.env`. Jangan tulis sandi atau kunci di kode. Jangan commit `.env`.
- Teks antarmuka seluruhnya Bahasa Indonesia, pesan error ramah dan jelas.

## Tampilan
Ikuti prototipe: hijau BMKG `#2E9E4F`, biru `#0B3C8C`, huruf Plus Jakarta Sans, kartu kaca, langit hidup di latar, mode terang/gelap, pengaturan latar (bergerak/diam/polos), tombol utama hijau polos. Responsif (cek 390 px). Hormati `prefers-reduced-motion`. Tampilkan kondisi kosong, memuat, dan galat untuk tiap daftar dan form.

## Git
Satu cabang per fitur (`fitur/nama`), commit kecil dengan pesan Indonesia yang jelas, jangan push langsung ke `main` sebelum diuji.

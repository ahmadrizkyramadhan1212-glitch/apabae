# Catatan perbaikan (hasil tinjauan kode)

Cara memakai: salin isi folder ini ke `sinar-bmkg-starter/` di project lo (struktur folder sudah sama), timpa berkas yang ada. **Commit dulu sebelum menimpa** supaya bisa dibatalkan. Setelah itu: hentikan server, jalankan ulang `npm run dev`, dan di terminal lain `npm run worker` (lihat butir 8).

Pengecekan `tsc` server dan client lolos sebelum dan sesudah perbaikan. Yang dijalankan sungguhan di sini hanya logika unggahan non-gambar dan tumpang tindih waktu. Seluruh aplikasi belum bisa gua jalankan (tidak ada MySQL).

## Bug yang diperbaiki

| # | Tingkat | Gejala yang lo lihat | Penyebab | Berkas |
|---|---|---|---|---|
| 1 | **Tinggi** | Berita dengan 3 foto atau lebih gagal (galat 500) | Pembatas unggahan multer `files: 2` dipakai juga untuk foto berita (spesifikasi: 10 foto) | `lib/upload.ts`, `routes/konten.ts` |
| 2 | **Tinggi** | Poster WEBP atau surat DOCX ditolak saat Buat Seminar | Satu request memuat surat dan poster, tetapi filter jenis berkas milik surat dipakai untuk keduanya; MIME DOCX asli dari browser tidak dikenali | `lib/upload.ts`, `routes/seminars.ts` |
| 3 | **Tinggi** | Muncul "terlalu banyak percobaan" padahal baru login sebentar; seluruh pegawai bisa terkunci | Batas login 5 kali per 15 menit **per IP**, dan login yang berhasil ikut dihitung. Satu IP kantor dipakai bersama | `routes/auth.ts` |
| 4 | **Tinggi** | Peserta seminar gagal absen ("terlalu banyak") | Batas absen 10 per menit per IP, padahal semua peserta di satu ruangan berbagi satu IP Wi-Fi | `routes/absensi.ts` |
| 5 | **Tinggi** | Jadwal ditolak bentrok padahal beda hari | Fungsi cek bentrok mengambil seminar H-1 sampai H+1 lalu hanya membandingkan **jam**, tanpa memastikan tanggalnya sama | `lib/bentrok.ts` |
| 6 | **Tinggi** | Admin melihat surat izin lama setelah user mengunggah ulang | Unggah ulang menambah berkas baru tanpa menghapus yang lama, dan halaman verifikasi mengambil berkas pertama | `routes/seminars.ts` |
| 7 | Sedang | Jarum jam muncul di setiap baris lokasi | Garis "sekarang" digambar di dalam tiap baris. Sekarang satu garis di atas semua baris, di belakang blok seminar | `components/Timeline.tsx`, `styles.css` |
| 8 | Sedang | Email sandi tidak terkirim; kadang terkirim dua kali | (a) pekerja email adalah proses terpisah dan harus dijalankan sendiri; (b) putaran antrean bisa tumpang tindih sehingga email ganda. Sudah diberi penjaga | `workers/emailWorker.ts` |
| 9 | Sedang | Foto berita bisa berupa PDF | Filter foto memakai himpunan poster (termasuk PDF). Sekarang khusus JPG/PNG/WEBP | `lib/upload.ts`, `routes/konten.ts` |
| 10 | Sedang | Seminar yang berlangsung hari ini tidak tampil di "Seminar Mendatang" | Daftar dimulai dari besok. Sekarang dari hari ini (WIB) | `routes/publik.ts` |
| 11 | Sedang | Pemilik mengklik blok di timeline lalu masuk ke halaman publik tanpa tombol Mulai/Ubah | Blok selalu menuju `/seminar-publik`. Sekarang pemilik menuju `/seminar/:id` | `components/Timeline.tsx` |
| 12 | Kecil | Footer "Klaim sertifikat" dan "Verifikasi sertifikat" membawa kembali ke Beranda | Rutenya belum ada. Ditambahkan halaman placeholder sampai Sprint 7 | `App.tsx` |
| 13 | Kecil | Rute `index` ganda untuk "/" | Dihapus yang tidak terpakai | `App.tsx` |
| 14 | Kecil | Catatan audit unggah ulang hanya menulis "Surat izin" | Operator `?:` salah urut | `routes/seminars.ts` |
| 15 | Kecil | Lokasi "Lainnya" masih ada | Dihapus dari seed. Untuk database yang sudah berisi: jalankan SQL di bawah | `prisma/seed.ts` |

SQL untuk menghapus Lainnya dari database yang sudah ada (jalankan di DBeaver, **hanya bila belum ada seminar yang memakainya**):
```sql
DELETE FROM Location WHERE `key` = 'lainnya';
```

## Cara menjalankan dua proses
Server dan pekerja email adalah dua proses. Buka dua terminal di `server/`: satu `npm run dev`, satu `npm run worker`. Tanpa yang kedua, `EmailJob` tetap berstatus MENUNGGU.

## Temuan yang BELUM diperbaiki (perlu keputusan atau sprint lanjutan)
1. **Sandi sementara tersimpan sebagai teks biasa** di kolom `body` tabel `EmailJob` dan tidak dihapus setelah email terkirim. Sebaiknya isi body dikosongkan setelah TERKIRIM, atau sandi tidak disimpan di antrean.
2. **Hapus seminar oleh admin hanya menghapus berkas surat dan poster.** Materi, foto berita, template, dan PDF sertifikat tertinggal di disk.
3. **Fitur sertifikat belum tersambung ke rute.** `certPdf.ts` dan `certLayout.ts` ada, tetapi tidak ada rute pembuatan, pengiriman, klaim, dan verifikasi (Sprint 7).
4. **Foto berita belum bisa dihapus satu per satu** (hanya seluruh berita).
5. **Zona waktu:** tanggal "hari ini" di client dihitung dari jam peramban. Aman bila komputer pengguna WIB; bagi pengguna di zona lain, garis "sekarang" dan "Hari ini" bisa bergeser.
6. Folder `sinar-bmkg-starter/sinar-bmkg/` (sisa scaffold Vite JSX) dan `package-lock.json` di root tidak dipakai; aman dihapus.
7. Berkas `.env` ikut masuk zip yang lo kirim. Jangan membagikannya lagi; bila berisi sandi SMTP atau rahasia JWT yang nyata, ganti nilainya.

## Belum ditinjau
Halaman client `SeminarForm`, `SeminarDetail` dan tab-tabnya, halaman admin, serta `certPdf.ts` hanya dibaca sekilas atau tidak sama sekali. Bug lain mungkin masih ada di sana.

## Daftar uji setelah menerapkan perbaikan
1. Login salah 3 kali lalu benar: harus berhasil. 2. Buat seminar dengan surat DOCX + poster WEBP: harus tersimpan. 3. Berita dengan 5 foto: harus tersimpan; dengan PDF sebagai foto: ditolak. 4. Buat seminar jam 09-11 di Auditorium pada H+1 lalu di H dengan jam sama: tidak boleh bentrok. 5. Ajukan ulang dengan surat baru: admin harus melihat surat baru. 6. Timeline: satu garis merah saja, di belakang blok. 7. Seminar hari ini muncul di Seminar Mendatang. 8. Klik Klaim sertifikat: halaman placeholder, bukan Beranda.

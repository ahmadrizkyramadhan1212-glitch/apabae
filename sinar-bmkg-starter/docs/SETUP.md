# Setup alat dan proyek

## 1. Pasang alat (Windows)
| Alat | Fungsi |
|---|---|
| Node.js LTS | Menjalankan Vite dan Express |
| Git | Riwayat kode (penyelamat bila AI merusak sesuatu) |
| VS Code | Editor |
| Laragon (atau XAMPP) | MySQL di laptop |
| DBeaver atau phpMyAdmin | Melihat isi tabel |
| Mailpit | Server email palsu: SMTP `localhost:1025`, tampilan `http://localhost:8025` |
| Claude Code atau Cursor | Alat AI coding (pilih satu) |

Cek: `node -v`, `git --version`, `mysql --version`.

## 2. Buat proyek kosong
```
cd folder-proyek
git init
# frontend
npm create vite@latest client -- --template react-ts
cd client && npm i && npm i react-router-dom motion react-hook-form zod @hookform/resolvers lucide-react
npm i tailwindcss @tailwindcss/vite     # lalu ikuti panduan Tailwind untuk Vite
npx shadcn@latest init                  # ikuti pertanyaannya
cd ..
# backend
mkdir -p server && cd server && npm init -y
npm i express cors cookie-parser helmet express-rate-limit zod bcryptjs jsonwebtoken multer nodemailer node-cron pdf-lib @pdf-lib/fontkit qrcode sharp xlsx @prisma/client dotenv
npm i -D typescript tsx prisma @types/node @types/express @types/cors @types/cookie-parser @types/bcryptjs @types/jsonwebtoken @types/multer @types/nodemailer @types/qrcode
npx tsc --init
```
Perintah instalasi bisa berubah; bila ada error, cek dokumentasi resminya atau tempel pesan errornya ke AI.
Salin `server/.env.example` menjadi `server/.env` dan `client/.env.example` menjadi `client/.env`, lalu isi. **Jangan commit `.env`.**

## 3. Database
Buat database di MySQL (lewat DBeaver):
```sql
CREATE DATABASE sinar_bmkg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Di `server/package.json` tambahkan `"prisma": { "seed": "tsx prisma/seed.ts" }` lalu:
```
cd server
npx prisma migrate dev --name init
npx prisma db seed
```
Buka DBeaver dan pastikan tabel serta data contoh ada.

## 4. Commit pertama
```
git add . && git commit -m "Proyek awal SINAR BMKG: skema, spesifikasi, prototipe"
git branch -M main
```
Buat repositori **privat** di GitHub lalu `git remote add origin ...` dan `git push -u origin main`.

## 5. Huruf sertifikat
Unduh berkas TTF 10 huruf ke `server/assets/fonts/`: Playfair Display, Great Vibes, Cinzel, Allura, Pinyon Script, Dancing Script, Cormorant Garamond, Libre Baskerville, Montserrat (dari Google Fonts, lisensi terbuka) dan Times New Roman (atau pengganti Liberation Serif/Tinos).

## 6. Menjalankan
Terminal 1: `cd server && npx tsx watch src/index.ts` (port 4000). Terminal 2: `cd client && npm run dev` (port 5173). Mailpit jalan di terminal ketiga.

## 7. Latihan server (Ubuntu)
Latih dulu di WSL atau VirtualBox sebelum menyentuh server BMKG. Urutan deploy: pasang Node.js, MySQL, Nginx, PM2; `client`: `npm run build` lalu Nginx melayani `client/dist` dan meneruskan `/api` ke Express (port 4000); Express dijalankan PM2; cadangan database harian dengan `mysqldump` + cron; HTTPS bila ada domain. Jangan kirim IP, nama pengguna, dan sandi server ke chat atau Git.

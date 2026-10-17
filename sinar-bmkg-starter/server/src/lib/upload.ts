// Unggahan aman: nama berkas diganti acak, ekstensi + MIME sebenarnya (magic bytes) + ukuran dicek.
// Berkas disimpan di UPLOAD_DIR yang berada di luar folder publik; unduhan hanya lewat rute berotorisasi.
import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import { env } from '../env.js'

export class UploadError extends Error {
  status = 400
}

export const MIME: Record<string, { ekstensi: string[]; magic: (b: Buffer) => boolean; label: string }> = {
  'application/pdf': {
    ekstensi: ['.pdf'],
    magic: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
    label: 'PDF',
  },
  'image/jpeg': { ekstensi: ['.jpg', '.jpeg'], magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, label: 'JPG' },
  'image/png': { ekstensi: ['.png'], magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47, label: 'PNG' },
  'image/webp': { ekstensi: ['.webp'], magic: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP', label: 'WEBP' },
  'application/zip': {
    // DOCX modern adalah ZIP; ekstensi dibatasi di bawah agar ZIP biasa tidak lolos sebagai surat
    ekstensi: ['.docx'],
    magic: (b) => b[0] === 0x50 && b[1] === 0x4b,
    label: 'DOCX',
  },
  'application/msword': {
    ekstensi: ['.doc'],
    magic: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
    label: 'DOC',
  },
  'image/gif': {
    ekstensi: ['.gif'],
    magic: (b) => b.subarray(0, 6).toString('latin1') === 'GIF87a' || b.subarray(0, 6).toString('latin1') === 'GIF89a',
    label: 'GIF',
  },
  'image/bmp': { ekstensi: ['.bmp'], magic: (b) => b[0] === 0x42 && b[1] === 0x4d, label: 'BMP' },
  'image/svg+xml': {
    ekstensi: ['.svg'],
    magic: (b) => {
      const s = b.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trim()
      return s.startsWith('<svg') || (s.startsWith('<?xml') && s.includes('<svg'))
    },
    label: 'SVG',
  },
}

const ALIAS_MIME: Record<string, string> = {
  'image/x-ms-bmp': 'image/bmp',
  'image/x-windows-bmp': 'image/bmp',
  'text/xml': 'image/svg+xml',
  // DOCX asli dikirim browser dengan MIME ini; di sistem diperlakukan sebagai ZIP+ekstensi .docx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/zip',
  'application/xml': 'image/svg+xml',
}

export const SET_TEMPLATE = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
] as const
export const EKSTENSI_TEMPLATE = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'] as const

// Satu set jenis berkas yang dipakai beberapa endpoint
export const SET_SURAT = ['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'application/msword'] as const
export const SET_POSTER = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export const SET_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const // foto berita: bukan PDF

export function berkasDisimpan(izin: readonly string[], maksMB: number, opsi?: { lewatEkstensi?: readonly string[]; maksBerkas?: number }) {
  const storage = multer.memoryStorage()
  return {
    multer: multer({
      storage,
      limits: { fileSize: maksMB * 1024 * 1024, files: opsi?.maksBerkas ?? 2 },
      fileFilter: (_req, file, cb) => {
        if (opsi?.lewatEkstensi) {
          const ext = path.extname(file.originalname).toLowerCase()
          if (!opsi.lewatEkstensi.includes(ext)) {
            cb(new UploadError(`Ekstensi ${ext || '(kosong)'} tidak diizinkan`))
          } else cb(null, true)
          return
        }
        const mime = ALIAS_MIME[file.mimetype] ?? file.mimetype
        if (!izin.includes(mime)) {
          cb(new UploadError(`Jenis berkas ${file.mimetype} tidak diizinkan`))
        } else cb(null, true)
      },
    }),
    // Validasi lanjutan setelah berkas berada di memori: magic bytes + ekstensi + ukuran
    validasi: async (file: Express.Multer.File) => {
      const ext = path.extname(file.originalname).toLowerCase()
      let mime = ALIAS_MIME[file.mimetype] ?? file.mimetype
      const asal = mime
      if (!MIME[mime] || !MIME[mime]!.ekstensi.includes(ext)) {
        const dariExt = Object.entries(MIME).find(([, a]) => a.ekstensi.includes(ext))
        if (dariExt) mime = dariExt[0]
      }
      // Jenis harus termasuk yang diizinkan UNTUK KOLOM INI (surat, poster, foto, materi)
      if (!izin.includes(mime) && !izin.includes(asal)) throw new UploadError('Jenis berkas ini tidak diizinkan untuk kolom tersebut')
      const aturan = MIME[mime]
      if (!aturan) throw new UploadError('Jenis berkas tidak diizinkan')
      if (!aturan.ekstensi.includes(ext)) {
        throw new UploadError(`Ekstensi ${ext || '(kosong)'} tidak cocok dengan isi berkas ${aturan.label}`)
      }
      if (file.size > maksMB * 1024 * 1024) throw new UploadError(`Ukuran berkas melebihi ${maksMB} MB`)
      if (!aturan.magic(file.buffer)) {
        throw new UploadError(`Isi berkas bukan ${aturan.label} asli (ekstensi tidak boleh dipalsukan)`)
      }
      file.mimetype = mime
      // Gambar diverifikasi lebih dalam: sharp harus bisa membaca metadatanya.
      if (mime.startsWith('image/')) {
        const { default: sharp } = await import('sharp')
        try {
          await sharp(file.buffer).metadata()
        } catch {
          throw new UploadError(`Isi berkas bukan gambar ${aturan.label} yang valid`)
        }
      }
      return true
    },
  }
}

// Simpan ke UPLOAD_DIR/<subfolder>/<acak><ekstensi>, kembalikan jalur relatif untuk disimpan di database
export async function simpanBerkas(sub: string, file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase()
  const nama = `${crypto.randomBytes(12).toString('hex')}${ext}`
  const dir = path.join(env.uploadDir, sub)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, nama), file.buffer)
  return path.join(sub, nama).replace(/\\/g, '/')
}

export async function jalurLokal(rel: string): Promise<string> {
  // Cegah perjalanan direktori: jalur relatif tidak boleh keluar dari UPLOAD_DIR
  const penuh = path.resolve(env.uploadDir, rel)
  const akar = path.resolve(env.uploadDir)
  if (!penuh.startsWith(akar)) throw new UploadError('Jalur berkas tidak sah')
  return penuh
}

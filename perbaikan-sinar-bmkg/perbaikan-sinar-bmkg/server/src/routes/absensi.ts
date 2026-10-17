// Absensi: status seminar (Mulai/Selesai), halaman absensi publik, daftar peserta.
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../lib/auth.js'
import { audit } from '../lib/audit.js'

export const absensiRouter = Router()

// ===== Mulai seminar: DIJADWALKAN -> BERLANGSUNG (user pemilik, atau admin sebagai cadangan) =====
absensiRouter.post('/:id/mulai', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status !== 'DIJADWALKAN') {
      return res.status(400).json({ error: `Seminar berstatus ${seminar.status}. Hanya seminar terjadwal yang dapat dimulai.` })
    }
    await db.seminar.update({ where: { id: seminar.id }, data: { status: 'BERLANGSUNG' } })
    await audit(req.user!.id, 'MULAI_SEMINAR', seminar.title, req.user!.role === 'ADMIN' ? 'oleh admin (cadangan)' : 'oleh pemilik')
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// ===== Selesai + tutup absensi: BERLANGSUNG -> SELESAI =====
absensiRouter.post('/:id/selesai', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status !== 'BERLANGSUNG') {
      return res.status(400).json({ error: `Seminar berstatus ${seminar.status}. Hanya seminar yang sedang berlangsung yang dapat diselesaikan.` })
    }
    await db.seminar.update({ where: { id: seminar.id }, data: { status: 'SELESAI' } })
    await audit(req.user!.id, 'SELESAI_SEMINAR', seminar.title, 'Absensi ditutup')
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// ===== Aktifkan/nonaktifkan kode hadir 6 digit (hanya pemilik, saat BERLANGSUNG) =====
absensiRouter.post('/:id/kode-hadir', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = z.object({ aktif: z.boolean() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Data tidak valid' })
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status !== 'BERLANGSUNG') return res.status(400).json({ error: 'Kode hadir hanya dapat diatur saat seminar berlangsung' })
    const kode = parsed.data.aktif ? String(crypto.randomInt(0, 1000000)).padStart(6, '0') : null
    await db.seminar.update({ where: { id: seminar.id }, data: { attendCodeOn: parsed.data.aktif, attendCode: kode } })
    await audit(req.user!.id, parsed.data.aktif ? 'AKTIFKAN_KODE_HADIR' : 'MATIKAN_KODE_HADIR', seminar.title)
    res.json({ aktif: parsed.data.aktif, kode })
  } catch (e) {
    next(e)
  }
})

// ===== Info absensi untuk peserta (publik): hanya aktif saat BERLANGSUNG =====
absensiRouter.get('/t/:token', async (req, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({
      where: { attendToken: String(req.params.token) },
      select: { id: true, title: true, status: true, attendCodeOn: true, date: true, startTime: true, endTime: true, location: { select: { name: true } } },
    })
    if (!seminar) return res.status(404).json({ error: 'Tautan absensi tidak valid' })
    res.json({
      seminar,
      // kode hadir TIDAK dikirim ke publik — peserta harus menyalinnya dari layar ruangan
      bisaAbsen: seminar.status === 'BERLANGSUNG',
    })
  } catch (e) {
    next(e)
  }
})

// Batas absen: 120 kali per menit per IP. Seluruh peserta di satu ruangan biasanya berbagi satu IP Wi-Fi, jadi batas kecil akan memblokir peserta sah.
const absenLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Terlalu banyak percobaan. Tunggu sebentar.' } })

// ===== Kirim absensi (publik) =====
absensiRouter.post('/t/:token', absenLimiter, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        nama: z.string({ error: 'Nama wajib diisi' }).min(3, 'Nama minimal 3 karakter').max(100),
        nip: z.string({ error: 'NIP wajib diisi' }).regex(/^\d{6,20}$/, 'NIP harus 6-20 angka'),
        email: z.string({ error: 'Email wajib diisi' }).email('Email tidak valid'),
        setuju: z.literal(true, { error: 'Persetujuan pemrosesan data wajib dicentang' }),
        kode: z.string().optional(),
      })
      .safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const { nama, nip, email, kode } = parsed.data

    const seminar = await db.seminar.findUnique({ where: { attendToken: String(req.params.token) } })
    if (!seminar) return res.status(404).json({ error: 'Tautan absensi tidak valid' })
    if (seminar.status !== 'BERLANGSUNG') {
      return res.status(400).json({ error: seminar.status === 'SELESAI' ? 'Absensi sudah ditutup — seminar telah selesai.' : 'Absensi belum dibuka. Seminar belum berlangsung.' })
    }
    if (seminar.attendCodeOn) {
      if (!kode) return res.status(400).json({ error: 'Kode hadir wajib diisi (lihat layar di ruangan)' })
      if (kode !== seminar.attendCode) return res.status(400).json({ error: 'Kode hadir salah. Periksa layar di ruangan.' })
    }

    const emailB = email.toLowerCase()
    const ganda = await db.attendance.findFirst({ where: { seminarId: seminar.id, OR: [{ email: emailB }, { nip }] } })
    if (ganda) {
      return res.status(409).json({
        error: ganda.nip === nip ? 'NIP ini sudah tercatat hadir di seminar ini.' : 'Email ini sudah tercatat hadir di seminar ini.',
      })
    }

    const hadir = await db.attendance.create({ data: { seminarId: seminar.id, name: nama, nip, email: emailB, source: 'QR' } })
    await audit(null, 'ABSENSI', seminar.title, `${nama} (NIP ${nip})`)
    res.status(201).json({ ok: true, nama: hadir.name })
  } catch (e) {
    next(e)
  }
})

// ===== Daftar peserta (pemilik + admin) =====
absensiRouter.get('/:id/peserta', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    const peserta = await db.attendance.findMany({ where: { seminarId: seminar.id }, orderBy: { createdAt: 'asc' } })
    res.json(peserta)
  } catch (e) {
    next(e)
  }
})

// ===== Admin: tambah peserta manual =====
absensiRouter.post('/:id/peserta', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Hanya admin yang dapat menambah peserta manual' })
    const parsed = z
      .object({
        nama: z.string().min(3, 'Nama minimal 3 karakter').max(100),
        nip: z.string().regex(/^\d{6,20}$/, 'NIP harus 6-20 angka'),
        email: z.string().email('Email tidak valid'),
      })
      .safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    const emailB = parsed.data.email.toLowerCase()
    const ganda = await db.attendance.findFirst({ where: { seminarId: seminar.id, OR: [{ email: emailB }, { nip: parsed.data.nip }] } })
    if (ganda) return res.status(409).json({ error: 'NIP atau email sudah tercatat untuk seminar ini' })
    const hadir = await db.attendance.create({ data: { seminarId: seminar.id, name: parsed.data.nama, nip: parsed.data.nip, email: emailB, source: 'MANUAL' } })
    await audit(req.user!.id, 'TAMBAH_PESERTA', seminar.title, parsed.data.nama)
    res.status(201).json(hadir)
  } catch (e) {
    next(e)
  }
})

// ===== Admin: hapus peserta =====
absensiRouter.delete('/peserta/:pesertaId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Hanya admin yang dapat menghapus peserta' })
    const hadir = await db.attendance.findUnique({ where: { id: String(req.params.pesertaId) }, include: { seminar: true } })
    if (!hadir) return res.status(404).json({ error: 'Peserta tidak ditemukan' })
    await db.attendance.delete({ where: { id: hadir.id } })
    await audit(req.user!.id, 'HAPUS_PESERTA', hadir.seminar.title, hadir.name)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// ===== Unduh daftar hadir CSV (pemilik + admin) =====
absensiRouter.get('/:id/peserta.csv', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    const peserta = await db.attendance.findMany({ where: { seminarId: seminar.id }, orderBy: { createdAt: 'asc' } })
    const baris = ['No,Nama,NIP,Email,Sumber,Waktu Absen']
      .concat(peserta.map((p, i) => [i + 1, `"${p.name.replaceAll('"', '""')}"`, p.nip, p.email, p.source, new Date(p.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })].join(',')))
      .join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="daftar-hadir-${seminar.code}.csv"`)
    // BOM agar Excel membaca UTF-8 dengan benar
    res.send('\uFEFF' + baris)
  } catch (e) {
    next(e)
  }
})

// ===== QR PNG untuk link absensi (pemilik + admin) =====
import QRCode from 'qrcode'
import { env } from '../env.js'
absensiRouter.get('/:id/qr', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    const url = `${env.appUrl}/absen/${seminar.attendToken}`
    const png = await QRCode.toBuffer(url, { width: 400, margin: 2 })
    res.setHeader('Content-Type', 'image/png')
    res.send(png)
  } catch (e) {
    next(e)
  }
})

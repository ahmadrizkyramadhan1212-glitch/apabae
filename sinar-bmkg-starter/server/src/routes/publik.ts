// Rute publik (tanpa login): timeline, seminar mendatang, riwayat, detail.
// Seminar milik user yang belum disetujui HANYA tampil untuk pemiliknya (redup), tidak untuk publik.
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../lib/auth.js'

export const publikRouter = Router()

const tampilPublik = ['DIJADWALKAN', 'BERLANGSUNG', 'SELESAI'] as const

const pilih = {
  id: true, code: true, title: true, topic: true, date: true, startTime: true, endTime: true,
  status: true, locationId: true, locationOther: true, location: true, userId: true,
} as const

// Opsional kenali user (boleh tamu): pakai middleware requireAuth yang tidak memaksa
import { COOKIE_NAME } from '../lib/auth.js'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'
import { jalurLokal } from '../lib/upload.js'

async function userOpsional(req: AuthRequest): Promise<{ id: string; role: 'ADMIN' | 'USER' } | null> {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined
  if (!token) return null
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string }
    if (!payload.sub) return null
    const u = await db.user.findUnique({ where: { id: payload.sub } })
    return u && u.active ? { id: u.id, role: u.role } : null
  } catch {
    return null
  }
}

// TIMELINE per tanggal. Publik hanya lihat yang disetujui; user login juga lihat miliknya yang menunggu.
publikRouter.get('/timeline', async (req: AuthRequest, res, next) => {
  try {
    const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(req.query)
    if (!q.success) return res.status(400).json({ error: 'Parameter tanggal tidak valid' })
    const tanggal = new Date(`${q.data.date}T00:00:00.000Z`)

    const user = await userOpsional(req)
    const seminar = await db.seminar.findMany({
      where: {
        date: tanggal,
        OR: [
          { status: { in: [...tampilPublik] } },
          // milik user login yang belum disetujui pun tampil (redup) di timeline miliknya
          ...(user ? [{ userId: user.id, status: { in: ['MENUNGGU_VERIFIKASI', 'DIKEMBALIKAN'] as never[] } }] : []),
        ],
      },
      select: pilih,
      orderBy: { startTime: 'asc' },
    })
    const lokasi = await db.location.findMany({ orderBy: { capacity: 'desc' } })
    res.json({
      lokasi,
      seminar: seminar.map((s) => ({
        ...s,
        // penanda untuk client: redup + tidak bisa diklik publik
        milik: user ? s.userId === user.id : false,
      })),
    })
  } catch (e) {
    next(e)
  }
})

// SEMINAR MENDATANG: mulai besok sampai 30 hari ke depan, hanya yang disetujui
publikRouter.get('/mendatang', async (_req, res, next) => {
  try {
    // Mulai HARI INI (WIB), bukan besok, supaya seminar yang berlangsung hari ini ikut tampil
    const besok = new Date(Date.now() + 7 * 3600 * 1000)
    besok.setUTCHours(0, 0, 0, 0)
    const batas = new Date(besok)
    batas.setUTCDate(batas.getUTCDate() + 30)
    const data = await db.seminar.findMany({
      where: { status: { in: ['DIJADWALKAN', 'BERLANGSUNG'] }, date: { gte: besok, lte: batas } },
      select: pilih,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: 12,
    })
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// RIWAYAT: seminar SELESAI dan DIBATALKAN
publikRouter.get('/riwayat', async (req, res, next) => {
  try {
    const halaman = Math.max(1, Number(req.query.halaman ?? 1))
    const perHalaman = 20
    const where = { status: { in: ['SELESAI', 'DIBATALKAN'] as never[] } }
    const [data, total] = await Promise.all([
      db.seminar.findMany({ where, select: pilih, orderBy: { date: 'desc' }, skip: (halaman - 1) * perHalaman, take: perHalaman }),
      db.seminar.count({ where }),
    ])
    res.json({ data, total, halaman, totalHalaman: Math.ceil(total / perHalaman) })
  } catch (e) {
    next(e)
  }
})

// DETAIL PUBLIK: hanya yang disetujui; milik user menunggu hanya untuk pemilik/admin
publikRouter.get('/seminar/:id', async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({
      where: { id: String(req.params.id) },
      select: { ...pilih, returnReason: true, user: { select: { name: true, unit: true } } },
    })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    const user = await userOpsional(req)
    const publikLihat = (tampilPublik as readonly string[]).includes(seminar.status)
    const milik = user ? seminar.userId === user.id : false
    if (!publikLihat && !(milik || user?.role === 'ADMIN')) {
      return res.status(403).json({ error: 'Seminar ini belum dipublikasikan' })
    }

    // Dokumentasi & materi hanya untuk seminar yang sudah selesai (SPEC bagian 5)
    const [berita, materi] =
      seminar.status === 'SELESAI'
        ? await Promise.all([
            db.news.findUnique({ where: { seminarId: seminar.id }, include: { photos: { orderBy: { sortOrder: 'asc' } } } }),
            db.material.findMany({ where: { seminarId: seminar.id }, orderBy: { createdAt: 'asc' }, select: { id: true, presenter: true, originalName: true, driveUrl: true, sizeBytes: true } }),
          ])
        : [null, []]

    res.json({ ...seminar, milik, berita, materi })
  } catch (e) {
    next(e)
  }
})

// Foto berita: publik hanya bila berita milik seminar SELESAI
publikRouter.get('/foto/:id', async (req, res, next) => {
  try {
    const foto = await db.newsPhoto.findUnique({ where: { id: String(req.params.id) }, include: { news: { include: { seminar: true } } } })
    if (!foto) return res.status(404).json({ error: 'Foto tidak ditemukan' })
    if (foto.news.seminar.status !== 'SELESAI') return res.status(403).json({ error: 'Dokumentasi belum dipublikasikan' })
    res.sendFile(await jalurLokal(foto.path))
  } catch (e) {
    next(e)
  }
})

// Unduh berkas materi: publik hanya bila seminar SELESAI (tautan Drive ditangani client)
publikRouter.get('/materi/:id', async (req, res, next) => {
  try {
    const materi = await db.material.findUnique({ where: { id: String(req.params.id) }, include: { seminar: true } })
    if (!materi?.storedPath) return res.status(404).json({ error: 'Berkas materi tidak ditemukan' })
    if (materi.seminar.status !== 'SELESAI') return res.status(403).json({ error: 'Materi belum dipublikasikan' })
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(materi.originalName ?? 'materi')}"`)
    res.sendFile(await jalurLokal(materi.storedPath))
  } catch (e) {
    next(e)
  }
})

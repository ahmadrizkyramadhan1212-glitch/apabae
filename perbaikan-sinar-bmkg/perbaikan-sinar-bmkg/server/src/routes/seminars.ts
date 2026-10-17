// Fitur seminar milik user: buat, lihat miliknya, edit sesuai status, ajukan ulang, unggah dokumen.
import { Router } from 'express'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../lib/auth.js'
import { audit } from '../lib/audit.js'
import { cekBentrok } from '../lib/bentrok.js'
import { berkasDisimpan, simpanBerkas, jalurLokal, SET_SURAT, SET_POSTER, UploadError } from '../lib/upload.js'

export const seminarsRouter = Router()
export const berkasRouter = Router()

const suratUnggah = berkasDisimpan(SET_SURAT, 5)
const posterUnggah = berkasDisimpan(SET_POSTER, 5)
// Satu request berisi surat DAN poster: filter multer memakai gabungan, lalu tiap kolom divalidasi sesuai jenisnya
const campur = berkasDisimpan([...SET_SURAT, ...SET_POSTER], 5)

const KODE_ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa huruf/angka yang mudah tertukar
async function kodeBaru(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const kode = `${new Date().getFullYear() % 100}${String(new Date().getMonth() + 1).padStart(2, '0')}${Array.from(
      crypto.randomBytes(3),
    )
      .map((b) => KODE_ABJAD[b % KODE_ABJAD.length])
      .join('')}`
    if (!(await db.seminar.findUnique({ where: { code: kode } }))) return kode
  }
  throw new Error('Gagal membuat kode seminar unik')
}

const tanggalBaru = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD')
const jamBaru = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam harus HH:mm')

// Lokasi untuk dropdown form
seminarsRouter.get('/locations', requireAuth, async (_req, res, next) => {
  try {
    const lokasi = await db.location.findMany({ orderBy: { capacity: 'desc' } })
    res.json(lokasi)
  } catch (e) {
    next(e)
  }
})

// Indikator bentrok langsung di form (dipanggil saat jadwal berubah)
seminarsRouter.get('/bentrok', requireAuth, async (req, res, next) => {
  try {
    const q = z
      .object({ locationId: z.string().min(1), date: tanggalBaru, start: jamBaru, end: jamBaru, abaikan: z.string().optional() })
      .safeParse(req.query)
    if (!q.success) return res.json({ bentrok: [] })
    const { locationId, date, start, end, abaikan } = q.data
    if (start >= end) return res.json({ bentrok: [], jamTerbalik: true })
    const bentrok = await cekBentrok({
      locationId,
      tanggal: new Date(`${date}T00:00:00.000Z`),
      mulai: start,
      selesai: end,
      abaikanSeminarId: abaikan,
    })
    res.json({ bentrok })
  } catch (e) {
    next(e)
  }
})

// DAFTAR SEMINAR MILIK USER: cari + filter status
seminarsRouter.get('/mine', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cari = String(req.query.cari ?? '').trim()
    const status = String(req.query.status ?? '')
    const data = await db.seminar.findMany({
      where: {
        userId: req.user!.id,
        ...(cari && { OR: [{ title: { contains: cari } }, { topic: { contains: cari } }, { code: { contains: cari } }] }),
        ...(status && { status: status as never }),
      },
      orderBy: { date: 'desc' },
      include: { location: true, files: true },
    })
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// Detail milik sendiri (admin boleh lihat semua lewat rute admin di Sprint 4)
seminarsRouter.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({
      where: { id: String(req.params.id) },
      include: { location: true, files: true, user: { select: { name: true, nip: true, unit: true } } },
    })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    }
    res.json(seminar)
  } catch (e) {
    next(e)
  }
})

// BUAT SEMINAR: multipart (surat wajib, poster opsional). Hasil: MENUNGGU_VERIFIKASI, jadwal terkunci.
seminarsRouter.post('/', requireAuth, campur.multer.fields([{ name: 'surat', maxCount: 1 }, { name: 'poster', maxCount: 1 }]), async (req: AuthRequest, res, next) => {
  try {
    const b = req.body as Record<string, string>
    const skema = z
      .object({
        locationId: z.string().min(1, 'Lokasi wajib dipilih'),
        locationOther: z.string().optional(),
        date: tanggalBaru,
        startTime: jamBaru,
        endTime: jamBaru,
        title: z.string().min(5, 'Judul minimal 5 karakter'),
        topic: z.string().max(500).optional(),
      })
      .refine((d) => d.startTime < d.endTime, { message: 'Jam selesai harus setelah jam mulai', path: ['endTime'] })
    const parsed = skema.safeParse(b)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const data = parsed.data

    const lokasi = await db.location.findUnique({ where: { id: data.locationId } })
    if (!lokasi) return res.status(400).json({ error: 'Lokasi tidak ditemukan' })
    if (lokasi.type === 'OTHER' && !data.locationOther?.trim()) {
      return res.status(400).json({ error: 'Tuliskan nama lokasi pada pilihan Lainnya' })
    }

    const surat = (req.files as Record<string, Express.Multer.File[]> | undefined)?.surat?.[0]
    if (!surat) return res.status(400).json({ error: 'Surat izin wajib diunggah' })
    await suratUnggah.validasi(surat)
    const poster = (req.files as Record<string, Express.Multer.File[]> | undefined)?.poster?.[0]
    if (poster) await posterUnggah.validasi(poster)

    const tanggal = new Date(`${data.date}T00:00:00.000Z`)
    const bentrok = await cekBentrok({ locationId: data.locationId, tanggal, mulai: data.startTime, selesai: data.endTime })
    if (bentrok.length > 0) {
      return res.status(409).json({
        error: `Jadwal bentrok dengan "${bentrok[0]!.title}" (${bentrok[0]!.startTime}-${bentrok[0]!.endTime}) di lokasi yang sama. Pilih waktu lain.`,
      })
    }

    const suratPath = await simpanBerkas('seminar', surat)
    const posterPath = poster ? await simpanBerkas('seminar', poster) : null

    const seminar = await db.seminar.create({
      data: {
        code: await kodeBaru(),
        userId: req.user!.id,
        locationId: data.locationId,
        locationOther: lokasi.type === 'OTHER' ? data.locationOther?.trim() : null,
        title: data.title,
        topic: data.topic || null,
        date: tanggal,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'MENUNGGU_VERIFIKASI',
        attendToken: crypto.randomBytes(12).toString('hex'),
        files: {
          create: [
            { kind: 'SURAT_IZIN', originalName: surat.originalname, storedPath: suratPath, mime: surat.mimetype, sizeBytes: surat.size },
            ...(posterPath && poster
              ? [{ kind: 'POSTER' as const, originalName: poster.originalname, storedPath: posterPath, mime: poster.mimetype, sizeBytes: poster.size }]
              : []),
          ],
        },
      },
      include: { files: true, location: true },
    })
    await audit(req.user!.id, 'BUAT_SEMINAR', seminar.title, `Kode ${seminar.code}, ${data.date} ${data.startTime}-${data.endTime}`)
    res.status(201).json(seminar)
  } catch (e) {
    next(e)
  }
})

// Ubah data teks. Aturan per status (SPEC bagian 4):
// MENUNGGU_VERIFIKASI/DIKEMBALIKAN: semua kolom (jadwal dicek bentrok ulang)
// DIJADWALKAN/BERLANGSUNG/SELESAI: hanya judul dan topik
// DIBATALKAN: tidak bisa diedit
const ubahSkema = z
  .object({
    locationId: z.string().optional(),
    locationOther: z.string().optional(),
    date: tanggalBaru.optional(),
    startTime: jamBaru.optional(),
    endTime: jamBaru.optional(),
    title: z.string().min(5).optional(),
    topic: z.string().max(500).optional(),
  })
  .refine((d) => !d.startTime || !d.endTime || d.startTime < d.endTime, { message: 'Jam selesai harus setelah jam mulai' })

seminarsRouter.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) }, include: { location: true } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })

    const parsed = ubahSkema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const data = parsed.data

    const bisaSemua = seminar.status === 'MENUNGGU_VERIFIKASI' || seminar.status === 'DIKEMBALIKAN'
    if (!bisaSemua) {
      // Status maju: hanya judul dan topik yang boleh berubah
      const mencobaKolomTerkunci =
        data.locationId !== undefined || data.date !== undefined || data.startTime !== undefined || data.endTime !== undefined || data.locationOther !== undefined
      if (mencobaKolomTerkunci) {
        return res.status(403).json({
          error: `Seminar berstatus ${seminar.status} hanya boleh mengubah judul dan topik. Untuk mengubah jadwal, batalkan lalu buat seminar baru.`,
        })
      }
    }
    if (seminar.status === 'DIBATALKAN') return res.status(400).json({ error: 'Seminar yang dibatalkan tidak dapat diedit' })

    const perubahan: Record<string, unknown> = {}
    if (data.title !== undefined) perubahan.title = data.title
    if (data.topic !== undefined) perubahan.topic = data.topic || null

    if (bisaSemua && (data.locationId || data.date || data.startTime || data.endTime)) {
      const locationId = data.locationId ?? seminar.locationId
      const date = data.date ?? seminar.date.toISOString().slice(0, 10)
      const startTime = data.startTime ?? seminar.startTime
      const endTime = data.endTime ?? seminar.endTime
      if (startTime >= endTime) return res.status(400).json({ error: 'Jam selesai harus setelah jam mulai' })

      const lokasi = await db.location.findUnique({ where: { id: locationId } })
      if (!lokasi) return res.status(400).json({ error: 'Lokasi tidak ditemukan' })
      if (lokasi.type === 'OTHER' && !data.locationOther?.trim() && !seminar.locationOther) {
        return res.status(400).json({ error: 'Tuliskan nama lokasi pada pilihan Lainnya' })
      }
      const bentrok = await cekBentrok({
        locationId,
        tanggal: new Date(`${date}T00:00:00.000Z`),
        mulai: startTime,
        selesai: endTime,
        abaikanSeminarId: seminar.id,
      })
      if (bentrok.length > 0) {
        return res.status(409).json({
          error: `Jadwal bentrok dengan "${bentrok[0]!.title}" (${bentrok[0]!.startTime}-${bentrok[0]!.endTime}) di lokasi yang sama.`,
        })
      }
      Object.assign(perubahan, {
        locationId,
        locationOther: lokasi.type === 'OTHER' ? (data.locationOther?.trim() ?? seminar.locationOther) : null,
        date: new Date(`${date}T00:00:00.000Z`),
        startTime,
        endTime,
      })
    }

    const baru = await db.seminar.update({ where: { id: seminar.id }, data: perubahan, include: { files: true, location: true } })
    await audit(req.user!.id, 'UBAH_SEMINAR', baru.title, `Status ${seminar.status}; kolom: ${Object.keys(perubahan).join(', ') || '(tidak ada)'}`)
    res.json(baru)
  } catch (e) {
    next(e)
  }
})

// UNGGAH ULANG surat/poster: hanya saat DIKEMBALIKAN
seminarsRouter.post('/:id/dokumen', requireAuth, campur.multer.fields([{ name: 'surat', maxCount: 1 }, { name: 'poster', maxCount: 1 }]), async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id) return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status !== 'DIKEMBALIKAN') {
      return res.status(400).json({ error: 'Dokumen hanya dapat diunggah ulang saat seminar berstatus Dikembalikan' })
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined
    const surat = files?.surat?.[0]
    const poster = files?.poster?.[0]
    if (!surat && !poster) return res.status(400).json({ error: 'Pilih berkas surat atau poster untuk diunggah' })

    const data: { files?: { create: { kind: 'SURAT_IZIN' | 'POSTER'; originalName: string; storedPath: string; mime: string; sizeBytes: number }[] } } = {}
    if (surat) {
      await suratUnggah.validasi(surat)
      data.files = {
        create: [
          ...(data.files?.create ?? []),
          { kind: 'SURAT_IZIN', originalName: surat.originalname, storedPath: await simpanBerkas('seminar', surat), mime: surat.mimetype, sizeBytes: surat.size },
        ],
      }
    }
    if (poster) {
      await posterUnggah.validasi(poster)
      data.files = {
        create: [
          ...(data.files?.create ?? []),
          { kind: 'POSTER', originalName: poster.originalname, storedPath: await simpanBerkas('seminar', poster), mime: poster.mimetype, sizeBytes: poster.size },
        ],
      }
    }
    // Berkas lama dengan jenis yang sama diganti (bukan ditumpuk) supaya admin selalu melihat yang terbaru
    const jenis: ('SURAT_IZIN' | 'POSTER')[] = [...(surat ? (['SURAT_IZIN'] as const) : []), ...(poster ? (['POSTER'] as const) : [])]
    const lama = await db.seminarFile.findMany({ where: { seminarId: seminar.id, kind: { in: jenis } } })
    await db.seminar.update({ where: { id: seminar.id }, data })
    await db.seminarFile.deleteMany({ where: { id: { in: lama.map((f) => f.id) } } })
    for (const f of lama) await fs.unlink(await jalurLokal(f.storedPath)).catch(() => {})
    const baru = await db.seminar.findUniqueOrThrow({ where: { id: seminar.id }, include: { files: true, location: true } })
    await audit(req.user!.id, 'UNGAH_ULANG_DOKUMEN', baru.title, [surat ? 'Surat izin' : '', poster ? 'Poster' : ''].filter(Boolean).join(' + '))
    res.json(baru)
  } catch (e) {
    next(e)
  }
})

// AJUKAN ULANG: DIKEMBALIKAN -> MENUNGGU_VERIFIKASI. Surat wajib sudah ada.
seminarsRouter.post('/:id/resubmit', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) }, include: { files: true } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id) return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status !== 'DIKEMBALIKAN') return res.status(400).json({ error: 'Hanya seminar yang dikembalikan yang dapat diajukan ulang' })
    if (!seminar.files.some((f) => f.kind === 'SURAT_IZIN')) {
      return res.status(400).json({ error: 'Surat izin belum ada. Unggah surat terlebih dahulu.' })
    }

    // Jadwal boleh berubah sejak pengembalian: cek bentrok ulang
    const bentrok = await cekBentrok({
      locationId: seminar.locationId,
      tanggal: seminar.date,
      mulai: seminar.startTime,
      selesai: seminar.endTime,
      abaikanSeminarId: seminar.id,
    })
    if (bentrok.length > 0) {
      return res.status(409).json({
        error: `Jadwal bentrok dengan "${bentrok[0]!.title}" (${bentrok[0]!.startTime}-${bentrok[0]!.endTime}). Ubah jadwal sebelum mengajukan ulang.`,
      })
    }

    const baru = await db.seminar.update({
      where: { id: seminar.id },
      data: { status: 'MENUNGGU_VERIFIKASI', returnReason: null },
      include: { files: true, location: true },
    })
    await audit(req.user!.id, 'AJUKAN_ULANG', baru.title, `Kode ${seminar.code}`)
    res.json(baru)
  } catch (e) {
    next(e)
  }
})

// BATALKAN oleh user: sebelum SELESAI, tanpa persetujuan pihak lain
seminarsRouter.post('/:id/batalkan', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const seminar = await db.seminar.findUnique({ where: { id: String(req.params.id) } })
    if (!seminar) return res.status(404).json({ error: 'Seminar tidak ditemukan' })
    if (seminar.userId !== req.user!.id) return res.status(403).json({ error: 'Seminar ini bukan milik Anda' })
    if (seminar.status === 'SELESAI') return res.status(400).json({ error: 'Seminar yang sudah selesai tidak dapat dibatalkan' })
    if (seminar.status === 'DIBATALKAN') return res.status(400).json({ error: 'Seminar sudah dibatalkan' })
    await db.seminar.update({
      where: { id: seminar.id },
      data: { status: 'DIBATALKAN', cancelledBy: 'USER', cancelledAt: new Date() },
    })
    await audit(req.user!.id, 'BATALKAN_SEMINAR', seminar.title, `Kode ${seminar.code} dibatalkan oleh pemilik`)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// UNDUH BERKAS: hanya pemilik dan admin (surat izin dianggap dokumen internal)
berkasRouter.get('/:fileId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const file = await db.seminarFile.findUnique({ where: { id: String(req.params.fileId) }, include: { seminar: true } })
    if (!file) return res.status(404).json({ error: 'Berkas tidak ditemukan' })
    if (file.seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Anda tidak berhak mengakses berkas ini' })
    }
    const penuh = await jalurLokal(file.storedPath)
    res.setHeader('Content-Type', file.mime)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`)
    res.sendFile(penuh)
  } catch (e) {
    next(e)
  }
})

// Galat multer (ukuran/jenis) -> pesan ramah
export function galatUnggah(e: unknown): { status?: number; message?: string } | null {
  if (e instanceof UploadError) return { status: 400, message: e.message }
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const kode = String((e as { code: unknown }).code)
    if (kode === 'LIMIT_FILE_SIZE') return { status: 400, message: 'Ukuran berkas melebihi batas' }
    if (kode === 'LIMIT_UNEXPECTED_FILE') return { status: 400, message: 'Kolom berkas tidak dikenal' }
  }
  return null
}

// Sprint 7: sertifikat — template, tata letak, pratinjau, generate PDF per peserta,
// kirim email lewat antrean, klaim publik (email+NIP), dan verifikasi nomor seri.
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { promises as fs } from 'node:fs'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../lib/auth.js'
import { audit } from '../lib/audit.js'
import { berkasDisimpan, jalurLokal, simpanBerkas, SET_TEMPLATE, EKSTENSI_TEMPLATE } from '../lib/upload.js'
import { buatPdfSertifikat, rasioDariTemplate, type DataSertifikat } from '../lib/certPdf.js'
import { bacaHuruf } from '../lib/fonts.js'
import { layoutSkema, normalisasiLayout, pageModeSkema, type CertLayout } from '../lib/certLayout.js'

export const sertifikatRouter = Router()

const unduhLimiter = rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Terlalu banyak percobaan. Tunggu sebentar.' } })
const templateUnggah = berkasDisimpan(SET_TEMPLATE, 10, { lewatEkstensi: EKSTENSI_TEMPLATE })

async function seminarMilik(id: string, req: AuthRequest): Promise<{ ok: false; status: number; pesan: string } | { ok: true; seminar: NonNullable<Awaited<ReturnType<typeof db.seminar.findUnique>>> & { location: { name: string } | null } }> {
  const seminar = await db.seminar.findUnique({ where: { id }, include: { location: true } })
  if (!seminar) return { ok: false, status: 404, pesan: 'Seminar tidak ditemukan' }
  if (seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN') return { ok: false, status: 403, pesan: 'Seminar ini bukan milik Anda' }
  if (seminar.status !== 'SELESAI') return { ok: false, status: 400, pesan: 'Sertifikat aktif setelah seminar selesai' }
  return { ok: true, seminar: seminar as never }
}

const lokasiNama = (s: { location: { name: string } | null; locationOther: string | null }) =>
  s.locationOther?.trim() || s.location?.name || '-'

async function dataSertifikat(s: NonNullable<Awaited<ReturnType<typeof db.seminar.findUnique>>> & { location: { name: string } | null }, nama: string, nip: string, nomor: string): Promise<DataSertifikat> {
  return {
    nama,
    nip,
    judul: s.title,
    tanggal: s.date,
    lokasi: lokasiNama(s as never),
    code: s.code,
    nomor,
  }
}

// ===== GAMBARAN KESELURUHAN UNTUK TAB SERTIFIKAT =====
sertifikatRouter.get('/seminars/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const s = cek.seminar
    const peserta = await db.attendance.findMany({
      where: { seminarId: s.id },
      orderBy: { createdAt: 'asc' },
      include: { certificate: true },
    })
    const jobs = await db.emailJob.findMany({
      where: { certificateId: { in: peserta.map((p) => p.certificate?.id).filter((v): v is string => !!v) } },
      orderBy: { createdAt: 'desc' },
    })
    const jobTerakhir = new Map<string, (typeof jobs)[number]>()
    for (const j of jobs) if (!jobTerakhir.has(j.certificateId!)) jobTerakhir.set(j.certificateId!, j)
    res.json({
      seminar: { id: s.id, code: s.code, title: s.title, date: s.date, lokasi: lokasiNama(s as never) },
      templateAda: !!s.certTemplatePath,
      rasio: s.certPageRatio,
      pageMode: s.certPageMode,
      layout: normalisasiLayout(s.certLayout),
      peserta: peserta.map((p) => ({
        id: p.id, name: p.name, nip: p.nip, email: p.email,
        sertifikat: p.certificate
          ? { id: p.certificate.id, nomor: p.certificate.number, pdfAda: !!p.certificate.pdfPath, mailStatus: p.certificate.mailStatus, emailStatus: jobTerakhir.get(p.certificate.id)?.status ?? null, emailGalat: jobTerakhir.get(p.certificate.id)?.lastError ?? null }
          : null,
      })),
    })
  } catch (e) {
    next(e)
  }
})

// ===== UNGGAH TEMPLATE =====
sertifikatRouter.post('/seminars/:id/template', requireAuth, templateUnggah.multer.single('template'), async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const berkas = req.file
    if (!berkas) return res.status(400).json({ error: 'Pilih berkas template terlebih dahulu' })
    await templateUnggah.validasi(berkas)
    const tersimpan = await simpanBerkas('template', berkas)
    const rasio = await rasioDariTemplate(tersimpan)
    const seminar = await db.seminar.update({
      where: { id: cek.seminar.id },
      data: { certTemplatePath: tersimpan, certPageRatio: rasio, certPageMode: 'AUTO' },
    })
    await audit(req.user!.id, 'UBAH_SEMINAR', cek.seminar.title, 'Unggah template sertifikat')
    res.json({ templateAda: true, rasio: seminar.certPageRatio, pageMode: seminar.certPageMode })
  } catch (e) {
    next(e)
  }
})

// ===== SIMPAN TATA LETAK =====
const layoutBody = z.object({
  layout: layoutSkema.partial({ name: true }).optional(),
  pageMode: pageModeSkema.optional(),
})

sertifikatRouter.patch('/seminars/:id/layout', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const parsed = layoutBody.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const layout: CertLayout = parsed.data.layout ? normalisasiLayout(parsed.data.layout) : normalisasiLayout(cek.seminar.certLayout)
    const seminar = await db.seminar.update({
      where: { id: cek.seminar.id },
      data: { certLayout: layout, ...(parsed.data.pageMode ? { certPageMode: parsed.data.pageMode } : {}) },
    })
    res.json({ layout: normalisasiLayout(seminar.certLayout), pageMode: seminar.certPageMode })
  } catch (e) {
    next(e)
  }
})

// ===== PRATINJAU PDF (data contoh, tidak tersimpan) =====
sertifikatRouter.get('/seminars/:id/pratinjau', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const s = cek.seminar
    const tahun = s.date.getUTCFullYear()
    const data = await dataSertifikat(s as never, 'Contoh Nama Lengkap', '199001012005011001', `SERT/BMKG/${tahun}/${s.code}/001`)
    const pdf = await buatPdfSertifikat({ seminar: s, lokasiNama: lokasiNama(s as never), data, layout: normalisasiLayout(s.certLayout) })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="pratinjau-sertifikat.pdf"')
    res.setHeader('Cache-Control', 'no-store')
    res.send(pdf)
  } catch (e) {
    next(e)
  }
})

// ===== HURUF UNTUK EDITOR (TTF) =====
sertifikatRouter.get('/huruf/:kunci.ttf', requireAuth, async (req, res, next) => {
  try {
    const kunci = String(req.params.kunci).replace(/\.ttf$/, '') as Parameters<typeof bacaHuruf>[0]
    const buf = await bacaHuruf(kunci)
    res.setHeader('Content-Type', 'font/ttf')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(buf)
  } catch (e) {
    next(e)
  }
})

// ===== LATAR TEMPLATE SEBAGAI PNG (untuk editor seret di client) =====
sertifikatRouter.get('/seminars/:id/latar.png', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const { pngLatar, rasioDariTemplate } = await import('../lib/certPdf.js')
    const png = await pngLatar(cek.seminar.certTemplatePath)
    const rasio = cek.seminar.certPageRatio ?? (await rasioDariTemplate(cek.seminar.certTemplatePath))
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    // Rasio dikirim lewat header khusus agar client tahu bentuk halaman pratinjau
    res.setHeader('X-Rasio-Halaman', String(rasio ?? 1.414))
    res.send(png)
  } catch (e) {
    next(e)
  }
})

// ===== GENERATE SATU PDF PER PESERTA =====
sertifikatRouter.post('/seminars/:id/generate', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const s = cek.seminar
    const peserta = await db.attendance.findMany({ where: { seminarId: s.id }, orderBy: { createdAt: 'asc' }, include: { certificate: true } })
    if (peserta.length === 0) return res.status(400).json({ error: 'Belum ada peserta hadir untuk dibuatkan sertifikat' })
    const tahun = s.date.getUTCFullYear()
    const urutLama = new Map<string, number>()
    peserta.forEach((p, i) => {
      if (p.certificate) urutLama.set(p.certificate.id, i + 1) // nomor tetap meski digenerate ulang (SPEC)
    })
    let dibuat = 0
    for (const [i, p] of peserta.entries()) {
      const urut = p.certificate && urutLama.has(p.certificate.id) ? urutLama.get(p.certificate.id)! : i + 1
      const nomor = `SERT/BMKG/${tahun}/${s.code}/${String(urut).padStart(3, '0')}`
      const data = await dataSertifikat(s as never, p.name, p.nip, nomor)
      const pdf = await buatPdfSertifikat({ seminar: s, lokasiNama: lokasiNama(s as never), data, layout: normalisasiLayout(s.certLayout) })
      const pdfPath = await simpanBerkas('sertifikat', { originalname: 'sertifikat.pdf', buffer: pdf } as Express.Multer.File)
      await db.certificate.upsert({
        where: { attendanceId: p.id },
        update: { pdfPath, mailStatus: 'MENUNGGU' },
        create: { attendanceId: p.id, number: nomor, pdfPath },
      })
      dibuat++
    }
    await audit(req.user!.id, 'GENERATE_SERTIFIKAT', s.title, `${dibuat} sertifikat`)
    res.json({ ok: true, dibuat, total: peserta.length })
  } catch (e) {
    next(e)
  }
})

// ===== UNDUH PDF SERTIFIKAT (pemilik/admin) =====
sertifikatRouter.get('/pdf/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cert = await db.certificate.findUnique({ where: { id: String(req.params.id) }, include: { attendance: { include: { seminar: true } } } })
    if (!cert?.pdfPath) return res.status(404).json({ error: 'Sertifikat belum dibuat' })
    if (cert.attendance.seminar.userId !== req.user!.id && req.user!.role !== 'ADMIN')
      return res.status(403).json({ error: 'Bukan milik Anda' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cert.number.replace(/\//g, '-'))}.pdf"`)
    res.send(await fs.readFile(await jalurLokal(cert.pdfPath)))
  } catch (e) {
    next(e)
  }
})

// ===== KIRIM EMAIL SERTIFIKAT (satu EmailJob per penerima) =====
const emailBody = z.object({
  subjek: z.string().min(3).max(200),
  isi: z.string().min(10).max(5000),
  penerima: z.array(z.string()).min(1, 'Pilih minimal satu penerima'),
})

sertifikatRouter.post('/seminars/:id/email', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const cek = await seminarMilik(String(req.params.id), req)
    if (!cek.ok) return res.status(cek.status).json({ error: cek.pesan })
    const parsed = emailBody.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const s = cek.seminar
    const peserta = await db.attendance.findMany({ where: { seminarId: s.id, id: { in: parsed.data.penerima } }, include: { certificate: true } })
    if (peserta.length === 0) return res.status(400).json({ error: 'Penerima tidak ditemukan' })
    let antre = 0
    for (const p of peserta) {
      if (!p.certificate?.pdfPath) continue
      const isi = parsed.data.isi.replaceAll('{nama}', p.name).replaceAll('{judul}', s.title)
      await db.emailJob.create({
        data: {
          type: 'SERTIFIKAT', toEmail: p.email, toName: p.name,
          subject: parsed.data.subjek, body: isi,
          attachmentPath: p.certificate.pdfPath, attachmentName: `sertifikat-${p.name.replace(/\s+/g, '-')}.pdf`,
          certificateId: p.certificate.id,
        },
      })
      await db.certificate.update({ where: { id: p.certificate.id }, data: { mailStatus: 'MENUNGGU' } })
      antre++
    }
    if (antre === 0) return res.status(400).json({ error: 'Semua penerima belum memiliki berkas sertifikat. Tekan Buat Sertifikat dulu.' })
    await audit(req.user!.id, 'KIRIM_SERTIFIKAT', s.title, `${antre} email masuk antrean`)
    res.json({ ok: true, antre })
  } catch (e) {
    next(e)
  }
})

// ===== KIRIM ULANG YANG GAGAL =====
sertifikatRouter.post('/email/:jobId/kirim-ulang', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const job = await db.emailJob.findUnique({ where: { id: String(req.params.jobId) } })
    if (!job) return res.status(404).json({ error: 'Tugas email tidak ditemukan' })
    const cert = job.certificateId ? await db.certificate.findUnique({ where: { id: job.certificateId }, include: { attendance: { include: { seminar: true } } } }) : null
    if (!cert || cert.attendance.seminar.userId !== req.user!.id) return res.status(403).json({ error: 'Bukan milik Anda' })
    await db.emailJob.create({
      data: {
        type: job.type, toEmail: job.toEmail, toName: job.toName, subject: job.subject, body: job.body,
        attachmentPath: job.attachmentPath, attachmentName: job.attachmentName, certificateId: job.certificateId,
      },
    })
    await db.certificate.update({ where: { id: cert.id }, data: { mailStatus: 'MENUNGGU' } })
    await audit(req.user!.id, 'KIRIM_ULANG', cert.attendance.seminar.title, job.toEmail)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// ===== KLAIM PUBLIK (email + NIP, cadangan bila email gagal) =====
const klaimBody = z.object({ email: z.string().email('Email tidak valid'), nip: z.string().min(5, 'NIP wajib diisi') })

sertifikatRouter.post('/klaim', unduhLimiter, async (req, res, next) => {
  try {
    const parsed = klaimBody.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const cert = await db.certificate.findFirst({
      where: {
        attendance: {
          email: parsed.data.email.toLowerCase(),
          nip: parsed.data.nip,
          seminar: { status: 'SELESAI' },
        },
        pdfPath: { not: null },
      },
      include: { attendance: { include: { seminar: true } } },
      orderBy: { attendance: { seminar: { date: 'desc' } } },
    })
    if (!cert?.pdfPath) return res.status(404).json({ error: 'Sertifikat tidak ditemukan untuk email dan NIP tersebut' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(cert.number.replace(/\//g, '-'))}.pdf"`)
    res.send(await fs.readFile(await jalurLokal(cert.pdfPath)))
  } catch (e) {
    next(e)
  }
})

// ===== VERIFIKASI NOMOR SERI PUBLIK =====
sertifikatRouter.get('/verifikasi/:nomor', unduhLimiter, async (req, res, next) => {
  try {
    const nomor = decodeURIComponent(String(req.params.nomor)).trim()
    const cert = await db.certificate.findUnique({
      where: { number: nomor },
      include: { attendance: { include: { seminar: { include: { location: true } } } } },
    })
    if (!cert) return res.status(404).json({ error: 'Nomor sertifikat tidak ditemukan' })
    const s = cert.attendance.seminar
    res.json({
      nomor: cert.number,
      nama: cert.attendance.name,
      nip: cert.attendance.nip,
      seminar: s.title,
      tanggal: s.date,
      lokasi: lokasiNama(s as never),
    })
  } catch (e) {
    next(e)
  }
})

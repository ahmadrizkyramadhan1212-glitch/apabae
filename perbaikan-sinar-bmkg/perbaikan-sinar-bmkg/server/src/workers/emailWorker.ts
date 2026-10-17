// Pekerja email: proses antrean EmailJob berurutan dengan jeda 1,5 detik antar email.
// Maksimal 3 kali percobaan; gagal permanen ditandai GAGAL agar admin bisa kirim ulang.
// Jalankan: npm run worker (proses terpisah dari server web)
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { db } from '../db.js'
import { env } from '../env.js'

const transport = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
})

const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function prosesAntrean() {
  // Kunci sederhana: ambil tugas yang jatuh tempo, satu per satu
  const jobs = await db.emailJob.findMany({
    where: { status: 'MENUNGGU', nextTryAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })
  for (const job of jobs) {
    try {
      await transport.sendMail({
        from: env.smtp.from,
        to: job.toEmail,
        subject: job.subject,
        text: job.body,
        ...(job.attachmentPath
          ? { attachments: [{ path: job.attachmentPath, filename: job.attachmentName ?? 'lampiran' }] }
          : {}),
      })
      await db.emailJob.update({ where: { id: job.id }, data: { status: 'TERKIRIM', sentAt: new Date(), lastError: null } })
      console.log(`Email ${job.type} terkirim ke ${job.toEmail}`)
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e)
      const cobaLagi = job.attempts + 1 < 3
      await db.emailJob.update({
        where: { id: job.id },
        data: {
          attempts: { increment: 1 },
          lastError: pesan.slice(0, 500),
          ...(cobaLagi
            ? { nextTryAt: new Date(Date.now() + 60_000) }
            : { status: 'GAGAL' }),
        },
      })
      console.error(`Email ${job.type} ke ${job.toEmail} gagal (coba ${job.attempts + 1}): ${pesan}`)
    }
    await jeda(1500) // jeda antar email agar tidak dianggap spam
  }
}

// Cegah dua putaran berjalan bersamaan (20 email x 1,5 detik bisa lebih lama dari 20 detik) -> email ganda
let berjalan = false
const putaran = () => {
  if (berjalan) return
  berjalan = true
  prosesAntrean()
    .catch((e) => console.error('Pekerja email galat:', e))
    .finally(() => {
      berjalan = false
    })
}

cron.schedule('*/20 * * * * *', putaran)

console.log('Pekerja email berjalan: memeriksa antrean setiap 20 detik')
putaran()

// Data awal untuk pengembangan. Jalankan: npx prisma db seed
// Sandi semua akun contoh: Sinar#2026 (HANYA untuk pengembangan, ganti di produksi)
import { PrismaClient, SeminarStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const db = new PrismaClient()
// Tanggal disimpan UTC-tengah-malam sesuai konvensi aplikasi (kolom DATE): hari ini versi WIB
const day = (n: number) => {
  const ymd = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD zona lokal (WIB)
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}
const tok = () => crypto.randomBytes(12).toString('hex')

async function main() {
  const passwordHash = await bcrypt.hash('Sinar#2026', 10)

  // Lokasi: dari yang terbesar sampai yang kecil, fasilitas lengkap sampai minim
  const loc = (key: string, name: string, type: 'PHYSICAL' | 'ONLINE' | 'OTHER', capacity?: number, facilities?: string) =>
    db.location.upsert({ where: { key }, update: {}, create: { key, name, type, capacity, facilities } })
  const aud = await loc('auditorium', 'Gedung Auditorium', 'PHYSICAL', 1200, 'Proyektor, sound system, AC, panggung, mikrofon, perekaman')
  const rr = await loc('ruang-rapat', 'Ruang Rapat Lt. 1 Gedung A', 'PHYSICAL', 30, 'Proyektor, AC, papan tulis')
  const onl = await loc('online', 'Online (Zoom Meeting)', 'ONLINE')

  const mk = (name: string, nip: string, email: string, role: 'ADMIN' | 'USER', unit: string) =>
    db.user.upsert({ where: { email }, update: {}, create: { name, nip, email, role, unit, passwordHash, phone: '08123456789' } })
  await mk('Admin SINAR', '198001012005011001', 'admin@bmkg.go.id', 'ADMIN', 'Pusat Standardisasi')
  const nabila = await mk('Nabila Putri', '199505052020122001', 'nabila.putri@bmkg.go.id', 'USER', 'Bidang Klimatologi')
  const andi = await mk('Andi Pratama', '199203032018011002', 'andi.pratama@bmkg.go.id', 'USER', 'Bidang Geofisika')

  const sem = (title: string, off: number, s: string, e: string, st: SeminarStatus, locationId = aud.id, userId = nabila.id) =>
    db.seminar.create({
      data: {
        title, topic: 'Seminar ilmiah', date: day(off), startTime: s, endTime: e, status: st, locationId, userId,
        code: crypto.randomBytes(3).toString('hex').toUpperCase(), attendToken: tok(),
        letterReceived: st !== 'MENUNGGU_VERIFIKASI' && st !== 'DIKEMBALIKAN',
      },
    })

  await sem('Prakiraan Iklim Ekstrem Indonesia 2027', 0, '09:00', '11:00', 'DIJADWALKAN')
  await sem('Kalibrasi Sensor Suhu Otomatis', 0, '13:00', '15:30', 'BERLANGSUNG')
  await sem('Diskusi Panel Aktivitas Gempa Bumi', 2, '10:00', '12:00', 'DIJADWALKAN', rr.id, andi.id)
  await sem('Webinar Kualitas Udara Perkotaan', 4, '14:00', '16:00', 'MENUNGGU_VERIFIKASI', onl.id)
  const ret = await sem('Workshop Analisis Data Hujan', 7, '09:00', '12:00', 'DIKEMBALIKAN', rr.id)
  await db.seminar.update({ where: { id: ret.id }, data: { returnReason: 'Surat izin belum ditandatangani, mohon unggah ulang.' } })
  const batal = await sem('Sosialisasi Peringatan Dini Tsunami', 5, '08:00', '09:30', 'DIBATALKAN', aud.id, andi.id)
  await db.seminar.update({ where: { id: batal.id }, data: { cancelledBy: 'USER', cancelledAt: new Date() } })

  // Dua seminar selesai lengkap: peserta, materi, dan (salah satunya) berita
  for (const [title, off] of [['Dampak La Nina terhadap Curah Hujan', -14], ['Pemodelan Numerik Cuaca (WRF)', -28]] as const) {
    const s = await sem(title, off, '09:00', '12:00', 'SELESAI')
    const tag = off === -14 ? 'a' : 'b'
    for (const [i, n] of ['Dewi Lestari', 'Hendra Gunawan', 'Maya Sari', 'Rizky Pratama'].entries())
      await db.attendance.create({ data: { seminarId: s.id, name: n, nip: `19900101${tag === 'a' ? 1 : 2}${i}`, email: `${n.split(' ')[0].toLowerCase()}.${tag}@contoh.go.id` } })
    await db.material.create({ data: { seminarId: s.id, presenter: 'Dr. Sari Utami', driveUrl: 'https://drive.google.com/drive/folders/contoh' } })
    if (tag === 'a')
      await db.news.create({ data: { seminarId: s.id, authorId: nabila.id, title: `Dokumentasi: ${title}`, body: 'Seminar berlangsung lancar dan dihadiri peserta dari berbagai unit kerja.' } })
  }
  console.log('Seed selesai. Masuk dengan admin@bmkg.go.id atau nabila.putri@bmkg.go.id, sandi Sinar#2026')
}
main().finally(() => db.$disconnect())

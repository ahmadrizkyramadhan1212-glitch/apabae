// Aturan bentrok jadwal (SPEC bagian 3): hanya lokasi PHYSICAL, rentang waktu tumpang tindih,
// dan hanya status yang mengunci jadwal. DIKEMBALIKAN dan DIBATALKAN tidak mengunci.
import { db } from '../db.js'
import type { SeminarStatus } from '@prisma/client'

export const STATUS_MENGUNCI: SeminarStatus[] = ['MENUNGGU_VERIFIKASI', 'DIJADWALKAN', 'BERLANGSUNG', 'SELESAI']

export function waktuTumpangTindih(aMulai: string, aSelesai: string, bMulai: string, bSelesai: string): boolean {
  return aMulai < bSelesai && bMulai < aSelesai
}

export interface CekBentrok {
  locationId: string
  tanggal: Date
  mulai: string
  selesai: string
  abaikanSeminarId?: string
}

// Mengembalikan daftar seminar yang bentrok (kosong = bebas)
export async function cekBentrok({ locationId, tanggal, mulai, selesai, abaikanSeminarId }: CekBentrok) {
  const lokasi = await db.location.findUnique({ where: { id: locationId } })
  if (!lokasi || lokasi.type !== 'PHYSICAL') return []

  // Tanggal dinormalkan ke tengah malam UTC (kolom DATE) dan dicocokkan PERSIS: seminar hari lain tidak ikut dihitung
  const hari = new Date(`${tanggal.toISOString().slice(0, 10)}T00:00:00.000Z`)

  const kandidat = await db.seminar.findMany({
    where: {
      locationId,
      status: { in: STATUS_MENGUNCI },
      date: hari,
      ...(abaikanSeminarId && { id: { not: abaikanSeminarId } }),
    },
    select: { id: true, title: true, startTime: true, endTime: true, status: true },
  })
  return kandidat.filter((k) => waktuTumpangTindih(mulai, selesai, k.startTime, k.endTime))
}

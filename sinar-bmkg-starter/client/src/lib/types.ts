// Tipe data yang dikirim API.
export interface Lokasi {
  id: string
  key: string
  name: string
  type: 'PHYSICAL' | 'ONLINE' | 'OTHER'
  capacity: number | null
  facilities: string | null
}

export interface Berkas {
  id: string
  kind: 'SURAT_IZIN' | 'POSTER' | 'LAINNYA'
  originalName: string
  mime: string
  sizeBytes: number
}

export interface Seminar {
  id: string
  code: string
  title: string
  topic: string | null
  date: string
  startTime: string
  endTime: string
  status: 'MENUNGGU_VERIFIKASI' | 'DIKEMBALIKAN' | 'DIJADWALKAN' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN'
  returnReason: string | null
  letterReceived: boolean
  attendToken: string
  attendCodeOn: boolean
  attendCode: string | null
  locationId: string
  locationOther: string | null
  location: Lokasi
  files: Berkas[]
  user?: { name: string; nip: string; unit: string | null }
  certPageMode?: string
  certGeneratedAt?: string | null
}

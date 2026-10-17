// Form seminar 3 langkah (Jadwal → Detail → Lampiran) dengan indikator bentrok langsung.
// Dipakai untuk Buat Seminar dan Edit (bila bisaSemua=false, bagian jadwal dikunci).
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { get, post, patch } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Lokasi, Seminar } from '../lib/types'
import { Loading } from './ui'

const MB = 1024 * 1024

export function indikatorBentrokSemua(mulai: string, selesai: string): string | null {
  if (!mulai || !selesai) return null
  if (mulai >= selesai) return 'Jam selesai harus setelah jam mulai'
  return null
}

interface Nilai {
  locationId: string
  locationOther: string
  date: string
  startTime: string
  endTime: string
  title: string
  topic: string
}

export default function SeminarForm({
  seminar,
  bisaSemua,
  selesai,
}: {
  seminar?: Seminar // bila ada berarti mode edit
  bisaSemua: boolean // boleh mengubah jadwal/lokasi/dokumen
  selesai: (pesan: string) => void
}) {
  const { me } = useAuth()
  const [cariParams] = useSearchParams()
  const [langkah, setLangkah] = useState(1)
  const [lokasi, setLokasi] = useState<Lokasi[] | null>(null)
  // Prefill dari klik slot timeline: ?lokasi=..&tanggal=..&mulai=..
  const awal = !seminar
    ? {
        locationId: cariParams.get('lokasi') ?? '',
        date: cariParams.get('tanggal') ?? '',
        startTime: cariParams.get('mulai') ?? '',
        endTime: '',
      }
    : null
  const [f, setF] = useState<Nilai>({
    locationId: seminar?.locationId ?? awal?.locationId ?? '',
    locationOther: seminar?.locationOther ?? '',
    date: seminar?.date.slice(0, 10) ?? awal?.date ?? '',
    startTime: seminar?.startTime ?? awal?.startTime ?? '',
    endTime: seminar?.endTime ?? '',
    title: seminar?.title ?? '',
    topic: seminar?.topic ?? '',
  })
  const [surat, setSurat] = useState<File | null>(null)
  const [poster, setPoster] = useState<File | null>(null)
  const [bentrok, setBentrok] = useState<string | null>(null)
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  useEffect(() => {
    void get<Lokasi[]>('/api/seminars/locations').then(setLokasi).catch(() => setLokasi([]))
  }, [])

  // Cek bentrok langsung (debounce 500 ms) tiap jadwal berubah — hanya untuk lokasi fisik
  useEffect(() => {
    if (!bisaSemua || !f.locationId || !f.date || !f.startTime || !f.endTime) return setBentrok(null)
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ locationId: f.locationId, date: f.date, start: f.startTime, end: f.endTime, ...(seminar && { abaikan: seminar.id }) })
        const r = await get<{ bentrok: { title: string; startTime: string; endTime: string }[] }>(`/api/seminars/bentrok?${q}`)
        setBentrok(r.bentrok.length ? `Bentrok dengan "${r.bentrok[0].title}" (${r.bentrok[0].startTime}–${r.bentrok[0].endTime})` : null)
      } catch {
        setBentrok(null)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [f.locationId, f.date, f.startTime, f.endTime, bisaSemua, seminar])

  if (!lokasi) return <Loading />
  const lokasiPilih = lokasi.find((l) => l.id === f.locationId)
  const fisik = lokasiPilih?.type === 'PHYSICAL'

  const validasiLangkah = (n: number): string | null => {
    if (n === 1) {
      if (!f.locationId) return 'Pilih lokasi terlebih dahulu'
      if (lokasiPilih?.type === 'OTHER' && !f.locationOther.trim()) return 'Tuliskan nama lokasi untuk pilihan Lainnya'
      if (!f.date) return 'Pilih tanggal'
      if (!f.startTime || !f.endTime) return 'Isi jam mulai dan jam selesai'
      if (f.startTime >= f.endTime) return 'Jam selesai harus setelah jam mulai'
    }
    if (n === 2 && f.title.trim().length < 5) return 'Judul minimal 5 karakter'
    return null
  }

  const lanjut = () => {
    const g = validasiLangkah(langkah)
    if (g) return setGalat(g)
    setGalat('')
    setLangkah((l) => Math.min(3, l + 1))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    for (const n of [1, 2]) {
      const g = validasiLangkah(n)
      if (g) return setGalat(g)
    }
    if (!seminar && !surat) return setGalat('Surat izin wajib dilampirkan (PDF/JPG/PNG/DOC/DOCX, maks 5 MB)')
    setGalat('')
    setProses(true)
    try {
      if (seminar) {
        const data: Record<string, string> = { title: f.title, topic: f.topic }
        if (bisaSemua) Object.assign(data, { locationId: f.locationId, locationOther: f.locationOther, date: f.date, startTime: f.startTime, endTime: f.endTime })
        await patch(`/api/seminars/${seminar.id}`, data)
        selesai('Perubahan tersimpan')
      } else {
        const fd = new FormData()
        Object.entries(f).forEach(([k, v]) => fd.append(k, v))
        if (surat) fd.append('surat', surat)
        if (poster) fd.append('poster', poster)
        await post('/api/seminars', fd)
        selesai('Seminar diajukan dan menunggu verifikasi admin')
      }
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setProses(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="steps" aria-label="Langkah pengisian">
        {['1. Jadwal', '2. Detail', '3. Lampiran'].map((s, i) => (
          <span key={s} className={langkah === i + 1 ? 'on' : langkah > i + 1 ? 'dn' : ''}>
            {s}
          </span>
        ))}
      </div>

      {langkah === 1 && (
        <fieldset disabled={!bisaSemua} style={{ border: 0, padding: 0 }}>
          {!bisaSemua && (
            <p className="hint" style={{ marginBottom: 10 }}>
              Jadwal dan lokasi terkunci pada status ini. Untuk mengubahnya, batalkan seminar lalu buat baru.
            </p>
          )}
          <label htmlFor="sf-lokasi">Lokasi</label>
          <select id="sf-lokasi" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })} required>
            <option value="">— Pilih lokasi —</option>
            {lokasi.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.capacity ? ` (${l.capacity} orang)` : ''}
              </option>
            ))}
          </select>
          {lokasiPilih?.type === 'OTHER' && (
            <>
              <label htmlFor="sf-lain">Tuliskan lokasi</label>
              <input id="sf-lain" value={f.locationOther} onChange={(e) => setF({ ...f, locationOther: e.target.value })} placeholder="contoh: Ruang Serbaguna BMKG Stasiun Citeko" />
            </>
          )}
          {f.locationId && (
            <p className="fc">
              <span>{lokasiPilih?.type === 'PHYSICAL' ? 'Ruang fisik — jadwal dicek bentrok' : lokasiPilih?.type === 'ONLINE' ? 'Online — tidak dicek bentrok' : 'Lokasi bebas'}</span>
              {lokasiPilih?.facilities && <span>{lokasiPilih.facilities}</span>}
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="sf-tanggal">Tanggal</label>
              <input id="sf-tanggal" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="sf-mulai">Jam mulai (WIB)</label>
              <input id="sf-mulai" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="sf-selesai">Jam selesai (WIB)</label>
              <input id="sf-selesai" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} required />
            </div>
          </div>
          {fisik && bisaSemua && bentrok && (
            <div className="ind no" role="alert">
              ⚠ Jadwal bentrok: {bentrok}
            </div>
          )}
          {fisik && bisaSemua && !bentrok && f.date && f.startTime && f.endTime && (
            <div className="ind ok">✓ Jadwal bebas — tidak bentrok</div>
          )}
          {fisik && bisaSemua && indikatorBentrokSemua(f.startTime, f.endTime) && <div className="ind no">{indikatorBentrokSemua(f.startTime, f.endTime)}</div>}
        </fieldset>
      )}

      {langkah === 2 && (
        <fieldset style={{ border: 0, padding: 0 }}>
          <label htmlFor="sf-judul">Judul seminar</label>
          <input id="sf-judul" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} minLength={5} required placeholder="contoh: Analisis Pola Curah Hujan Ekstrem 2026" />
          <label htmlFor="sf-topik">Topik / abstrak singkat</label>
          <textarea id="sf-topik" rows={4} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Tujuan, metode, dan hasil utama yang akan dipresentasikan" />
        </fieldset>
      )}

      {langkah === 3 && (
        <fieldset disabled={!!seminar} style={{ border: 0, padding: 0 }}>
          {seminar && (
            <p className="hint" style={{ marginBottom: 10 }}>
              Untuk mengunggah ulang surat/poster, gunakan tombol unggah di halaman detail saat status Dikembalikan.
            </p>
          )}
          <label htmlFor="sf-surat">Surat izin (wajib) — PDF/JPG/PNG/DOC/DOCX, maks 5 MB</label>
          <input
            id="sf-surat"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              if (file && file.size > 5 * MB) {
                setGalat('Ukuran surat melebihi 5 MB')
                e.target.value = ''
                return setSurat(null)
              }
              setGalat('')
              setSurat(file)
            }}
            required={!seminar}
          />
          <label htmlFor="sf-poster">Poster (opsional) — JPG/PNG/WEBP/PDF, maks 5 MB</label>
          <input
            id="sf-poster"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              if (file && file.size > 5 * MB) {
                setGalat('Ukuran poster melebihi 5 MB')
                e.target.value = ''
                return setPoster(null)
              }
              setGalat('')
              setPoster(file)
            }}
          />
          {surat && (
            <p className="fc">
              <span>Surat: {surat.name}</span>
              <span>{(surat.size / MB).toFixed(2)} MB</span>
            </p>
          )}
        </fieldset>
      )}

      {galat && (
        <p className="err" role="alert">
          {galat}
        </p>
      )}
      <div className="dn" style={{ marginTop: 16 }}>
        {langkah > 1 && (
          <button type="button" className="btn" onClick={() => setLangkah((l) => l - 1)}>
            ← Kembali
          </button>
        )}
        {langkah < 3 && (
          <button type="button" className="btn pr" onClick={lanjut}>
            Lanjut →
          </button>
        )}
        {langkah === 3 && (
          <button className="btn pr" disabled={proses}>
            {proses ? 'Menyimpan…' : seminar ? 'Simpan perubahan' : 'Ajukan Seminar'}
          </button>
        )}
        {me && langkah === 3 && !seminar && <span className="hint">Pengajuan langsung diverifikasi oleh admin unit.</span>}
      </div>
    </form>
  )
}

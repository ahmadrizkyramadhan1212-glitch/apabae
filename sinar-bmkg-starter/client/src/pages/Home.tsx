// Beranda: hero + Timeline Seminar (navigasi hari; bulan & pilih tanggal untuk user login)
// + daftar Seminar Mendatang. Pengunjung hanya ganti hari dan "Hari ini".
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../lib/api'
import { useAuth } from '../lib/auth'
import Timeline from '../components/Timeline'
import { Loading, ErrorBox, Empty, fmtTanggalPendek } from '../components/ui'
import type { Lokasi, Seminar } from '../lib/types'

interface Item extends Seminar {
  milik: boolean
}

const hariWIB = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Home() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [tanggal, setTanggal] = useState(hariWIB)
  const [data, setData] = useState<{ lokasi: Lokasi[]; seminar: Item[] } | null>(null)
  const [galat, setGalat] = useState('')
  const [memuat, setMemuat] = useState(false)
  const [mendatang, setMendatang] = useState<Seminar[] | null>(null)

  const muat = useCallback(async (t: string) => {
    setMemuat(true)
    setGalat('')
    try {
      setData(await get(`/api/publik/timeline?date=${t}`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat timeline')
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muat(tanggal)
  }, [tanggal, muat])

  useEffect(() => {
    void get<Seminar[]>('/api/publik/mendatang').then(setMendatang).catch(() => setMendatang([]))
  }, [])

  const geserHari = (n: number) => {
    const d = new Date(`${tanggal}T00:00:00`)
    d.setDate(d.getDate() + n)
    setTanggal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  const label = new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <main>
      <div className="hero card" style={{ padding: 26, marginBottom: 16 }}>
        <h2>Selamat datang di SINAR BMKG</h2>
        <p style={{ margin: '6px 0 4px', maxWidth: 560, opacity: 0.92 }}>
          Lihat jadwal seminar ilmiah unit kerja, ajukan seminar Anda, dan ikut absensi — semuanya dalam satu tempat.
        </p>
        {me && me.role === 'USER' && (
          <button className="btn pr" style={{ marginTop: 10 }} onClick={() => navigate('/seminar/baru')}>
            + Buat Seminar
          </button>
        )}
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="dn" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3>Timeline Seminar</h3>
          <div className="dn">
            <div className="seg" role="group" aria-label="Navigasi hari">
              <button onClick={() => geserHari(-1)} aria-label="Hari sebelumnya">‹</button>
              <b>{label}</b>
              <button onClick={() => geserHari(1)} aria-label="Hari berikutnya">›</button>
            </div>
            {me && (
              <>
                <input type="date" className="cal" value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} aria-label="Pilih tanggal" style={{ width: 160, height: 42 }} />
                <button className="today" onClick={() => setTanggal(hariWIB())}>
                  Hari ini
                </button>
              </>
            )}
            {!me && (
              <button className="today" onClick={() => setTanggal(hariWIB())}>
                Hari ini
              </button>
            )}
          </div>
        </div>
        {galat && <ErrorBox message={galat} onCobaLagi={() => muat(tanggal)} />}
        {!galat && (memuat || !data) ? <Loading /> : data && <Timeline tanggal={tanggal} lokasi={data.lokasi} seminar={data.seminar} />}
        {!me && <p className="hint" style={{ marginTop: 10 }}>Masuk untuk mengajukan seminar pada slot kosong dan mengganti bulan.</p>}
      </section>

      <section className="card upc">
        <h3 style={{ marginBottom: 10 }}>Seminar Mendatang</h3>
        {mendatang === null ? (
          <Loading />
        ) : mendatang.length === 0 ? (
          <Empty title="Belum ada seminar mendatang" hint="Seminar yang telah disetujui admin akan tampil di sini." />
        ) : (
          <div className="g3">
            {mendatang.map((s) => (
              <Link to={`/seminar-publik/${s.id}`} key={s.id} className="card" style={{ display: 'block' }}>
                <b style={{ display: 'block', marginBottom: 4 }}>{s.title}</b>
                <span className="hint">
                  {fmtTanggalPendek(s.date)} · {s.startTime}–{s.endTime} WIB · {s.locationOther ?? s.location.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

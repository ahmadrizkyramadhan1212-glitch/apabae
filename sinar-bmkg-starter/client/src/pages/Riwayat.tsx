// Riwayat Seminar publik: daftar SELESAI dan DIBATALKAN dengan lencana status.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../lib/api'
import { Loading, Empty, ErrorBox, Badge, fmtTanggal } from '../components/ui'
import type { Seminar } from '../lib/types'

interface Halaman {
  data: Seminar[]
  total: number
  halaman: number
  totalHalaman: number
}

export default function Riwayat() {
  const [h, setH] = useState<Halaman | null>(null)
  const [galat, setGalat] = useState('')
  const [halaman, setHalaman] = useState(1)

  useEffect(() => {
    setH(null)
    get<Halaman>(`/api/publik/riwayat?halaman=${halaman}`).then(setH).catch((e) => setGalat(e instanceof Error ? e.message : 'Gagal memuat riwayat'))
  }, [halaman])

  return (
    <main>
      <h1 style={{ margin: '6px 0 16px' }}>Riwayat Seminar</h1>
      <div className="card">
        {galat && <ErrorBox message={galat} onCobaLagi={() => setHalaman(1)} />}
        {!galat && !h && <Loading />}
        {!galat && h?.data.length === 0 && <Empty title="Belum ada riwayat" hint="Seminar yang selesai atau dibatalkan akan tampil di sini." />}
        {h && h.data.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Judul</th>
                  <th>Lokasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {h.data.map((s) => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtTanggal(s.date)}</td>
                    <td>
                      <Link to={`/seminar-publik/${s.id}`}>{s.title}</Link>
                    </td>
                    <td>{s.locationOther ?? s.location.name}</td>
                    <td>
                      <Badge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {h && h.totalHalaman > 1 && (
          <div className="dn" style={{ marginTop: 12, justifyContent: 'center' }}>
            <button className="btn sm" disabled={halaman <= 1} onClick={() => setHalaman((p) => p - 1)}>
              ‹ Sebelumnya
            </button>
            <span className="hint">
              Halaman {h.halaman} dari {h.totalHalaman}
            </span>
            <button className="btn sm" disabled={halaman >= h.totalHalaman} onClick={() => setHalaman((p) => p + 1)}>
              Berikutnya ›
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

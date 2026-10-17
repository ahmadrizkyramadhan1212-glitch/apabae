// Halaman: Seminar Saya — daftar, cari, filter status, lencana merah untuk yang dikembalikan.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../lib/api'
import { Loading, Empty, ErrorBox, Badge, fmtTanggalPendek } from '../components/ui'
import type { Seminar } from '../lib/types'

const STATUS_FILTER = [
  ['', 'Semua status'],
  ['MENUNGGU_VERIFIKASI', 'Menunggu verifikasi'],
  ['DIKEMBALIKAN', 'Dikembalikan'],
  ['DIJADWALKAN', 'Dijadwalkan'],
  ['BERLANGSUNG', 'Berlangsung'],
  ['SELESAI', 'Selesai'],
  ['DIBATALKAN', 'Dibatalkan'],
]

export default function SeminarSaya() {
  const [data, setData] = useState<Seminar[] | null>(null)
  const [galat, setGalat] = useState('')
  const [cari, setCari] = useState('')
  const [status, setStatus] = useState('')
  const navigate = useNavigate()

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const q = new URLSearchParams({ ...(cari && { cari }), ...(status && { status }) })
      setData(await get<Seminar[]>(`/api/seminars/mine?${q}`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat seminar')
    }
  }, [cari, status])

  useEffect(() => {
    void muat()
  }, [muat])

  return (
    <>
      <div className="top">
        <div>
          <h1 className="dn">
            Seminar Saya
            {data?.some((s) => s.status === 'DIKEMBALIKAN') && <span className="bgred bd Dikembalikan" style={{ marginLeft: 10 }}>Ada dikembalikan</span>}
          </h1>
          <p>Semua pengajuan seminar Anda beserta statusnya.</p>
        </div>
        <button className="btn pr" onClick={() => navigate('/seminar/baru')}>
          + Buat Seminar
        </button>
      </div>
      <div className="card">
        <div className="dn" style={{ marginBottom: 10 }}>
          <input style={{ maxWidth: 260 }} placeholder="Cari judul, topik, atau kode…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari seminar" />
          <select style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
            {STATUS_FILTER.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && data === null && <Loading />}
        {!galat && data?.length === 0 && <Empty title="Belum ada seminar" hint="Tekan tombol + Buat Seminar untuk mengajukan yang pertama." />}
        {data && data.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Judul</th>
                  <th>Jadwal</th>
                  <th>Lokasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/seminar/${s.id}`)}>
                    <td>
                      <strong>{s.code}</strong>
                    </td>
                    <td>
                      <Link to={`/seminar/${s.id}`} onClick={(e) => e.stopPropagation()}>
                        {s.title}
                      </Link>
                      {s.status === 'DIKEMBALIKAN' && s.returnReason && (
                        <>
                          <br />
                          <span className="hint">Alasan: {s.returnReason}</span>
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {fmtTanggalPendek(s.date)}
                      <br />
                      <span className="hint">
                        {s.startTime}–{s.endTime} WIB
                      </span>
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
      </div>
    </>
  )
}

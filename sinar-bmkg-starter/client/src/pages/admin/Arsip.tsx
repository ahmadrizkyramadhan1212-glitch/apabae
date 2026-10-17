// Halaman admin: Arsip & Riwayat — seminar SELESAI dan DIBATALKAN.
import { useCallback, useEffect, useState } from 'react'
import { get } from '../../lib/api'
import { Loading, Empty, ErrorBox, Badge, fmtTanggalPendek } from '../../components/ui'
import type { Seminar } from '../../lib/types'

export default function Arsip() {
  const [data, setData] = useState<(Seminar & { user: { name: string } })[] | null>(null)
  const [galat, setGalat] = useState('')

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const [selesai, batal] = await Promise.all([
        get<(Seminar & { user: { name: string } })[]>('/api/admin/seminars?status=SELESAI'),
        get<(Seminar & { user: { name: string } })[]>('/api/admin/seminars?status=DIBATALKAN'),
      ])
      setData([...selesai, ...batal].sort((a, b) => b.date.localeCompare(a.date)))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat arsip')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  return (
    <>
      <div className="top">
        <div>
          <h1>Arsip &amp; Riwayat</h1>
          <p>Seminar yang telah selesai atau dibatalkan.</p>
        </div>
      </div>
      <div className="card">
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && data === null && <Loading />}
        {!galat && data?.length === 0 && <Empty title="Belum ada arsip" />}
        {data && data.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Judul</th>
                  <th>Pemilik</th>
                  <th>Tanggal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.code}</strong></td>
                    <td>{s.title}</td>
                    <td>{s.user.name}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtTanggalPendek(s.date)}</td>
                    <td><Badge status={s.status} /></td>
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

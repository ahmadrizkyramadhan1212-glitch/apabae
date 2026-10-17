// Halaman user: Hasil Seminar — tabel seminar SELESAI: Berita (Tayang/Belum), Materi (jumlah),
// Peserta (jumlah) + tombol cepat ke tab terkait. Lencana merah header bila ada yang belum punya berita.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../lib/api'
import { Loading, Empty, ErrorBox, fmtTanggalPendek } from '../components/ui'

interface Hasil {
  id: string
  code: string
  title: string
  date: string
  berita: { id: string; judul: string } | null
  materiJumlah: number
  pesertaJumlah: number
}

export default function HasilSeminar() {
  const [data, setData] = useState<Hasil[] | null>(null)
  const [galat, setGalat] = useState('')
  const navigate = useNavigate()

  const muat = useCallback(async () => {
    setGalat('')
    try {
      setData(await get<Hasil[]>('/api/konten/hasil'))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat hasil seminar')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const belumBerita = data?.some((s) => !s.berita) ?? false

  return (
    <>
      <div className="top">
        <div>
          <h1 className="dn">
            Hasil Seminar
            {belumBerita && <span className="bgred bd Dikembalikan" style={{ marginLeft: 10 }}>Ada seminar belum berita</span>}
          </h1>
          <p>Seminar yang telah selesai beserta kelengkapannya (berita, materi, sertifikat).</p>
        </div>
        <button className="btn pr" onClick={() => navigate('/seminar/baru')}>
          + Buat Seminar
        </button>
      </div>
      <div className="card">
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && data === null && <Loading />}
        {!galat && data?.length === 0 && <Empty title="Belum ada seminar selesai" hint="Hasil tampil setelah Anda menekan tombol selesai pada seminar yang berlangsung." />}
        {data && data.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Judul</th>
                  <th>Tanggal</th>
                  <th>Berita</th>
                  <th>Materi</th>
                  <th>Peserta</th>
                  <th>Sertifikat</th>
                  <th>Aksi cepat</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.title}</strong>
                      <br />
                      <span className="hint">{s.code}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtTanggalPendek(s.date)}</td>
                    <td>
                      {s.berita ? <span className="bd Berlangsung">Tayang</span> : <span className="bd Dibatalkan">Belum</span>}
                    </td>
                    <td>{s.materiJumlah} berkas</td>
                    <td>{s.pesertaJumlah} orang</td>
                    <td>
                      <span className="hint">Belum</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn sm" onClick={() => navigate(`/seminar/${s.id}`, { state: { tab: s.berita ? 'berita' : 'berita' } })}>
                          {s.berita ? 'Lihat berita' : 'Tulis berita'}
                        </button>
                        <button className="btn sm" onClick={() => navigate(`/seminar/${s.id}`, { state: { tab: 'materi' } })}>
                          Materi
                        </button>
                        <button className="btn sm" onClick={() => navigate(`/seminar/${s.id}`, { state: { tab: 'sertifikat' } })}>
                          Sertifikat
                        </button>
                      </div>
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

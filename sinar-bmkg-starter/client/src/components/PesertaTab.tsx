// Tab Peserta & Absensi: QR + tautan absensi, kode hadir 6 digit, daftar hadir + jumlah.
// Admin juga dapat menambah peserta manual dan menghapus.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { get, post, del } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Loading, Empty, ErrorBox } from './ui'
import type { Seminar } from '../lib/types'

interface Peserta {
  id: string
  name: string
  nip: string
  email: string
  source: string
  createdAt: string
}

export default function PesertaTab({ seminar, berubah }: { seminar: Seminar; berubah: () => void }) {
  const { me } = useAuth()
  const [peserta, setPeserta] = useState<Peserta[] | null>(null)
  const [galat, setGalat] = useState('')
  const [kodeAktif, setKodeAktif] = useState(seminar.attendCodeOn)
  const [kode, setKode] = useState(seminar.attendCode ?? '')

  const muat = useCallback(async () => {
    try {
      setPeserta(await get<Peserta[]>(`/api/absensi/${seminar.id}/peserta`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat peserta')
    }
  }, [seminar.id])

  useEffect(() => {
    void muat()
  }, [muat])

  const aturKode = async (aktif: boolean) => {
    try {
      const r = await post<{ aktif: boolean; kode: string | null }>(`/api/absensi/${seminar.id}/kode-hadir`, { aktif })
      setKodeAktif(r.aktif)
      setKode(r.kode ?? '')
      berubah()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengatur kode hadir')
    }
  }

  const link = `${window.location.origin}/absen/${seminar.attendToken}`

  return (
    <div className="cols">
      <div className="card">
        <h3>Daftar Hadir</h3>
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && peserta === null && <Loading />}
        {!galat && peserta?.length === 0 && <Empty title="Belum ada peserta" hint="Peserta mengisi absensi lewat QR atau ditambahkan admin." />}
        {peserta && peserta.length > 0 && (
          <>
            <p style={{ margin: '8px 0' }}>
              <b>{peserta.length}</b> peserta tercatat.
            </p>
            <div className="sc">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Email</th>
                    <th>Sumber</th>
                    {me?.role === 'ADMIN' && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {peserta.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.nip}</td>
                      <td>{p.email}</td>
                      <td>
                        <span className="bd Menunggu">{p.source}</span>
                      </td>
                      {me?.role === 'ADMIN' && (
                        <td>
                          <button
                            className="btn sm dgr"
                            onClick={async () => {
                              if (!confirm(`Hapus peserta ${p.name}?`)) return
                              await del(`/api/absensi/peserta/${p.id}`).catch((e) => alert(e.message))
                              void muat()
                            }}
                          >
                            Hapus
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <a className="btn" style={{ marginTop: 12 }} href={`/api/absensi/${seminar.id}/peserta.csv`} download>
          ⬇ Unduh daftar hadir (CSV)
        </a>
        {me?.role === 'ADMIN' && <TambahManual seminarId={seminar.id} selesai={() => { void muat(); berubah() }} />}
      </div>

      <div className="card">
        <h3>Absensi Peserta</h3>
        <p className="hint">Tampilkan QR ini di layar ruangan saat seminar berlangsung. Peserta memindai dengan HP sendiri.</p>
        <div className="qrbox" style={{ marginTop: 10 }}>
          <img src={`/api/absensi/${seminar.id}/qr`} alt="QR absensi" width={200} height={200} />
        </div>
        <p style={{ marginTop: 10, wordBreak: 'break-all' }}>
          <a href={link} target="_blank" rel="noreferrer">{link}</a>
        </p>
        <button
          className="btn sm"
          onClick={() => {
            void navigator.clipboard.writeText(link)
            alert('Tautan absensi disalin')
          }}
        >
          Salin tautan
        </button>

        <h3 style={{ marginTop: 18 }}>Kode hadir 6 digit (opsional)</h3>
        {seminar.status === 'BERLANGSUNG' ? (
          <>
            <p className="hint">Aktifkan agar peserta wajib menuliskan kode yang tampil di layar (mencegah absen dari luar ruangan).</p>
            <div className="dn" style={{ marginTop: 8 }}>
              {!kodeAktif ? (
                <button className="btn pr" onClick={() => aturKode(true)}>
                  Aktifkan kode hadir
                </button>
              ) : (
                <>
                  <span className="cap" style={{ fontSize: 22, letterSpacing: 4 }}>
                    <b>{kode}</b>
                  </span>
                  <button className="btn" onClick={() => aturKode(true)}>
                    Buat kode baru
                  </button>
                  <button className="btn dgr" onClick={() => aturKode(false)}>
                    Matikan
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="hint">Kode hadir hanya dapat diatur saat seminar berlangsung. {seminar.attendCodeOn && 'Kode sempat diaktifkan.'}</p>
        )}
      </div>
    </div>
  )
}

function TambahManual({ seminarId, selesai }: { seminarId: string; selesai: () => void }) {
  const [buka, setBuka] = useState(false)
  const [f, setF] = useState({ nama: '', nip: '', email: '' })
  const [galat, setGalat] = useState('')

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    try {
      await post(`/api/absensi/${seminarId}/peserta`, f)
      setBuka(false)
      setF({ nama: '', nip: '', email: '' })
      selesai()
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menambah peserta')
    }
  }

  if (!buka) {
    return (
      <button className="btn" style={{ marginTop: 14 }} onClick={() => setBuka(true)}>
        + Tambah peserta manual
      </button>
    )
  }
  return (
    <form onSubmit={kirim} style={{ marginTop: 14 }}>
      <label htmlFor="tm-nama">Nama</label>
      <input id="tm-nama" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} required minLength={3} />
      <label htmlFor="tm-nip">NIP</label>
      <input id="tm-nip" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} required pattern="\d{6,20}" />
      <label htmlFor="tm-email">Email</label>
      <input id="tm-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
      {galat && <p className="err" role="alert">{galat}</p>}
      <div className="dn" style={{ marginTop: 10 }}>
        <button className="btn pr">Simpan</button>
        <button type="button" className="btn" onClick={() => setBuka(false)}>
          Batal
        </button>
      </div>
    </form>
  )
}

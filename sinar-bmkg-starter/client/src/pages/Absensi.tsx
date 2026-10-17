// Halaman publik absensi /absen/:token — aktif hanya saat BERLANGSUNG. Mobile-first.
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { get, post } from '../lib/api'
import { Loading, ErrorBox, fmtTanggal } from '../components/ui'
import { Logo } from '../components/Logo'

interface Info {
  seminar: {
    id: string
    title: string
    status: string
    attendCodeOn: boolean
    date: string
    startTime: string
    endTime: string
    location: { name: string }
  }
  bisaAbsen: boolean
}

export default function Absensi() {
  const { token } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [galat, setGalat] = useState('')
  const [ok, setOk] = useState('')
  const [proses, setProses] = useState(false)
  const [f, setF] = useState({ nama: '', nip: '', email: '', kode: '' })
  const [setuju, setSetuju] = useState(false)

  useEffect(() => {
    get<Info>(`/api/absensi/t/${token}`).then(setInfo).catch((e) => setGalat(e instanceof Error ? e.message : 'Gagal memuat'))
  }, [token])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    setProses(true)
    try {
      await post(`/api/absensi/t/${token}`, { ...f, setuju })
      setOk('Kehadiran Anda tercatat. Terima kasih!')
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mengirim absensi')
    } finally {
      setProses(false)
    }
  }

  if (galat && !info) {
    return (
      <div className="ph">
        <div className="card" style={{ textAlign: 'center' }}>
          <Logo height={54} />
          <ErrorBox message={galat} />
          <p className="hint">Periksa kembali tautan atau tanyakan panitia di ruangan.</p>
        </div>
      </div>
    )
  }
  if (!info) return <Loading />
  const { seminar, bisaAbsen } = info

  return (
    <div className="ph">
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <Logo height={54} />
          <h2 style={{ marginTop: 6 }}>Absensi Seminar</h2>
          <p className="hint">
            {fmtTanggal(seminar.date, true)} · {seminar.startTime}–{seminar.endTime} WIB · {seminar.location.name}
          </p>
        </div>
        <h3>{seminar.title}</h3>

        {!bisaAbsen ? (
          <div className="ind no" role="alert" style={{ marginTop: 12 }}>
            {seminar.status === 'SELESAI' ? 'Absensi sudah ditutup — seminar telah selesai.' : 'Absensi belum dibuka. Seminar belum berlangsung.'}
          </div>
        ) : ok ? (
          <div className="ind ok" role="status">
            ✓ {ok}
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="ab-nama">Nama lengkap</label>
            <input id="ab-nama" value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} required minLength={3} autoComplete="name" />
            <label htmlFor="ab-nip">NIP</label>
            <input id="ab-nip" inputMode="numeric" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value.replace(/\D/g, '') })} required pattern="\d{6,20}" title="6-20 angka" autoComplete="off" />
            <label htmlFor="ab-email">Email</label>
            <input id="ab-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" />
            {seminar.attendCodeOn && (
              <>
                <label htmlFor="ab-kode">Kode hadir (lihat layar di ruangan)</label>
                <input id="ab-kode" inputMode="numeric" value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value.replace(/\D/g, '') })} maxLength={6} required autoComplete="off" />
              </>
            )}
            <div className="rm">
              <input id="ab-setuju" type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} required />
              <label htmlFor="ab-setuju" style={{ margin: 0, fontWeight: 500 }}>
                Saya setuju data pribadi saya diproses untuk keperluan absensi seminar ini.
              </label>
            </div>
            {galat && (
              <p className="err" role="alert">
                {galat}
              </p>
            )}
            <button className="btn pr" style={{ width: '100%', marginTop: 14, padding: 12 }} disabled={proses}>
              {proses ? 'Mengirim…' : 'Kirim Absensi'}
            </button>
          </form>
        )}
        <p className="hint" style={{ marginTop: 14, textAlign: 'center' }}>
          Satu email dan satu NIP hanya dapat absen sekali per seminar.
        </p>
      </div>
    </div>
  )
}

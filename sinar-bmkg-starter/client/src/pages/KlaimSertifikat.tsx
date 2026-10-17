// Halaman publik: Klaim Sertifikat — peserta mengunduh PDF dengan email + NIP yang
// dicocokkan dengan data absensi (cadangan bila email tidak sampai). Dibatasi laju.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Logo } from '../components/Logo'

export default function KlaimSertifikat() {
  const [email, setEmail] = useState('')
  const [nip, setNip] = useState('')
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setProses(true)
    setGalat('')
    try {
      const blob = await api<Blob>('/api/sertifikat/klaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nip }),
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sertifikat.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mengklaim sertifikat')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="lgw">
      <div className="card" style={{ maxWidth: 440 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <Logo height={52} />
          <div>
            <h2>Klaim Sertifikat</h2>
            <p className="hint">Sistem Informasi Seminar Ilmiah</p>
          </div>
        </div>
        <form onSubmit={kirim}>
          <label htmlFor="kl-email">Email saat absensi</label>
          <input id="kl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nama@bmkg.go.id" autoComplete="email" />
          <label htmlFor="kl-nip">NIP</label>
          <input id="kl-nip" value={nip} onChange={(e) => setNip(e.target.value)} required inputMode="numeric" placeholder="199001012005011001" autoComplete="off" />
          {galat && <p className="err" role="alert">{galat}</p>}
          <button className="btn pr" style={{ width: '100%', marginTop: 14 }} disabled={proses}>
            {proses ? 'Mencari…' : 'Unduh Sertifikat'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          Email dan NIP harus cocok dengan isian absensi Anda. · <Link to="/verifikasi">Verifikasi Sertifikat</Link> · <Link to="/">Beranda</Link>
        </p>
      </div>
    </div>
  )
}

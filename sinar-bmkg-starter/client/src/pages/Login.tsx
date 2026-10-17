// Halaman masuk: NIP atau email + kata sandi + "Ingat saya".
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'

export default function Login() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [id, setId] = useState('')
  const [sandi, setSandi] = useState('')
  const [ingat, setIngat] = useState(false)
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    setProses(true)
    try {
      const me = await post<{ role: 'ADMIN' | 'USER' }>('/api/auth/login', { id, password: sandi, ingat })
      await refresh()
      const ke = (location.state as { dari?: string } | null)?.dari ?? (me.role === 'ADMIN' ? '/admin' : '/')
      navigate(ke, { replace: true })
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal masuk')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="lgw">
      <div className="card" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <Logo height={52} />
          <div>
            <h2>SINAR BMKG</h2>
            <p className="hint">Sistem Informasi Seminar Ilmiah</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="login-id">NIP atau email dinas</label>
          <input
            id="login-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="contoh: 199505052020122001"
            autoComplete="username"
            required
          />
          <label htmlFor="login-sandi">Kata sandi</label>
          <input
            id="login-sandi"
            type="password"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="rm">
            <input id="ingat" type="checkbox" checked={ingat} onChange={(e) => setIngat(e.target.checked)} />
            <label htmlFor="ingat" style={{ margin: 0, fontWeight: 500 }}>
              Ingat saya
            </label>
          </div>
          {galat && (
            <p className="err" role="alert">
              {galat}
            </p>
          )}
          <button className="btn pr" style={{ width: '100%', marginTop: 14 }} disabled={proses}>
            {proses ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
        <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
          Akun dibuat oleh admin. Belum punya akun? Hubungi admin unit Anda. · <Link to="/">Beranda</Link>
        </p>
      </div>
    </div>
  )
}

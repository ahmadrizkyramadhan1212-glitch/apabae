// Modal ganti kata sandi: verifikasi sandi lama, sandi baru minimal 8 karakter.
import { useState, type FormEvent } from 'react'
import { post } from '../lib/api'

export default function GantiSandiModal({ tutup }: { tutup: () => void }) {
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [galat, setGalat] = useState('')
  const [ok, setOk] = useState(false)
  const [proses, setProses] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    setProses(true)
    try {
      await post('/api/auth/ganti-sandi', { lama, baru })
      setOk(true)
      setTimeout(tutup, 1400)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mengganti sandi')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="mod" onClick={(e) => e.target === e.currentTarget && tutup()} role="dialog" aria-modal="true" aria-label="Ganti kata sandi">
      <div className="card">
        <h3>Ganti Kata Sandi</h3>
        {ok ? (
          <p className="ok-msg" style={{ marginTop: 12 }}>Kata sandi berhasil diganti.</p>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="sandi-lama">Kata sandi lama</label>
            <input id="sandi-lama" type="password" value={lama} onChange={(e) => setLama(e.target.value)} required />
            <label htmlFor="sandi-baru">Kata sandi baru (minimal 8 karakter)</label>
            <input id="sandi-baru" type="password" value={baru} onChange={(e) => setBaru(e.target.value)} minLength={8} required />
            {galat && <p className="err" role="alert">{galat}</p>}
            <div className="acts">
              <button type="button" className="btn" onClick={tutup}>Batal</button>
              <button className="btn pr" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

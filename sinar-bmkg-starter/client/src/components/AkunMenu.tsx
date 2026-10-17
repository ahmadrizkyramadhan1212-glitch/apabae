// Menu akun di pojok kanan navigasi: nama pengguna, ganti sandi, keluar.
// Dipakai bersama oleh UserLayout dan PublicLayout.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import GantiSandiModal from './GantiSandiModal'

export default function AkunMenu() {
  const { me, keluar } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [gantiSandi, setGantiSandi] = useState(false)

  return (
    <div className={`dd ${menuOpen ? 'o' : ''}`} style={{ marginLeft: 'auto' }}>
      <a onClick={() => setMenuOpen((v) => !v)} role="button" aria-expanded={menuOpen}>
        <strong>{me?.name}</strong> <small className="hint">({me?.role === 'ADMIN' ? 'Admin' : 'User'}) ▾</small>
      </a>
      <div className="dm">
        <button onClick={() => { setGantiSandi(true); setMenuOpen(false) }}>Ganti Kata Sandi</button>
        <button onClick={async () => { await keluar(); navigate('/') }}>Keluar</button>
      </div>
      {gantiSandi && <GantiSandiModal tutup={() => setGantiSandi(false)} />}
    </div>
  )
}

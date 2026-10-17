// Tombol melayang: ganti tema (matahari/bulan) dan menu pengaturan latar (awan).
import { useEffect, useRef, useState } from 'react'
import { useUi } from '../lib/ui'

export default function ThemeFab() {
  const { theme, setTheme, bg, setBg } = useUi()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Sapuan lingkaran saat ganti tema (View Transitions API, dengan cadangan tanpa efek)
  const toggleTheme = () => {
    const next = theme === 'terang' ? 'gelap' : 'terang'
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
    if (doc.startViewTransition) doc.startViewTransition(() => setTheme(next))
    else setTheme(next)
  }

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const modes: { id: typeof bg; label: string }[] = [
    { id: 'bergerak', label: 'Awan bergerak' },
    { id: 'diam', label: 'Awan diam' },
    { id: 'polos', label: 'Latar polos' },
  ]

  return (
    <>
      <button className="bgfab" title="Pengaturan latar" aria-label="Pengaturan latar" onClick={() => setMenuOpen((v) => !v)}>
        ☁
      </button>
      <div id="bgmenu" ref={menuRef} className={menuOpen ? 'open' : ''} role="menu">
        <b>Latar</b>
        {modes.map((m) => (
          <button key={m.id} className={bg === m.id ? 'on' : ''} role="menuitem" onClick={() => { setBg(m.id); setMenuOpen(false) }}>
            {m.label}
          </button>
        ))}
      </div>
      <button className="thfab" onClick={toggleTheme} title={theme === 'terang' ? 'Mode gelap' : 'Mode terang'} aria-label="Ganti tema">
        {theme === 'terang' ? '🌙' : '☀️'}
      </button>
    </>
  )
}

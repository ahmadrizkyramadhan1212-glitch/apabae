// Kerangka halaman untuk peran User: navigasi atas + menu akun.
import { NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Logo'
import AkunMenu from '../components/AkunMenu'

export default function UserLayout() {
  const link = ({ isActive }: { isActive: boolean }) => `l${isActive ? ' on' : ''}`

  return (
    <div className="pub">
      <nav className="nav" aria-label="Navigasi utama">
        <NavLink to="/" className="lg">
          <i><Logo /></i>
          <span>
            <b>SINAR</b>
            <small>Sistem Informasi Seminar Ilmiah</small>
          </span>
        </NavLink>
        <NavLink to="/" end className={link}>
          Beranda
        </NavLink>
        <NavLink to="/seminar-saya" className={link}>
          Seminar Saya
        </NavLink>
        <NavLink to="/hasil-seminar" className={link}>
          Hasil Seminar
        </NavLink>
        <AkunMenu />
      </nav>
      <Outlet />
      <footer className="foot">SINAR BMKG — Sistem Informasi Seminar Ilmiah © {new Date().getFullYear()}</footer>
    </div>
  )
}

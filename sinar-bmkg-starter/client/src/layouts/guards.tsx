// Penjaga rute: harus masuk, dan (opsional) harus peran tertentu. Hak akses tetap ditegakkan di server.
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Loading } from '../components/ui'

export function RequireAuth() {
  const { me, memuat } = useAuth()
  const location = useLocation()
  if (memuat) return <Loading />
  if (!me) return <Navigate to="/login" state={{ dari: location.pathname }} replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { me, memuat } = useAuth()
  if (memuat) return <Loading />
  if (!me) return <Navigate to="/login" replace />
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

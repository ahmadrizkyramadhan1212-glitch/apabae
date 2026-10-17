// Konteks sesi: siapa yang masuk, masuk, keluar. Dimuat sekali saat aplikasi dibuka.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { get, post } from './api'

export interface Me {
  id: string
  name: string
  role: 'ADMIN' | 'USER'
}

interface AuthCtx {
  me: Me | null
  memuat: boolean
  refresh: () => Promise<void>
  keluar: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ me: null, memuat: true, refresh: async () => {}, keluar: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [memuat, setMemuat] = useState(true)

  const refresh = async () => {
    try {
      setMe(await get<Me>('/api/auth/me'))
    } catch {
      setMe(null)
    } finally {
      setMemuat(false)
    }
  }

  const keluar = async () => {
    await post('/api/auth/logout').catch(() => {})
    setMe(null)
  }

  useEffect(() => {
    void refresh()
  }, [])

  return <Ctx.Provider value={{ me, memuat, refresh, keluar }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

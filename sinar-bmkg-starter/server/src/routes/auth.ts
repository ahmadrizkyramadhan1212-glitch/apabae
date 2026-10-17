// Rute autentikasi: masuk, keluar, profil, ganti sandi.
import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '../db.js'
import { signToken, setAuthCookie, clearAuthCookie, requireAuth, type AuthRequest } from '../lib/auth.js'
import { audit } from '../lib/audit.js'

export const authRouter = Router()

// Batas percobaan login GAGAL: 10 kali per 15 menit per kombinasi IP + akun.
// Login yang berhasil tidak dihitung, dan satu IP kantor (NAT) tidak mengunci semua pegawai sekaligus.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${String(req.body?.id ?? '').toLowerCase()}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.' },
})

const loginSchema = z.object({
  id: z.string().min(1, 'NIP atau email wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
  ingat: z.boolean().optional().default(false),
})

authRouter.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const { id, password, ingat } = parsed.data

    const user = await db.user.findFirst({
      where: { OR: [{ nip: id }, { email: id.toLowerCase() }] },
    })
    // Pesan sama untuk user tak dikenal dan sandi salah agar tidak membocorkan keberadaan akun
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await audit(null, 'LOGIN_GAGAL', id, 'NIP/email atau kata sandi salah')
      return res.status(401).json({ error: 'NIP/email atau kata sandi salah' })
    }
    if (!user.active) return res.status(403).json({ error: 'Akun Anda dinonaktifkan. Hubungi admin.' })

    setAuthCookie(res, signToken(user.id), ingat)
    await audit(user.id, 'LOGIN', user.name)
    res.json({ id: user.id, name: user.name, nip: user.nip, email: user.email, role: user.role, unit: user.unit })
  } catch (e) {
    next(e)
  }
})

authRouter.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json(req.user)
})

const sandiSchema = z.object({
  lama: z.string().min(1, 'Kata sandi lama wajib diisi'),
  baru: z.string().min(8, 'Kata sandi baru minimal 8 karakter'),
})

authRouter.post('/ganti-sandi', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = sandiSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    const user = await db.user.findUnique({ where: { id: req.user!.id } })
    if (!user || !(await bcrypt.compare(parsed.data.lama, user.passwordHash))) {
      return res.status(400).json({ error: 'Kata sandi lama salah' })
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.baru, 10) } })
    await audit(user.id, 'GANTI_SANDI', user.name)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

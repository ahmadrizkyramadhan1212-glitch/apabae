// Audit Log (admin): daftar aksi penting, terbaru dulu, bisa dicari.
import { Router } from 'express'
import { db } from '../db.js'
import { requireAuth, requireRole } from '../lib/auth.js'

export const auditRouter = Router()
auditRouter.use(requireAuth, requireRole('ADMIN'))

auditRouter.get('/', async (req, res, next) => {
  try {
    const cari = String(req.query.cari ?? '').trim()
    const ambil = Math.min(Number(req.query.ambil ?? 100), 300)
    const logs = await db.auditLog.findMany({
      where: cari
        ? {
            OR: [
              { action: { contains: cari } },
              { target: { contains: cari } },
              { detail: { contains: cari } },
              { user: { name: { contains: cari } } },
            ],
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: ambil,
      include: { user: { select: { name: true, role: true } } },
    })
    res.json(logs)
  } catch (e) {
    next(e)
  }
})

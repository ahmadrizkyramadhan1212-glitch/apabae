// Satu pintu pencatatan audit. Semua aksi penting lewat fungsi ini supaya bentuknya konsisten.
import { db } from '../db.js'

export async function audit(
  userId: string | null,
  action: string,
  target: string,
  detail?: string,
) {
  try {
    await db.auditLog.create({ data: { userId: userId ?? undefined, action, target, detail: detail ?? null } })
  } catch (e) {
    // Audit tidak boleh menggagalkan aksi utama, tapi galat dicatat di log server
    console.error('Gagal mencatat audit log', e)
  }
}

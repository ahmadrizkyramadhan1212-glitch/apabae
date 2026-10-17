// Satu pintu antrean email: handler TIDAK PERNAH mengirim email langsung,
// hanya menyisipkan baris EmailJob. Pekerja node-cron yang mengirimnya berurutan.
import { db } from '../db.js'
import type { EmailType } from '@prisma/client'

export async function queueEmail(data: {
  type: EmailType
  toEmail: string
  toName?: string
  subject: string
  body: string
  attachmentPath?: string
  attachmentName?: string
  certificateId?: string
}) {
  return db.emailJob.create({
    data: {
      type: data.type,
      toEmail: data.toEmail,
      toName: data.toName,
      subject: data.subject,
      body: data.body,
      attachmentPath: data.attachmentPath,
      attachmentName: data.attachmentName,
      certificateId: data.certificateId,
    },
  })
}

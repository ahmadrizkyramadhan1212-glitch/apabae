// Satu-satunya PrismaClient di aplikasi. Semua modul impor dari sini.
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

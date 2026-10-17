// Daftar 10 huruf TTF untuk sertifikat. Berkas ada di server/assets/fonts (di luar src agar tidak ikut tsc).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { KUNCI_HURUF, NAMA_HURUF, type KunciHuruf } from './certLayout.js'

const akarServer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DIR_HURUF = path.join(akarServer, 'assets', 'fonts')
export const JALUR_TEMPLATE_BAWAAN = path.join(akarServer, 'assets', 'cert-default.svg')

export function jalurHuruf(kunci: KunciHuruf): string {
  return path.join(DIR_HURUF, `${kunci}.ttf`)
}

export async function bacaHuruf(kunci: KunciHuruf): Promise<Buffer> {
  const utama = jalurHuruf(kunci)
  try {
    return await fs.readFile(utama)
  } catch {
    // Cadangan: Montserrat, lalu huruf mana pun yang ada
    if (kunci !== 'montserrat') {
      try {
        return await fs.readFile(jalurHuruf('montserrat'))
      } catch {
        /* lanjut */
      }
    }
    const daftar = await fs.readdir(DIR_HURUF).catch(() => [] as string[])
    const ttf = daftar.find((n) => n.endsWith('.ttf'))
    if (!ttf) {
      throw new Error('Berkas huruf sertifikat belum terpasang. Unduh TTF ke server/assets/fonts (lihat docs/SETUP.md).')
    }
    return fs.readFile(path.join(DIR_HURUF, ttf))
  }
}

export function daftarHuruf() {
  return KUNCI_HURUF.map((kunci) => ({ kunci, nama: NAMA_HURUF[kunci] }))
}

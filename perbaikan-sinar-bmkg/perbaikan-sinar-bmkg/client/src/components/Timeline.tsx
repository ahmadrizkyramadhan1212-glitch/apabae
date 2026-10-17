// Timeline Seminar: 4 baris lokasi, 06:00–22:00, garis "sekarang", TANPA label status.
// Versi horizontal (desktop) dan vertikal (HP). Blok muncul dengan animasi bertahap.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lokasi, Seminar } from '../lib/types'
import { useAuth } from '../lib/auth'

const MULAI = 6 // jam mulai sumbu
const SELESAI = 22 // jam selesai sumbu
const RENTANG = SELESAI - MULAI

const MENIT = (jam: string) => Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5))
// posisi kiri & lebar blok dalam persen
const kiri = (jam: string) => ((MENIT(jam) - MULAI * 60) / (RENTANG * 60)) * 100
const lebar = (mulai: string, selesai: string) => ((MENIT(selesai) - MENIT(mulai)) / (RENTANG * 60)) * 100

interface Item extends Seminar {
  milik: boolean
}

export default function Timeline({ tanggal, lokasi, seminar }: { tanggal: string; lokasi: Lokasi[]; seminar: Item[] }) {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [, setKini] = useState(new Date())

  // garis "sekarang" bergerak tiap menit
  useEffect(() => {
    const t = setInterval(() => setKini(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const tanggalIni = new Date(`${tanggal}T00:00:00+07:00`)
  const hariIniWIB = new Date()
  const samaHari = tanggalIni.toDateString() === hariIniWIB.toDateString()
  const menitKini = hariIniWIB.getHours() * 60 + hariIniWIB.getMinutes() // WIB lokal laptop = WIB
  const posisiKini = ((menitKini - MULAI * 60) / (RENTANG * 60)) * 100
  const tampilKini = samaHari && posisiKini >= 0 && posisiKini <= 100

  const jamLabel = Array.from({ length: RENTANG + 1 }, (_, i) => MULAI + i)

  const blok = (s: Item) => (
    <button
      key={s.id}
      className={`hv ${s.milik && s.status === 'MENUNGGU_VERIFIKASI' ? 'Menunggu' : ''} ${s.milik && (s.status === 'MENUNGGU_VERIFIKASI' || s.status === 'DIKEMBALIKAN') ? 'dim' : ''}`}
      style={{ left: `${kiri(s.startTime)}%`, width: `${lebar(s.startTime, s.endTime)}%` }}
      title={`${s.title} · ${s.startTime}–${s.endTime} WIB`}
      onClick={() => navigate(s.milik ? `/seminar/${s.id}` : `/seminar-publik/${s.id}`)}
    >
      <span>{s.title}</span>
      <small>
        {s.startTime}–{s.endTime} WIB
      </small>
    </button>
  )

  return (
    <div className="sc">
      {/* ===== Desktop: horizontal ===== */}
      <div className="tlh">
        {/* Garis "sekarang": SATU garis untuk semua baris (sebelumnya digambar di tiap baris) */}
        {tampilKini && <div className="nowl" style={{ ['--f' as string]: posisiKini / 100 }} />}
        <div className="hh">
          <b />
          <div className="hr">
            {jamLabel.map((j) => (
              <span key={j} style={{ left: `${((j - MULAI) / RENTANG) * 100}%` }}>
                {String(j).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        {lokasi.map((l) => (
          <div className="hw" key={l.id}>
            <b>{l.name}</b>
            <div
              className="hr"
              onClick={(e) => {
                // user login klik area kosong -> buat seminar dengan jadwal terisi
                if (!me) return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const persen = (e.clientX - rect.left) / rect.width
                const menit = Math.round((MULAI * 60 + persen * RENTANG * 60) / 30) * 30
                if (menit < MULAI * 60 || menit > (SELESAI - 1) * 60) return
                const jam = `${String(Math.floor(menit / 60)).padStart(2, '0')}:${String(menit % 60).padStart(2, '0')}`
                navigate(`/seminar/baru?lokasi=${l.id}&tanggal=${tanggal}&mulai=${jam}`)
              }}
              title={me ? 'Klik slot kosong untuk mengajukan seminar di jam ini' : undefined}
            >
              {jamLabel.slice(0, -1).map((j) => (
                <i key={j} style={{ left: `${((j + 1 - MULAI) / RENTANG) * 100}%` }} />
              ))}
              {seminar.filter((s) => s.locationId === l.id).map(blok)}
            </div>
          </div>
        ))}
      </div>

      {/* ===== HP: vertikal ===== */}
      <div className="tlv">
        {tampilKini && (
          <p className="hint" style={{ margin: '4px 0' }}>
            Sekarang pukul {hariIniWIB.toTimeString().slice(0, 5)} WIB
          </p>
        )}
        {lokasi.map((l) => {
          const isi = seminar.filter((s) => s.locationId === l.id)
          return (
            <div key={l.id} style={{ marginBottom: 12 }}>
              <b style={{ display: 'block', margin: '8px 0 6px' }}>{l.name}</b>
              {isi.length === 0 ? (
                <p className="hint">Tidak ada seminar</p>
              ) : (
                isi.map((s) => (
                  <button
                    key={s.id}
                    className="btn"
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 6, textAlign: 'left' }}
                    onClick={() => navigate(s.milik ? `/seminar/${s.id}` : `/seminar-publik/${s.id}`)}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                    <span className="hint" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {s.startTime}–{s.endTime}
                    </span>
                  </button>
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

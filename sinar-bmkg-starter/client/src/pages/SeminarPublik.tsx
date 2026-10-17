// Detail seminar publik: info utama + Dokumentasi (berita & galeri) + Materi untuk yang SELESAI.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { get } from '../lib/api'
import { Loading, ErrorBox, Badge, Empty, fmtTanggal } from '../components/ui'
import { Galeri } from '../components/BeritaTab'
import type { Seminar } from '../lib/types'

interface Publik extends Omit<Seminar, 'user'> {
  milik: boolean
  user?: { name: string; unit: string | null }
  berita: { id: string; title: string; body: string; publishedAt: string; photos: { id: string }[] } | null
  materi: { id: string; presenter: string; originalName: string | null; driveUrl: string | null; sizeBytes: number | null }[]
}

export default function SeminarPublik() {
  const { id } = useParams()
  const [s, setS] = useState<Publik | null>(null)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    get<Publik>(`/api/publik/seminar/${id}`).then(setS).catch((e) => setGalat(e instanceof Error ? e.message : 'Gagal memuat seminar'))
  }, [id])

  if (galat) return <ErrorBox message={galat} />
  if (!s) return <Loading />

  return (
    <main>
      <p style={{ margin: '6px 0' }}>
        <Link to="/">← Beranda</Link>
      </p>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>
          {s.title} <Badge status={s.status} />
        </h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 8, marginTop: 10 }}>
          <dt className="hint">Kode</dt>
          <dd>{s.code}</dd>
          <dt className="hint">Jadwal</dt>
          <dd>
            {fmtTanggal(s.date, true)}, {s.startTime}–{s.endTime} WIB
          </dd>
          <dt className="hint">Lokasi</dt>
          <dd>{s.locationOther ?? s.location.name}</dd>
          {s.topic && (
            <>
              <dt className="hint">Topik</dt>
              <dd>{s.topic}</dd>
            </>
          )}
          {s.user && (
            <>
              <dt className="hint">Penyelenggara</dt>
              <dd>
                {s.user.name}
                {s.user.unit ? ` — ${s.user.unit}` : ''}
              </dd>
            </>
          )}
        </dl>
        {s.status === 'SELESAI' && (
          <>
            <section style={{ marginTop: 20 }}>
              <h3>Dokumentasi</h3>
              {s.berita ? (
                <div style={{ marginTop: 8 }}>
                  <p className="hint">Tayang {fmtTanggal(s.berita.publishedAt, true)}</p>
                  <h4 style={{ margin: '6px 0' }}>{s.berita.title}</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{s.berita.body}</p>
                  {s.berita.photos.length > 0 && <Galeri foto={s.berita.photos.map((p) => p.id)} />}
                </div>
              ) : (
                <Empty title="Belum ada dokumentasi" hint="Penyelenggara belum mengunggah berita." />
              )}
            </section>
            <section style={{ marginTop: 20 }}>
              <h3>Materi</h3>
              {s.materi.length === 0 ? (
                <Empty title="Belum ada materi" />
              ) : (
                <ul style={{ paddingLeft: 18, marginTop: 8, display: 'grid', gap: 6 }}>
                  {s.materi.map((m) => (
                    <li key={m.id}>
                      <b>{m.presenter}</b> —{' '}
                      {m.driveUrl ? (
                        <a href={m.driveUrl} target="_blank" rel="noreferrer">buka tautan Google Drive ↗</a>
                      ) : (
                        <a href={`/api/publik/materi/${m.id}`}>unduh {m.originalName}</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        {s.milik && (
          <p className="hint" style={{ marginTop: 12 }}>
            Ini seminar Anda —{' '}
            <Link to={`/seminar/${s.id}`}>buka kelola seminar</Link>.
          </p>
        )}
      </div>
    </main>
  )
}

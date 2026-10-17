// Tab Berita: satu berita per seminar, maks 10 foto (JPG/PNG/WEBP 5 MB), langsung tayang.
// Ubah/hapus hanya oleh penulis (dicek juga di server).
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { get, post, patch, del } from '../lib/api'
import { Loading, Empty, ErrorBox, fmtTanggal } from './ui'

interface Foto {
  id: string
  caption: string | null
}
interface Berita {
  id: string
  title: string
  body: string
  publishedAt: string
  photos: Foto[]
}

const MB = 1024 * 1024

export default function BeritaTab({ seminarId, penulis }: { seminarId: string; penulis: boolean }) {
  const [berita, setBerita] = useState<Berita | null | undefined>(undefined) // undefined = memuat
  const [galat, setGalat] = useState('')

  const muat = useCallback(async () => {
    try {
      setGalat('')
      setBerita(await get<Berita | null>(`/api/konten/seminars/${seminarId}/berita`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat berita')
    }
  }, [seminarId])

  useEffect(() => {
    void muat()
  }, [muat])

  if (galat) return <ErrorBox message={galat} onCobaLagi={muat} />
  if (berita === undefined) return <Loading />

  return (
    <div className="card">
      <h3>Berita / Dokumentasi</h3>
      <p className="hint">Langsung tayang tanpa moderasi di halaman publik seminar. Ubah dan hapus hanya milik Anda.</p>
      {berita === null ? (
        penulis ? (
          <FormBerita seminarId={seminarId} selesai={muat} />
        ) : (
          <Empty title="Belum ada berita" />
        )
      ) : (
        <TampilBerita berita={berita} selesai={muat} />
      )}
    </div>
  )
}

function FormBerita({ seminarId, selesai, awal }: { seminarId: string; selesai: () => void; awal?: Berita }) {
  const [judul, setJudul] = useState(awal?.title ?? '')
  const [isi, setIsi] = useState(awal?.body ?? '')
  const [fotos, setFotos] = useState<File[]>([])
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const kirim = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    setProses(true)
    try {
      const fd = new FormData()
      fd.append('judul', judul)
      fd.append('isi', isi)
      for (const f of fotos) fd.append('foto', f)
      if (awal) await patch(`/api/konten/berita/${awal.id}`, fd)
      else await post(`/api/konten/seminars/${seminarId}/berita`, fd)
      selesai()
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan berita')
    } finally {
      setProses(false)
    }
  }

  return (
    <form onSubmit={kirim}>
      <label htmlFor="br-judul">Judul berita</label>
      <input id="br-judul" value={judul} onChange={(e) => setJudul(e.target.value)} required minLength={5} />
      <label htmlFor="br-isi">Isi berita (teks biasa)</label>
      <textarea id="br-isi" rows={6} value={isi} onChange={(e) => setIsi(e.target.value)} required minLength={20} placeholder="Ceritakan pelaksanaan seminar: pembicara, peserta, hasil diskusi…" />
      <label htmlFor="br-foto">Foto dokumentasi (opsional, maks 10 foto, JPG/PNG/WEBP 5 MB per foto)</label>
      <input
        id="br-foto"
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const daftar = Array.from(e.target.files ?? [])
          if (daftar.length > 10) return setGalat('Maksimal 10 foto')
          if (daftar.some((f) => f.size > 5 * MB)) return setGalat('Ada foto yang melebihi 5 MB')
          setGalat('')
          setFotos(daftar)
        }}
      />
      {fotos.length > 0 && <p className="fc">{fotos.map((f, i) => <span key={i}>{f.name}</span>)}</p>}
      {galat && <p className="err" role="alert">{galat}</p>}
      <button className="btn pr" style={{ marginTop: 10 }} disabled={proses}>
        {proses ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Tayangkan Berita'}
      </button>
    </form>
  )
}

function TampilBerita({ berita, selesai }: { berita: Berita; selesai: () => void }) {
  const [ubah, setUbah] = useState(false)

  const hapus = async () => {
    if (!confirm('Hapus berita ini beserta fotonya? Tindakan tidak dapat dibatalkan.')) return
    await del(`/api/konten/berita/${berita.id}`).catch((e) => alert(e.message))
    selesai()
  }

  if (ubah) return <FormBerita awal={berita} seminarId="" selesai={() => { setUbah(false); selesai() }} />

  return (
    <div style={{ marginTop: 10 }}>
      <p className="hint">Tayang {fmtTanggal(berita.publishedAt, true)}</p>
      <h4 style={{ margin: '6px 0' }}>{berita.title}</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{berita.body}</p>
      {berita.photos.length > 0 && <Galeri foto={berita.photos.map((p) => p.id)} />}
      <div className="dn" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => setUbah(true)}>Ubah Berita</button>
        <button className="btn dgr" onClick={hapus}>Hapus Berita</button>
      </div>
    </div>
  )
}

// Galeri foto dengan lightbox sederhana
export function Galeri({ foto }: { foto: string[] }) {
  const [buka, setBuka] = useState<string | null>(null)
  return (
    <>
      <div className="gallery" style={{ marginTop: 10 }}>
        {foto.map((id) => (
          <img key={id} src={`/api/publik/foto/${id}`} alt="Foto dokumentasi" onClick={() => setBuka(id)} loading="lazy" />
        ))}
      </div>
      {buka && (
        <div className="lightbox" onClick={() => setBuka(null)} role="dialog" aria-label="Pratinjau foto">
          <img src={`/api/publik/foto/${buka}`} alt="Foto dokumentasi diperbesar" />
        </div>
      )}
    </>
  )
}

// Tab Sertifikat (aktif setelah SELESAI): unggah template, editor tata letak seret,
// generate PDF per peserta, kirim email lewat antrean, kirim ulang yang gagal.
import { useCallback, useEffect, useRef, useState } from 'react'
import { get, post, patch } from '../lib/api'
import { Loading, ErrorBox, Empty } from './ui'

interface Elemen {
  on: boolean
  x: number
  y: number
  size: number
  font: string
  color: string
  align: 'left' | 'center' | 'right'
  format?: string
}
interface Layout {
  name: Elemen
  title: Elemen
  date: Elemen
  seminarId: Elemen
  serial: Elemen
  qr: Elemen
  location?: Elemen
  nip?: Elemen
}
interface Peserta {
  id: string
  name: string
  nip: string
  email: string
  sertifikat: { id: string; nomor: string; pdfAda: boolean; mailStatus: string; emailStatus: string | null; emailGalat: string | null } | null
}
interface Gambaran {
  seminar: { id: string; code: string; title: string; date: string; lokasi: string }
  templateAda: boolean
  pageMode: string
  layout: Layout
  peserta: Peserta[]
}

const HURUF: [string, string][] = [
  ['playfair', 'Playfair Display'],
  ['greatvibes', 'Great Vibes'],
  ['cinzel', 'Cinzel'],
  ['allura', 'Allura'],
  ['pinyon', 'Pinyon Script'],
  ['dancing', 'Dancing Script'],
  ['cormorant', 'Cormorant Garamond'],
  ['baskerville', 'Libre Baskerville'],
  ['montserrat', 'Montserrat'],
  ['times', 'Times New Roman'],
]
const LABEL_ELEMEN: Record<string, string> = {
  name: 'Nama peserta',
  title: 'Judul seminar',
  date: 'Tanggal',
  seminarId: 'ID seminar',
  serial: 'Nomor seri',
  qr: 'QR keaslian',
  location: 'Lokasi',
  nip: 'NIP peserta',
}
const KUNCI_ELEMEN = ['name', 'title', 'date', 'seminarId', 'serial', 'qr', 'location', 'nip'] as const

export default function SertifikatTab({ seminarId }: { seminarId: string }) {
  const [d, setD] = useState<Gambaran | null>(null)
  const [galat, setGalat] = useState('')
  const [pesan, setPesan] = useState('')
  const [layout, setLayout] = useState<Layout | null>(null)
  const [pilih, setPilih] = useState<string>('name')
  const [proses, setProses] = useState(false)

  const muat = useCallback(async () => {
    try {
      setGalat('')
      const g = await get<Gambaran>(`/api/sertifikat/seminars/${seminarId}`)
      setD(g)
      setLayout(g.layout)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat sertifikat')
    }
  }, [seminarId])

  useEffect(() => {
    void muat()
  }, [muat])

  if (galat) return <ErrorBox message={galat} onCobaLagi={muat} />
  if (!d || !layout) return <Loading />

  const ubah = (kunci: string, perubahan: Partial<Elemen>) => {
    setLayout((l) => {
      if (!l) return l
      const el = (l as unknown as Record<string, Elemen | undefined>)[kunci]
      if (!el) return l
      return { ...l, [kunci]: { ...el, ...perubahan } }
    })
  }

  const simpanLayout = async () => {
    setProses(true)
    setPesan('')
    try {
      const hasil = await patch(`/api/sertifikat/seminars/${seminarId}/layout`, { layout })
      setPesan('Tata letak tersimpan.')
      setLayout((hasil as { layout: Layout }).layout)
    } catch (e) {
      setPesan('')
      alert(e instanceof Error ? e.message : 'Gagal menyimpan tata letak')
    } finally {
      setProses(false)
    }
  }

  const generate = async () => {
    if (!confirm('Buat ulang PDF sertifikat untuk semua peserta? Nomor seri yang sudah ada tidak berubah.')) return
    setProses(true)
    try {
      const hasil = await post<{ dibuat: number; total: number }>(`/api/sertifikat/seminars/${seminarId}/generate`)
      setPesan(`${hasil.dibuat} dari ${hasil.total} sertifikat selesai dibuat.`)
      void muat()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal membuat sertifikat')
    } finally {
      setProses(false)
    }
  }

  const adaPdf = d.peserta.some((p) => p.sertifikat?.pdfAda)
  const terkirim = d.peserta.filter((p) => p.sertifikat?.emailStatus === 'TERKIRIM').length
  const punyaPdf = d.peserta.filter((p) => p.sertifikat?.pdfAda).length

  return (
    <>
      <div className="card">
        <h3>Sertifikat</h3>
        <p className="hint">
          Kode seminar {d.seminar.code}. Template bisa diunggah per seminar; tanpa unggahan dipakai template bawaan.
          Nomor seri: SERT/BMKG/&lt;tahun&gt;/{d.seminar.code}/&lt;urut&gt;.
        </p>
        {pesan && <p className="ok-msg">{pesan}</p>}
        <div className="dn" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TemplateForm seminarId={seminarId} ada={d.templateAda} selesai={muat} />
          <button className="btn pr" onClick={generate} disabled={proses || d.peserta.length === 0}>
            {proses ? 'Memproses…' : 'Buat Sertifikat (PDF)'}
          </button>
          <a className="btn" href={`/api/sertifikat/seminars/${seminarId}/pratinjau`} target="_blank" rel="noreferrer">
            Pratinjau PDF ↗
          </a>
        </div>
        {d.peserta.length === 0 && <p className="hint" style={{ marginTop: 10 }}>Belum ada peserta hadir — sertifikat dibuat untuk peserta yang tercatat.</p>}
        {adaPdf && (
          <p className="hint" style={{ marginTop: 10 }}>
            {punyaPdf} PDF siap · {terkirim} email terkirim.
          </p>
        )}
      </div>

      <EditorSertifikat
        seminarId={seminarId}
        seminar={d.seminar}
        layout={layout}
        pilih={pilih}
        setPilih={setPilih}
        ubah={ubah}
        simpan={simpanLayout}
        proses={proses}
      />

      <TabelPeserta peserta={d.peserta} muat={muat} />

      {adaPdf && <FormEmail seminarId={seminarId} judul={d.seminar.title} peserta={d.peserta} muat={muat} />}
    </>
  )
}

function TemplateForm({ seminarId, ada, selesai }: { seminarId: string; ada: boolean; selesai: () => void }) {
  const [f, setF] = useState<File | null>(null)
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)
  const kirim = async () => {
    if (!f) return setGalat('Pilih berkas template')
    setProses(true)
    try {
      const fd = new FormData()
      fd.append('template', f)
      await post(`/api/sertifikat/seminars/${seminarId}/template`, fd)
      setF(null)
      setGalat('')
      selesai()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengunggah template')
    } finally {
      setProses(false)
    }
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="btn sm" style={{ cursor: 'pointer' }}>
        {ada ? 'Ganti Template' : 'Unggah Template'}
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
          style={{ display: 'none' }}
          onChange={(e) => {
            const berkas = e.target.files?.[0] ?? null
            if (berkas && berkas.size > 10 * 1024 * 1024) {
              setGalat('Template maksimal 10 MB')
              return
            }
            setGalat('')
            setF(berkas)
          }}
        />
      </label>
      {f && <span className="hint">{f.name} siap diunggah</span>}
      {f && (
        <button className="btn sm pr" onClick={kirim} disabled={proses}>
          {proses ? 'Mengunggah…' : 'Unggah'}
        </button>
      )}
      {!f && ada && <span className="hint">template sudah terpasang ✓</span>}
      {!f && !ada && <span className="hint">pakai bawaan</span>}
      {galat && <span className="err" role="alert">{galat}</span>}
    </div>
  )
}

// Editor: latar PNG + elemen bisa diklik dan diseret; panel untuk properti halus.
function EditorSertifikat({
  seminarId,
  seminar,
  layout,
  pilih,
  setPilih,
  ubah,
  simpan,
  proses,
}: {
  seminarId: string
  seminar: Gambaran['seminar']
  layout: Layout
  pilih: string
  setPilih: (k: string) => void
  ubah: (kunci: string, perubahan: Partial<Elemen>) => void
  simpan: () => Promise<void>
  proses: boolean
}) {
  const [rasio, setRasio] = useState(1.414)
  const refKanvas = useRef<HTMLDivElement>(null)
  const seret = useRef<string | null>(null)

  useEffect(() => {
    fetch(`/api/sertifikat/seminars/${seminarId}/latar.png`, { credentials: 'include' })
      .then(async (r) => {
        setRasio(Number(r.headers.get('X-Rasio-Halaman')) || 1.414)
        return r.blob()
      })
      .then((b) => URL.createObjectURL(b))
      .then((u) => setLatar(u))
      .catch(() => {})
  }, [seminarId])
  const [latar, setLatar] = useState<string | null>(null)

  const saatSeret = (e: React.MouseEvent) => {
    if (!seret.current || !refKanvas.current) return
    const kotak = refKanvas.current.getBoundingClientRect()
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - kotak.left) / kotak.width) * 100)))
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - kotak.top) / kotak.height) * 100)))
    ubah(seret.current, { x, y })
  }

  const tanggalContoh = new Date(seminar.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const isi: Record<string, { teks: string }> = {
    name: { teks: 'Contoh Nama Lengkap' },
    title: { teks: seminar.title },
    date: { teks: tanggalContoh },
    seminarId: { teks: `ID seminar: ${seminar.code}` },
    serial: { teks: `SERT/BMKG/${new Date(seminar.date).getUTCFullYear()}/${seminar.code}/001` },
    location: { teks: seminar.lokasi },
    nip: { teks: 'NIP 199001012005011001' },
  }

  const tinggiKanvas = 420
  const el = (layout as unknown as Record<string, Elemen | undefined>)[pilih]

  return (
    <div className="card">
      <h3>Editor Tata Letak</h3>
      <p className="hint">Klik elemen untuk memilih, seret untuk memindahkan. Nama peserta selalu aktif. Simpan lalu buka Pratinjau PDF untuk memastikan hasil sama.</p>
      <div className="dn" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div
          ref={refKanvas}
          style={{
            position: 'relative',
            width: Math.min(720, tinggiKanvas * rasio),
            height: tinggiKanvas,
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid var(--bd)',
            backgroundImage: latar ? `url(${latar})` : undefined,
            backgroundSize: '100% 100%',
            background: latar ? undefined : '#fff',
            userSelect: 'none',
          }}
          onMouseMove={saatSeret}
          onMouseUp={() => (seret.current = null)}
          onMouseLeave={() => (seret.current = null)}
        >
          {KUNCI_ELEMEN.map((kunci) => {
            const e = (layout as unknown as Record<string, Elemen | undefined>)[kunci]
            if (!e || !e.on) return null
            const terpilih = pilih === kunci
            const ukuranFont = (e.size / 100) * tinggiKanvas
            if (kunci === 'qr') {
              const sisi = (e.size / 100) * Math.min(tinggiKanvas * rasio, tinggiKanvas)
              return (
                <div
                  key={kunci}
                  onMouseDown={() => {
                    seret.current = kunci
                    setPilih(kunci)
                  }}
                  style={{
                    position: 'absolute',
                    left: `${e.x}%`,
                    top: `${e.y}%`,
                    width: sisi,
                    height: sisi,
                    transform: 'translate(-50%, -50%)',
                    outline: terpilih ? '2px dashed #2E9E4F' : '1px dashed rgba(0,0,0,.25)',
                    cursor: 'grab',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: ukuranFont * 0.2,
                    fontFamily: 'monospace',
                    color: '#333',
                  }}
                >
                  QR
                </div>
              )
            }
            return (
              <div
                key={kunci}
                onMouseDown={() => {
                  seret.current = kunci
                  setPilih(kunci)
                }}
                style={{
                  position: 'absolute',
                  left: `${e.x}%`,
                  top: `${e.y}%`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '90%',
                  fontSize: ukuranFont,
                  fontFamily: `cert-${e.font}`,
                  color: e.color,
                  textAlign: e.align,
                  width: e.align === 'center' ? '80%' : 'auto',
                  outline: terpilih ? '2px dashed #2E9E4F' : '1px dashed rgba(0,0,0,.18)',
                  cursor: 'grab',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {isi[kunci]?.teks ?? kunci}
              </div>
            )
          })}
        </div>

        <div style={{ minWidth: 280, flex: 1, maxWidth: 420 }}>
          <label htmlFor="st-elemen">Elemen dipilih</label>
          <select id="st-elemen" value={pilih} onChange={(e) => setPilih(e.target.value)}>
            {KUNCI_ELEMEN.filter((k) => (layout as unknown as Record<string, Elemen | undefined>)[k]).map((k) => (
              <option key={k} value={k}>
                {LABEL_ELEMEN[k]}
              </option>
            ))}
          </select>
          {el && (
            <>
              <div className="dn" style={{ marginTop: 10, gap: 8 }}>
                <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={el.on} disabled={pilih === 'name'} onChange={(e) => ubah(pilih, { on: e.target.checked })} />
                  Aktif
                </label>
              </div>
              <Slider label="Posisi X (%)" nilai={el.x} min={0} max={100} ubah={(v) => ubah(pilih, { x: v })} />
              <Slider label="Posisi Y (%)" nilai={el.y} min={0} max={100} ubah={(v) => ubah(pilih, { y: v })} />
              <Slider label={pilih === 'qr' ? 'Ukuran sisi (%)' : 'Ukuran huruf (% tinggi)'} nilai={el.size} min={pilih === 'qr' ? 4 : 0.5} max={pilih === 'qr' ? 40 : 20} langkah={pilih === 'qr' ? 0.5 : 0.1} ubah={(v) => ubah(pilih, { size: v })} />
              {pilih !== 'qr' && (
                <>
                  <label htmlFor="st-huruf">Jenis huruf</label>
                  <select id="st-huruf" value={el.font} onChange={(e) => ubah(pilih, { font: e.target.value })}>
                    {HURUF.map(([k, n]) => (
                      <option key={k} value={k}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="st-warna" style={{ marginTop: 8 }}>Warna</label>
                  <input id="st-warna" type="color" value={el.color} onChange={(e) => ubah(pilih, { color: e.target.value })} style={{ width: 60, height: 34 }} />
                  <label htmlFor="st-rata" style={{ marginTop: 8 }}>Perataan</label>
                  <select id="st-rata" value={el.align} onChange={(e) => ubah(pilih, { align: e.target.value as Elemen['align'] })}>
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                </>
              )}
            </>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn pr" onClick={simpan} disabled={proses}>
              {proses ? 'Menyimpan…' : 'Simpan Tata Letak'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, nilai, min, max, langkah = 1, ubah }: { label: string; nilai: number; min: number; max: number; langkah?: number; ubah: (v: number) => void }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div className="dn" style={{ justifyContent: 'space-between' }}>
        <label style={{ margin: 0 }}>{label}</label>
        <span className="hint">{nilai}</span>
      </div>
      <input type="range" min={min} max={max} step={langkah} value={nilai} onChange={(e) => ubah(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}

function TabelPeserta({ peserta, muat }: { peserta: Peserta[]; muat: () => Promise<void> }) {
  if (peserta.length === 0) return <div className="card"><Empty title="Belum ada peserta" /></div>
  const labelStatus: Record<string, string> = { MENUNGGU: 'Menunggu', TERKIRIM: 'Terkirim', GAGAL: 'Gagal' }
  return (
    <div className="card">
      <h3>Peserta &amp; Sertifikat</h3>
      <div className="sc">
        <table>
          <thead>
            <tr>
              <th>Peserta</th>
              <th>Nomor seri</th>
              <th>Email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {peserta.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <br />
                  <span className="hint">{p.email}</span>
                </td>
                <td>{p.sertifikat?.nomor ?? <span className="hint">belum dibuat</span>}</td>
                <td>
                  {p.sertifikat?.emailStatus ? (
                    <span className={`bd ${p.sertifikat.emailStatus === 'TERKIRIM' ? 'Berlangsung' : p.sertifikat.emailStatus === 'GAGAL' ? 'Dibatalkan' : 'Menunggu'}`}>
                      {labelStatus[p.sertifikat.emailStatus] ?? p.sertifikat.emailStatus}
                    </span>
                  ) : (
                    <span className="hint">—</span>
                  )}
                  {p.sertifikat?.emailGalat && (
                    <>
                      <br />
                      <span className="hint" title={p.sertifikat.emailGalat}>galat tersimpan</span>
                    </>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.sertifikat?.pdfAda && (
                      <a className="btn sm" href={`/api/sertifikat/pdf/${p.sertifikat.id}`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Status email diperbarui oleh pekerja email setiap ±20 detik. Muat ulang halaman untuk memperbarui.</p>
      <button className="btn sm" onClick={() => void muat()}>Muat ulang status</button>
    </div>
  )
}

function FormEmail({ seminarId, judul, peserta, muat }: { seminarId: string; judul: string; peserta: Peserta[]; muat: () => Promise<void> }) {
  const layak = peserta.filter((p) => p.sertifikat?.pdfAda)
  const [terpilih, setTerpilih] = useState<string[]>(layak.map((p) => p.id))
  const [subjek, setSubjek] = useState(`Sertifikat ${judul}`)
  const [isi, setIsi] = useState('Yth. {nama},\n\nTerima kasih telah mengikuti seminar "{judul}". Sertifikat kehadiran terlampir.\n\nSalam,\nSINAR BMKG')
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const kirim = async () => {
    if (terpilih.length === 0) return setGalat('Centang minimal satu penerima')
    setProses(true)
    try {
      const hasil = await post<{ antre: number }>(`/api/sertifikat/seminars/${seminarId}/email`, { subjek, isi, penerima: terpilih })
      alert(`${hasil.antre} email masuk antrean dan akan dikirim oleh pekerja email.`)
      setGalat('')
      void muat()
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengirim')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="card">
      <h3>Kirim Email Sertifikat</h3>
      <p className="hint">Isi boleh memakai {'{nama}'} dan {'{judul}'} yang otomatis diganti per penerima. Dikirim berurutan oleh pekerja email dengan jeda antar email.</p>
      <label htmlFor="em-subjek">Subjek</label>
      <input id="em-subjek" value={subjek} onChange={(e) => setSubjek(e.target.value)} />
      <label htmlFor="em-isi">Isi email</label>
      <textarea id="em-isi" rows={6} value={isi} onChange={(e) => setIsi(e.target.value)} />
      <fieldset style={{ marginTop: 10, border: '1px solid var(--bd)', borderRadius: 10, padding: 10 }}>
        <legend>Penerima ({terpilih.length}/{layak.length})</legend>
        {layak.map((p) => (
          <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
            <input
              type="checkbox"
              checked={terpilih.includes(p.id)}
              onChange={(e) => setTerpilih((t) => (e.target.checked ? [...t, p.id] : t.filter((x) => x !== p.id)))}
            />
            {p.name} <span className="hint">({p.email})</span>
          </label>
        ))}
      </fieldset>
      {galat && <p className="err" role="alert">{galat}</p>}
      <button className="btn pr" style={{ marginTop: 12 }} onClick={kirim} disabled={proses}>
        {proses ? 'Memasukkan antrean…' : `Kirim ke ${terpilih.length} penerima`}
      </button>
    </div>
  )
}

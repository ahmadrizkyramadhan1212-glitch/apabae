// Halaman admin: Kelola Akun — daftar, tambah, ubah, reset sandi, impor Excel.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { get, patch, post } from '../../lib/api'
import { Loading, Empty, ErrorBox } from '../../components/ui'

interface Akun {
  id: string
  name: string
  nip: string
  email: string
  phone: string | null
  unit: string | null
  role: 'ADMIN' | 'USER'
  active: boolean
}

interface HasilImpor {
  sukses: number
  gagal: { baris: number; nama: string; alasan: string }[]
}

export default function KelolaAkun() {
  const [akun, setAkun] = useState<Akun[] | null>(null)
  const [galat, setGalat] = useState('')
  const [cari, setCari] = useState('')
  const [peran, setPeran] = useState('')
  const [status, setStatus] = useState('')
  const [modal, setModal] = useState<'tambah' | 'impor' | null>(null)
  const [pesan, setPesan] = useState('')

  const muat = useCallback(async () => {
    setGalat('')
    try {
      const q = new URLSearchParams({ ...(cari && { cari }), ...(peran && { peran }), ...(status && { status }) })
      setAkun(await get<Akun[]>(`/api/users?${q}`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat akun')
    }
  }, [cari, peran, status])

  useEffect(() => {
    void muat()
  }, [muat])

  const resetSandi = async (a: Akun) => {
    if (!confirm(`Atur ulang kata sandi ${a.name}? Sandi sementara akan dikirim ke emailnya.`)) return
    try {
      const r = await post<{ pesan: string }>(`/api/users/${a.id}/reset-sandi`)
      setPesan(r.pesan)
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal mengatur ulang sandi')
    }
  }

  const ubah = async (a: Akun, data: Partial<Akun>) => {
    try {
      await patch(`/api/users/${a.id}`, data)
      void muat()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengubah akun')
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Kelola Akun</h1>
          <p>Tambah, ubah, dan nonaktifkan akun pengguna. Sandi sementara dikirim lewat email.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setModal('impor')}>Impor Excel</button>
          <button className="btn pr" onClick={() => setModal('tambah')}>+ Tambah Akun</button>
        </div>
      </div>
      {pesan && (
        <div className="ind ok" style={{ marginTop: 0 }}>
          {pesan}
        </div>
      )}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="dn" style={{ marginBottom: 10 }}>
          <input
            style={{ maxWidth: 260 }}
            placeholder="Cari nama, NIP, atau email…"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari akun"
          />
          <select style={{ maxWidth: 160 }} value={peran} onChange={(e) => setPeran(e.target.value)} aria-label="Filter peran">
            <option value="">Semua peran</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User</option>
          </select>
          <select style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
            <option value="">Semua status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && akun === null && <Loading />}
        {!galat && akun?.length === 0 && <Empty title="Belum ada akun yang cocok" hint="Coba ubah kata kunci pencarian." />}
        {akun && akun.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NIP</th>
                  <th>Email</th>
                  <th>Unit</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {akun.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      <br />
                      <span className="hint">{a.phone ?? ''}</span>
                    </td>
                    <td>{a.nip}</td>
                    <td>{a.email}</td>
                    <td>{a.unit ?? '—'}</td>
                    <td>
                      <select
                        value={a.role}
                        onChange={(e) => ubah(a, { role: e.target.value as 'ADMIN' | 'USER' })}
                        aria-label={`Peran ${a.name}`}
                        style={{ padding: '4px 8px' }}
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`bd ${a.active ? 'Berlangsung' : 'Dibatalkan'}`}>{a.active ? 'Aktif' : 'Nonaktif'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn sm" onClick={() => ubah(a, { active: !a.active })}>
                          {a.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button className="btn sm" onClick={() => resetSandi(a)}>
                          Reset Sandi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {modal === 'tambah' && <ModalTambah tutup={() => setModal(null)} selesai={() => { setModal(null); void muat() }} />}
      {modal === 'impor' && <ModalImpor tutup={() => setModal(null)} selesai={() => { setModal(null); void muat() }} />}
    </>
  )
}

function ModalTambah({ tutup, selesai }: { tutup: () => void; selesai: () => void }) {
  const [f, setF] = useState({ name: '', nip: '', email: '', phone: '', unit: '', role: 'USER' })
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setGalat('')
    setProses(true)
    try {
      await post('/api/users', f)
      selesai()
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan akun')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="mod" onClick={(e) => e.target === e.currentTarget && tutup()} role="dialog" aria-modal="true">
      <div className="card">
        <h3>Tambah Akun</h3>
        <form onSubmit={submit}>
          <label htmlFor="ak-nama">Nama lengkap</label>
          <input id="ak-nama" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
          <label htmlFor="ak-nip">NIP</label>
          <input id="ak-nip" value={f.nip} onChange={(e) => setF({ ...f, nip: e.target.value })} required pattern="\d{6,20}" title="6-20 angka" />
          <label htmlFor="ak-email">Email dinas</label>
          <input id="ak-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <label htmlFor="ak-hp">Nomor HP (opsional)</label>
          <input id="ak-hp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <label htmlFor="ak-unit">Unit kerja (opsional)</label>
          <input id="ak-unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
          <label htmlFor="ak-peran">Peran</label>
          <select id="ak-peran" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="USER">User (penyelenggara seminar)</option>
            <option value="ADMIN">Admin</option>
          </select>
          {galat && <p className="err" role="alert">{galat}</p>}
          <p className="hint">Sandi sementara dibuat otomatis dan dikirim ke email pengguna.</p>
          <div className="acts">
            <button type="button" className="btn" onClick={tutup}>Batal</button>
            <button className="btn pr" disabled={proses}>{proses ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalImpor({ tutup, selesai }: { tutup: () => void; selesai: () => void }) {
  const [berkas, setBerkas] = useState<File | null>(null)
  const [proses, setProses] = useState(false)
  const [hasil, setHasil] = useState<HasilImpor | null>(null)
  const [galat, setGalat] = useState('')

  const kirim = async () => {
    if (!berkas) return
    setProses(true)
    setGalat('')
    try {
      const fd = new FormData()
      fd.append('file', berkas)
      setHasil(await post<HasilImpor>('/api/users/impor', fd))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal mengimpor')
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="mod" onClick={(e) => e.target === e.currentTarget && tutup()} role="dialog" aria-modal="true">
      <div className="card">
        <h3>Impor Akun dari Excel</h3>
        <p className="hint" style={{ marginTop: 6 }}>
          Kolom yang dibaca: <b>Nama, NIP, Email, HP, Unit, Peran</b>. Baris dengan NIP/email ganda atau tidak valid
          akan dilewati dan dilaporkan.
        </p>
        {!hasil ? (
          <>
            <label htmlFor="impor-berkas">Berkas .xlsx</label>
            <input
              id="impor-berkas"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
            />
            {galat && <p className="err" role="alert">{galat}</p>}
            <div className="acts">
              <button className="btn" onClick={tutup}>Batal</button>
              <button className="btn pr" onClick={kirim} disabled={!berkas || proses}>
                {proses ? 'Mengimpor…' : 'Impor'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`ind ${hasil.gagal.length ? 'no' : 'ok'}`}>
              {hasil.sukses} akun berhasil dibuat, {hasil.gagal.length} baris gagal.
            </div>
            {hasil.gagal.length > 0 && (
              <div className="sc" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>Nama</th>
                      <th>Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.gagal.map((g, i) => (
                      <tr key={i}>
                        <td>{g.baris}</td>
                        <td>{g.nama}</td>
                        <td>{g.alasan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="acts">
              <button className="btn pr" onClick={selesai}>Selesai</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

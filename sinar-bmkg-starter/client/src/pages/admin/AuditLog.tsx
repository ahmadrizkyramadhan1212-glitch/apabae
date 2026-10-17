// Halaman admin: Audit Log — jejak semua aksi penting.
import { useCallback, useEffect, useState } from 'react'
import { get } from '../../lib/api'
import { Loading, Empty, ErrorBox } from '../../components/ui'

interface Log {
  id: string
  action: string
  target: string
  detail: string | null
  createdAt: string
  user: { name: string; role: string } | null
}

const LABEL: Record<string, string> = {
  LOGIN: 'Masuk',
  LOGIN_GAGAL: 'Masuk gagal',
  GANTI_SANDI: 'Ganti sandi sendiri',
  BUAT_AKUN: 'Buat akun',
  UBAH_AKUN: 'Ubah akun',
  RESET_SANDI: 'Reset sandi',
  IMPOR_AKUN: 'Impor akun',
  BUAT_SEMINAR: 'Ajukan seminar',
  UBAH_SEMINAR: 'Ubah seminar',
  UNGAH_ULANG_DOKUMEN: 'Unggah ulang dokumen',
  AJUKAN_ULANG: 'Ajukan ulang',
  SETUJUI_SEMINAR: 'Setujui seminar',
  KEMBALIKAN_SEMINAR: 'Kembalikan seminar',
  SURAT_ASLI_DITERIMA: 'Surat asli diterima',
  MULAI_SEMINAR: 'Mulai seminar',
  SELESAI_SEMINAR: 'Tutup absensi seminar',
  BATALKAN_SEMINAR: 'Batalkan seminar',
  BATALKAN_SEMINAR_ADMIN: 'Batalkan seminar (admin)',
  HAPUS_SEMINAR: 'Hapus seminar',
  TAMBAH_MATERI: 'Tambah materi',
  HAPUS_MATERI: 'Hapus materi',
  TAYANGKAN_BERITA: 'Tayangkan berita',
  UBAH_BERITA: 'Ubah berita',
  HAPUS_BERITA: 'Hapus berita',
  TAMBAH_PESERTA: 'Tambah peserta manual',
  HAPUS_PESERTA: 'Hapus peserta',
  AKTIFKAN_KODE_HADIR: 'Aktifkan kode hadir',
  ABSENSI: 'Peserta absen',
  GENERATE_SERTIFIKAT: 'Buat sertifikat',
  KIRIM_SERTIFIKAT: 'Kirim sertifikat',
  KIRIM_ULANG: 'Kirim ulang email',
}

export default function AuditLog() {
  const [logs, setLogs] = useState<Log[] | null>(null)
  const [galat, setGalat] = useState('')
  const [cari, setCari] = useState('')

  const muat = useCallback(async () => {
    setGalat('')
    try {
      setLogs(await get<Log[]>(`/api/audit?cari=${encodeURIComponent(cari)}&ambil=200`))
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat audit log')
    }
  }, [cari])

  useEffect(() => {
    void muat()
  }, [muat])

  return (
    <>
      <div className="top">
        <div>
          <h1>Audit Log</h1>
          <p>Semua aksi admin dan aksi penting pengguna tercatat di sini.</p>
        </div>
        <input placeholder="Cari aksi, nama, target…" value={cari} onChange={(e) => setCari(e.target.value)} style={{ maxWidth: 260 }} aria-label="Cari audit log" />
      </div>
      <div className="card">
        {galat && <ErrorBox message={galat} onCobaLagi={muat} />}
        {!galat && logs === null && <Loading />}
        {!galat && logs?.length === 0 && <Empty title="Belum ada aktivitas" />}
        {logs && logs.length > 0 && (
          <div className="sc">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aksi</th>
                  <th>Sasaran</th>
                  <th>Rincian</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                    <td>
                      {l.user?.name ?? <em className="hint">Sistem/tamu</em>}
                    </td>
                    <td>
                      <span className="bd Menunggu">{LABEL[l.action] ?? l.action}</span>
                    </td>
                    <td>{l.target}</td>
                    <td className="hint" style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>{l.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

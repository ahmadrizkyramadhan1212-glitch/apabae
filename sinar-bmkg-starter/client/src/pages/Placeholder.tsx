// Placeholder yang diisi pada sprint berikutnya.
export function HalamanPlaceholder({ judul, sprint }: { judul: string; sprint: string }) {
  return (
    <>
      <div className="top">
        <h1>{judul}</h1>
      </div>
      <div className="card">
        <p className="hint">Fitur ini dikerjakan pada {sprint}.</p>
      </div>
    </>
  )
}

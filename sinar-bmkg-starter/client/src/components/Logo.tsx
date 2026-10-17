// Logo BMKG resmi (PNG transparan di public/logo-bmkg.png).
// Ditampung di chip putih agar terbaca di tema terang maupun gelap.
export function Logo({ height = 46 }: { height?: number }) {
  return (
    <img
      src="/logo-bmkg.png"
      alt="Logo BMKG"
      height={height}
      style={{
        width: 'auto',
        background: '#ffffff',
        borderRadius: 12,
        padding: 4,
        boxSizing: 'content-box',
        display: 'block',
      }}
    />
  )
}

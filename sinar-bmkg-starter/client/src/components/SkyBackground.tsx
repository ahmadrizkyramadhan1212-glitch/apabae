// Latar langit hidup: matahari (terang) / bulan + bintang (gelap) dan awan yang bergerak.
// Awan dihasilkan sekali dengan posisi acak yang stabil.
const BINTANG = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: (i * 137.5) % 100,
  top: (i * 61.8) % 55,
  size: 1 + ((i * 7) % 3) * 0.7,
  delay: ((i * 13) % 35) / 10,
}))

const AWAN = [
  { top: 6, dur: 95, delay: 0 },
  { top: 16, dur: 130, delay: -40 },
  { top: 27, dur: 110, delay: -70 },
  { top: 40, dur: 150, delay: -20 },
  { top: 55, dur: 120, delay: -90 },
  { top: 68, dur: 170, delay: -55 },
]

export default function SkyBackground() {
  return (
    <div id="sky" aria-hidden="true">
      <div className="sun" />
      <div className="moon" />
      <div id="stars">
        {BINTANG.map((b) => (
          <i
            key={b.id}
            style={{ left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size, animationDelay: `${b.delay}s` }}
          />
        ))}
      </div>
      {AWAN.map((c, i) => (
        <div
          key={i}
          className="cl"
          style={{ top: `${c.top}%`, ['--t' as string]: `${c.dur}s`, ['--w' as string]: `${c.delay}s`, ['--sx' as string]: `${8 + i * 14}%` }}
        />
      ))}
    </div>
  )
}

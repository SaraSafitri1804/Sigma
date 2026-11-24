// Grafik donat SVG. segments: [{ value, color }], total = jumlah penuh lingkaran.
export default function Donut({ segments, total, size = 120, r = 46, stroke = 14, track = '#D5DAE2', label }) {
  const C = 2 * Math.PI * r;
  const half = size / 2;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90" role="img" aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx={half} cy={half} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i} cx={half} cy={half} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${len} ${C}`} strokeDashoffset={-offset} strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
    </svg>
  );
}

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

export default function Sparkline({ data, width = 80, height = 24, color, fillOpacity = 0.15 }: Props) {
  if (data.length < 2) return <span className="text-zinc-700 text-xs">—</span>

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as [number, number]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const fillPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(height - pad).toFixed(1)} L${pts[0][0].toFixed(1)},${(height - pad).toFixed(1)} Z`

  const last = data[data.length - 1]
  const prev = data[data.length - 2]
  const autoColor = color ?? (last > prev ? '#f87171' : last < prev ? '#34d399' : '#71717a')

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <path d={fillPath} fill={autoColor} fillOpacity={fillOpacity} />
      <path d={linePath} fill="none" stroke={autoColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={autoColor} />
    </svg>
  )
}

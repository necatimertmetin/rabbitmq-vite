import { useState, useMemo } from 'react'
import type { QueueWithDelta } from '../types'
import type { QueueHistory } from '../history'
import { parseQueueName, hasKnownSeller } from '../sellerNames'

// ── Palette ────────────────────────────────────────────────────────────────
const G    = '#0ecb81'
const R    = '#f6465d'
const Y    = '#f0b90b'
const BG   = '#0b0e11'
const PNL  = '#161a1e'
const BRD  = '#2b2f35'
const TX   = '#eaecef'
const MUT  = '#848e9c'

// ── Helpers ────────────────────────────────────────────────────────────────
function r2(v?: number) { return (v ?? 0).toFixed(2) }

function formatTs(ts: number, rangeMs: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return rangeMs < 30 * 60_000 ? `${h}:${m}:${s}` : `${h}:${m}`
}

function fmt(n: number, digits = 2) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(digits)}K`
  return n.toLocaleString('tr-TR')
}

function short(q: QueueWithDelta) {
  const p = hasKnownSeller(q.name) ? parseQueueName(q.name) : null
  return p?.operation ?? q.name.split('.').pop() ?? q.name
}
function sel(q: QueueWithDelta) {
  const p = hasKnownSeller(q.name) ? parseQueueName(q.name) : null
  return p?.seller ?? ''
}
function hCol(q: QueueWithDelta) {
  return q.health === 'critical' ? R : q.health === 'warning' ? Y : TX
}

function etaStr(q: QueueWithDelta) {
  if (q.messages_ready === 0) return '—'
  const ack = q.message_stats?.ack_details?.rate ?? 0
  const pub = q.message_stats?.publish_details?.rate ?? 0
  if (ack === 0) return 'işlenmiyor'
  const net = ack - pub
  if (net <= 0)  return '↑ büyüyor'
  const s = q.messages_ready / net
  if (s < 60)   return `${Math.round(s)}sn`
  if (s < 3600) { const m = Math.floor(s/60), sec = Math.round(s%60); return sec>0?`${m}dk ${sec}sn`:`${m}dk` }
  const h = Math.floor(s/3600), m = Math.round((s%3600)/60)
  return m>0?`${h}sa ${m}dk`:`${h}sa`
}

// ── Candlestick helpers ────────────────────────────────────────────────────
interface Candle { open: number; close: number; high: number; low: number; vol: number }

// Her veri noktası kendi mumu — open: önceki nokta, close: bu nokta
function buildCandles(data: number[], rates: number[]): Candle[] {
  if (data.length < 2) return []
  return data.slice(1).map((close, i) => {
    const open = data[i]
    return {
      open,
      close,
      high: Math.max(open, close),
      low:  Math.min(open, close),
      vol:  rates[i + 1] ?? 0,
    }
  })
}

// ── Candlestick chart ──────────────────────────────────────────────────────
function CandleChart({ data, rates, timestamps }: { data: number[]; rates: number[]; timestamps: number[] }) {
  if (data.length < 4) {
    return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: MUT }}>Veri biriktirilıyor…</div>
  }

  const candles   = buildCandles(data, rates)
  const candleTs  = timestamps.slice(1) // candle i closes at timestamps[i+1]
  const rangeMs   = candleTs.length > 1 ? candleTs[candleTs.length - 1] - candleTs[0] : 0

  const W = 1000; const H = 220
  const padT = 10; const padB = 30; const padL = 6; const padR = 76
  const cW = W - padL - padR; const cH = H - padT - padB

  const allVals  = candles.flatMap(c => [c.high, c.low])
  const minV     = Math.min(...allVals)
  const maxV     = Math.max(...allVals)
  const range    = maxV - minV || 1

  const yS  = (v: number) => padT + (1 - (v - minV) / range) * cH
  const xS  = (i: number) => padL + (i + 0.5) / candles.length * cW
  const bW  = Math.max(3, cW / candles.length * 0.55)

  const last     = candles[candles.length - 1]
  const lastY    = yS(last.close)
  const lastCol  = last.close <= last.open ? G : R
  const lastYPct = ((lastY - padT) / cH) * 100

  const maxVol = Math.max(...candles.map(c => c.vol), 1)
  const VOL_H  = 42

  const levels = [0, 0.25, 0.5, 0.75, 1].map(p => ({ pct: p, val: maxV - p * range }))

  // X-axis: pick up to 7 evenly spaced label indices
  const N_LABELS = 7
  const step = Math.max(1, Math.floor(candles.length / N_LABELS))
  const xLabelIdxs: number[] = []
  for (let i = 0; i < candles.length; i += step) xLabelIdxs.push(i)

  return (
    <div className="flex-1 flex flex-col min-h-0 px-2 pt-2 pb-1">
      {/* Candle area */}
      <div className="flex-1 relative min-h-0">
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          {/* Horizontal grid */}
          {levels.map(({ pct, val }) => {
            const y = padT + pct * cH
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1e2329" strokeWidth="1" />
                <text x={W - padR + 4} y={y + 5} fill={MUT} fontSize="18" style={{ fontFamily: 'monospace' }}>{fmt(val)}</text>
              </g>
            )
          })}

          {/* X axis baseline */}
          <line x1={padL} y1={padT + cH} x2={W - padR} y2={padT + cH} stroke="#1e2329" strokeWidth="1" />

          {/* Last price dashed line */}
          <line x1={padL} y1={lastY} x2={W - padR} y2={lastY}
                stroke={lastCol} strokeWidth="0.8" strokeDasharray="5 4" opacity="0.75" />

          {/* Candles */}
          {candles.map((c, i) => {
            const x   = xS(i)
            const col = c.close <= c.open ? G : R
            const top = yS(Math.max(c.open, c.close))
            const bot = yS(Math.min(c.open, c.close))
            const bH  = Math.max(1.5, bot - top)
            return (
              <g key={i}>
                <line x1={x} y1={yS(c.high)} x2={x} y2={yS(c.low)} stroke={col} strokeWidth="1.2" />
                <rect x={x - bW / 2} y={top} width={bW} height={bH} fill={col} opacity="0.92" rx="0.5" />
              </g>
            )
          })}

          {/* X-axis time labels */}
          {xLabelIdxs.map(i => {
            if (!candleTs[i]) return null
            const x = xS(i)
            return (
              <g key={i}>
                <line x1={x} y1={padT + cH} x2={x} y2={padT + cH + 5} stroke="#2b2f35" strokeWidth="1" />
                <text x={x} y={H - 4} textAnchor="middle" fill={MUT} fontSize="14" style={{ fontFamily: 'monospace' }}>
                  {formatTs(candleTs[i], rangeMs)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Last price badge (absolute positioned) */}
        <div className="absolute right-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
             style={{ top: `${lastYPct}%`, transform: 'translateY(-50%)', background: lastCol, color: '#000', minWidth: 52, textAlign: 'center' }}>
          {fmt(last.close)}
        </div>
      </div>

      {/* Volume bars */}
      {candles.some(c => c.vol > 0) && (
        <div className="shrink-0" style={{ height: VOL_H }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${VOL_H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            {candles.map((c, i) => {
              const x   = xS(i)
              const col = c.close <= c.open ? G : R
              const bH  = Math.max(1, (c.vol / maxVol) * (VOL_H - 4))
              return (
                <rect key={i} x={x - bW / 2} y={VOL_H - bH} width={bW} height={bH}
                      fill={col} opacity="0.5" rx="0.5" />
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

// ── Area chart (fallback / toggle) ─────────────────────────────────────────
function AreaChart({ data, rates, timestamps }: { data: number[]; rates: number[]; timestamps: number[] }) {
  if (data.length < 2) return <div className="flex-1 flex items-center justify-center text-sm" style={{ color: MUT }}>Veri biriktirilıyor…</div>

  const rangeMs = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0

  const W = 1000; const H = 220
  const padT = 10; const padB = 30; const padL = 10; const padR = 76
  const cW = W - padL - padR; const cH = H - padT - padB

  const minV = Math.min(...data); const maxV = Math.max(...data); const range = maxV - minV || 1
  const yS = (v: number) => padT + (1 - (v - minV) / range) * cH
  const xS = (i: number) => padL + (i / (data.length - 1)) * cW

  const pts = data.map((v, i): [number, number] => [xS(i), yS(v)])
  const line = pts.map(([x, y], i) => `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const fill = `${line} L${pts[pts.length-1][0].toFixed(1)},${padT+cH} L${pts[0][0].toFixed(1)},${padT+cH} Z`

  const last   = data[data.length - 1]
  const prev   = data[data.length - 2]
  const col    = last > prev ? R : last < prev ? G : MUT
  const lastY  = yS(last)
  const lastYP = ((lastY - padT) / cH) * 100

  const maxVol = Math.max(...rates, 1)
  const VOL_H  = 42

  const levels = [0, 0.25, 0.5, 0.75, 1].map(p => ({ pct: p, val: maxV - p * range }))

  // X-axis: pick up to 7 evenly spaced label indices
  const N_LABELS = 7
  const step = Math.max(1, Math.floor(data.length / N_LABELS))
  const xLabelIdxs: number[] = []
  for (let i = 0; i < data.length; i += step) xLabelIdxs.push(i)

  return (
    <div className="flex-1 flex flex-col min-h-0 px-2 pt-2 pb-1">
      <div className="flex-1 relative min-h-0">
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={col} stopOpacity="0.28"/>
              <stop offset="100%" stopColor={col} stopOpacity="0.02"/>
            </linearGradient>
          </defs>
          {levels.map(({ pct, val }) => {
            const y = padT + pct * cH
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1e2329" strokeWidth="1"/>
                <text x={W - padR + 4} y={y + 5} fill={MUT} fontSize="18" style={{ fontFamily: 'monospace' }}>{fmt(val)}</text>
              </g>
            )
          })}

          {/* X axis baseline */}
          <line x1={padL} y1={padT + cH} x2={W - padR} y2={padT + cH} stroke="#1e2329" strokeWidth="1"/>

          <line x1={padL} y1={lastY} x2={W-padR} y2={lastY} stroke={col} strokeWidth="0.8" strokeDasharray="5 4" opacity="0.7"/>
          <path d={fill} fill="url(#ag2)"/>
          <path d={line} fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>

          {/* X-axis time labels */}
          {xLabelIdxs.map(i => {
            if (!timestamps[i]) return null
            const x = xS(i)
            return (
              <g key={i}>
                <line x1={x} y1={padT + cH} x2={x} y2={padT + cH + 5} stroke="#2b2f35" strokeWidth="1"/>
                <text x={x} y={H - 4} textAnchor="middle" fill={MUT} fontSize="14" style={{ fontFamily: 'monospace' }}>
                  {formatTs(timestamps[i], rangeMs)}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="absolute right-0 text-[10px] font-bold px-1.5 py-0.5 rounded"
             style={{ top: `${lastYP}%`, transform: 'translateY(-50%)', background: col, color: '#000', minWidth: 52, textAlign: 'center' }}>
          {fmt(last)}
        </div>
      </div>
      {rates.some(v => v > 0) && (
        <div className="shrink-0" style={{ height: VOL_H }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${VOL_H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            {rates.map((v, i) => {
              const x  = padL + (i / (rates.length - 1)) * cW
              const bH = Math.max(1, (v / maxVol) * (VOL_H - 4))
              return <rect key={i} x={x-4} y={VOL_H-bH} width={8} height={bH} fill={G} opacity="0.5" rx="0.5"/>
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

// ── Order book row ─────────────────────────────────────────────────────────
function BookRow({ name, value, cumPct, side, onClick }: {
  name: string; value: number; cumPct: number; side: 'ask'|'bid'; onClick?: () => void
}) {
  const col = side === 'ask' ? R : G
  const bg  = side === 'ask' ? 'rgba(246,70,93,0.1)' : 'rgba(14,203,129,0.1)'
  const dir = side === 'ask' ? 'right' : 'left'
  return (
    <button onClick={onClick}
            className="relative w-full flex items-center justify-between px-2 py-[3.5px] hover:bg-white/5 transition text-left"
            style={{ fontFamily: 'monospace', fontSize: 11 }}>
      <div className={`absolute inset-y-0 ${dir === 'right' ? 'right-0' : 'left-0'}`}
           style={{ width: `${cumPct}%`, background: bg }} />
      <span className="relative z-10 truncate" style={{ color: col, maxWidth: 96 }}>{name}</span>
      <span className="relative z-10 tabular-nums shrink-0" style={{ color: col }}>
        {value === 0 ? <span style={{ color: '#3a3f46' }}>0</span> : fmt(value)}
      </span>
    </button>
  )
}

// ── Right pair row ─────────────────────────────────────────────────────────
function PairRow({ q, selected, onClick }: { q: QueueWithDelta; selected: boolean; onClick: () => void }) {
  const dc = (q.deltaReady??0) > 0 ? R : (q.deltaReady??0) < 0 ? G : MUT
  return (
    <button onClick={onClick}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-white/5 transition"
            style={{ borderLeft: selected ? `2px solid ${Y}` : '2px solid transparent' }}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate" style={{ color: TX }}>{short(q)}</div>
        {sel(q) && <div className="text-[10px] truncate" style={{ color: MUT }}>{sel(q)}</div>}
      </div>
      <div className="ml-2 text-right shrink-0">
        <div className="text-xs font-semibold tabular-nums" style={{ color: hCol(q) }}>{fmt(q.messages_ready)}</div>
        <div className="text-[10px] tabular-nums" style={{ color: dc }}>
          {q.deltaReady == null || q.deltaReady === 0 ? '—' : (q.deltaReady > 0 ? '+' : '') + q.deltaReady}
        </div>
      </div>
    </button>
  )
}

type LTab = 'ALL' | 'MAIN' | 'DLQ' | 'RETRY' | 'SPAPI'
type ChartType = 'candle' | 'area'
type TimeWindow = '5m' | '15m' | '30m' | '1h' | 'all'

const TIME_WINDOWS: { label: string; value: TimeWindow; ms: number | null }[] = [
  { label: '5m',  value: '5m',  ms: 5  * 60_000 },
  { label: '15m', value: '15m', ms: 15 * 60_000 },
  { label: '30m', value: '30m', ms: 30 * 60_000 },
  { label: '1sa', value: '1h',  ms: 60 * 60_000 },
  { label: 'Tümü', value: 'all', ms: null },
]

// ── Main ───────────────────────────────────────────────────────────────────
export default function BinanceLayout({ queues, history, intervalMs }: {
  queues: QueueWithDelta[]; history: QueueHistory; intervalMs: number
}) {
  const [selKey,     setSelKey]     = useState(() => queues[0] ? `${queues[0].vhost}/${queues[0].name}` : '')
  const [search,     setSearch]     = useState('')
  const [lTab,       setLTab]       = useState<LTab>('ALL')
  const [chartType,  setChartType]  = useState<ChartType>('candle')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('all')

  const q    = queues.find(x => `${x.vhost}/${x.name}` === selKey) ?? queues[0] ?? null
  const ack  = q?.message_stats?.ack_details?.rate    ?? 0
  const pub  = q?.message_stats?.publish_details?.rate ?? 0
  const dlv  = q?.message_stats?.deliver_get_details?.rate ?? 0
  const rdlv = q?.message_stats?.redeliver_details?.rate   ?? 0
  const net  = ack - pub
  const qCol = q ? hCol(q) : MUT
  const dCol = (q?.deltaReady??0) > 0 ? R : (q?.deltaReady??0) < 0 ? G : MUT

  // Order book
  const asks = useMemo(() => queues.filter(x => x.messages_ready > 0).sort((a,b)=>b.messages_ready-a.messages_ready).slice(0,16), [queues])
  const bids = useMemo(() => queues.filter(x => x.messages_ready === 0 && x.consumers > 0).slice(0, 10), [queues])
  const maxAsk = asks[0]?.messages_ready ?? 1
  let cumAsk = 0
  const askRows = asks.map(x => { cumAsk += x.messages_ready; return { x, pct: Math.min(98, (x.messages_ready / maxAsk) * 100) } })

  // Chart
  const allHist  = q ? (history.get(`${q.vhost}/${q.name}`) ?? []) : []
  const twCfg    = TIME_WINDOWS.find(w => w.value === timeWindow)!
  const hist     = twCfg.ms == null
    ? allHist
    : allHist.filter(p => p.ts >= Date.now() - twCfg.ms!)
  const chart      = hist.map(p => p.ready)
  const rates      = hist.map(p => p.arrived)
  const timestamps = hist.map(p => p.ts)

  const ma7  = chart.length >= 7  ? chart.slice(-7).reduce((a,b)=>a+b,0)/7   : null
  const ma25 = chart.length >= 25 ? chart.slice(-25).reduce((a,b)=>a+b,0)/25 : null

  // Pair list
  const pairList = useMemo(() =>
    queues
      .filter(x => lTab === 'ALL' || x.queueType === lTab.toLowerCase())
      .filter(x => {
        if (!search) return true
        const lo = search.toLowerCase()
        if (x.name.toLowerCase().includes(lo)) return true
        const p = hasKnownSeller(x.name) ? parseQueueName(x.name) : null
        return !!(p?.seller.toLowerCase().includes(lo) || p?.operation.toLowerCase().includes(lo))
      })
      .sort((a,b) => b.messages_ready - a.messages_ready),
    [queues, lTab, search])

  // Activity
  const activity = useMemo(() =>
    queues.filter(x => x.deltaReady !== null && x.deltaReady !== 0)
          .sort((a,b) => Math.abs(b.deltaReady??0)-Math.abs(a.deltaReady??0))
          .slice(0,18),
    [queues])

  const eta = q ? etaStr(q) : '—'

  const typeBadge = q ? ({
    dlq:   { bg:'rgba(246,70,93,0.18)',   color: R },
    retry: { bg:'rgba(240,185,11,0.18)',  color: Y },
    spapi: { bg:'rgba(99,135,255,0.18)',  color:'#6387ff' },
    main:  { bg:'rgba(132,142,156,0.15)', color: MUT },
  }[q.queueType]) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 130px)', minHeight:520, background:BG, borderRadius:4, overflow:'hidden', border:`1px solid ${BRD}` }}>

      {/* ── Ticker header ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:20, padding:'8px 16px', borderBottom:`1px solid ${BRD}`, background:PNL, overflowX:'auto', flexShrink:0 }}>
        {/* Symbol */}
        <div style={{ flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontWeight:700, fontSize:14, color:TX }}>{q?short(q):'—'}</span>
            {q && sel(q) && <span style={{ fontSize:12, color:MUT }}>{sel(q)}</span>}
            {typeBadge && <span style={{ fontSize:10, padding:'2px 5px', borderRadius:3, fontWeight:600, background:typeBadge.bg, color:typeBadge.color }}>{q!.queueType.toUpperCase()}</span>}
          </div>
        </div>

        {/* Ready (price) */}
        <div style={{ flexShrink:0 }}>
          <div style={{ fontSize:20, fontWeight:700, color:qCol, fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>{q?fmt(q.messages_ready):'—'}</div>
          <div style={{ fontSize:11, color:MUT }}>Bekleyen</div>
        </div>

        {/* Delta */}
        <div style={{ flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:dCol, fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>
            {q?.deltaReady==null?'—':(q.deltaReady>0?'+':'')+q.deltaReady}
          </div>
          <div style={{ fontSize:11, color:MUT }}>Değişim</div>
        </div>

        <div style={{ width:1, height:24, background:BRD, flexShrink:0 }} />

        {[
          { label:'İşlemde',       value: q?fmt(q.messages_unacknowledged):'—',  color:(q?.messages_unacknowledged??0)>0?'#f48fb1':MUT },
          { label:'Consumer',      value: q?String(q.consumers):'—',             color:(q?.consumers??0)>0?G:MUT },
          { label:'Gelen/s',       value: r2(pub),   color:'#60a5fa' },
          { label:'İşlenen/s',     value: r2(ack),   color:G },
          { label:'Deliver/s',     value: r2(dlv),   color:'#818cf8' },
          { label:'Tekrar/s',      value: r2(rdlv),  color:rdlv>0?R:MUT },
          { label:'ETA',           value: eta,        color:net>0?G:net<0?R:MUT },
          { label:`+${intervalMs/1000}s Gelen`,   value: q?`+${q.arrivedPerInterval}`:'—',   color:'#60a5fa' },
          { label:`+${intervalMs/1000}s İşlenen`, value: q?String(q.processedPerInterval):'—', color:G },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flexShrink:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color, fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>{value}</div>
            <div style={{ fontSize:11, color:MUT }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── 3-column body ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', flex:1, minHeight:0 }}>

        {/* ── Left: Order Book ──────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', flexShrink:0, width:192, borderRight:`1px solid ${BRD}`, background:PNL }}>
          <div style={{ padding:'7px 8px', fontSize:12, fontWeight:600, color:TX, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
            Mesaj Kitabı
          </div>
          {/* Column headers */}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 8px', fontSize:10, color:MUT, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
            <span>Kuyruk</span><span>Bekleyen</span>
          </div>

          {/* Asks (problems) – reversed */}
          <div style={{ flex:'1 1 0', overflowY:'auto', display:'flex', flexDirection:'column-reverse' }}>
            {askRows.map(({ x, pct }) => (
              <BookRow key={`${x.vhost}/${x.name}`} name={short(x)} value={x.messages_ready} cumPct={pct} side="ask"
                       onClick={() => setSelKey(`${x.vhost}/${x.name}`)} />
            ))}
          </div>

          {/* Spread row */}
          <div style={{ flexShrink:0, padding:'6px 8px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#1e2329', borderTop:`1px solid ${BRD}`, borderBottom:`1px solid ${BRD}` }}>
            <span style={{ fontSize:15, fontWeight:700, color:qCol, fontVariantNumeric:'tabular-nums' }}>{q?fmt(q.messages_ready):'—'}</span>
            <span style={{ fontSize:11, color: q?.health==='critical'?R : q?.health==='warning'?Y : G }}>
              {q?.health==='critical'?'⚠ Kritik':q?.health==='warning'?'! Uyarı':'✓ Normal'}
            </span>
          </div>

          {/* Bids (healthy) */}
          <div style={{ flex:'1 1 0', overflowY:'auto' }}>
            {bids.map(x => (
              <BookRow key={`${x.vhost}/${x.name}`} name={short(x)} value={0} cumPct={0} side="bid"
                       onClick={() => setSelKey(`${x.vhost}/${x.name}`)} />
            ))}
            {bids.length === 0 && <div style={{ padding:'10px 8px', fontSize:11, color:MUT }}>Sağlıklı kuyruk yok</div>}
          </div>
        </div>

        {/* ── Center: Chart ──────────────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:BG }}>
          {/* Toolbar */}
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderBottom:`1px solid ${BRD}`, flexWrap:'wrap' }}>
            {/* Chart type toggle */}
            <div style={{ display:'flex', borderRadius:3, overflow:'hidden', border:`1px solid ${BRD}` }}>
              {(['candle','area'] as ChartType[]).map(t => (
                <button key={t} onClick={() => setChartType(t)}
                        style={{ padding:'2px 8px', fontSize:11, fontWeight:500, cursor:'pointer', border:'none',
                                 background: chartType===t ? '#2b2f35' : 'transparent',
                                 color: chartType===t ? TX : MUT }}>
                  {t === 'candle' ? 'Mum' : 'Alan'}
                </button>
              ))}
            </div>

            <span style={{ fontSize:11, color:BRD }}>│</span>

            {/* Time window buttons */}
            <div style={{ display:'flex', borderRadius:3, overflow:'hidden', border:`1px solid ${BRD}` }}>
              {TIME_WINDOWS.map(w => (
                <button key={w.value} onClick={() => setTimeWindow(w.value)}
                        style={{ padding:'2px 8px', fontSize:11, fontWeight:500, cursor:'pointer', border:'none',
                                 background: timeWindow===w.value ? '#2b2f35' : 'transparent',
                                 color: timeWindow===w.value ? Y : MUT }}>
                  {w.label}
                </button>
              ))}
            </div>

            <span style={{ fontSize:11, color:BRD }}>│</span>
            <span style={{ fontSize:11, padding:'2px 7px', borderRadius:3, background:'#2b2f35', color:TX }}>{intervalMs/1000}s</span>

            <div style={{ marginLeft:'auto', display:'flex', gap:16, fontSize:11, color:MUT }}>
              {ma7  != null && <span>MA(7): <span style={{ color:Y }}>{fmt(ma7)}</span></span>}
              {ma25 != null && <span>MA(25): <span style={{ color:'#8358f5' }}>{fmt(ma25)}</span></span>}
              <span>{hist.length} ölçüm</span>
            </div>
          </div>

          {/* Chart */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
            {chartType === 'candle'
              ? <CandleChart data={chart} rates={rates} timestamps={timestamps} />
              : <AreaChart   data={chart} rates={rates} timestamps={timestamps} />
            }
          </div>

          {/* Stats bottom bar */}
          <div style={{ flexShrink:0, padding:12, borderTop:`1px solid ${BRD}`, background:PNL }}>
            <div style={{ display:'flex', gap:10 }}>
              {/* 4 rate cards */}
              <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  { label:'Gelen / sn',   value:r2(pub),  color:'#60a5fa' },
                  { label:'Deliver / sn', value:r2(dlv),  color:'#818cf8' },
                  { label:'İşlenen / sn', value:r2(ack),  color:G },
                  { label:'Tekrar / sn',  value:r2(rdlv), color:rdlv>0?R:MUT },
                ] as const).map(({ label, value, color }) => (
                  <div key={label} style={{ background:'#1e2329', borderRadius:4, padding:'8px 10px' }}>
                    <div style={{ fontSize:10, color:MUT, marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color, fontVariantNumeric:'tabular-nums' }}>{value}</div>
                  </div>
                ))}
              </div>
              {/* Net + Consumer */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, width:144 }}>
                <div style={{ background:'#1e2329', borderRadius:4, padding:'8px 10px', flex:1 }}>
                  <div style={{ fontSize:10, color:MUT, marginBottom:2 }}>Net Hız</div>
                  <div style={{ fontSize:15, fontWeight:700, color:net>0?G:net<0?R:MUT, fontVariantNumeric:'tabular-nums' }}>
                    {net>0?'+':''}{net.toFixed(2)}/s
                  </div>
                  <div style={{ fontSize:10, color:MUT, marginTop:2 }}>İşlenen − Gelen</div>
                </div>
                {q?.consumer_utilisation != null && q.consumer_utilisation > 0 && (
                  <div style={{ background:'#1e2329', borderRadius:4, padding:'8px 10px' }}>
                    <div style={{ fontSize:10, color:MUT, marginBottom:3 }}>Consumer Util.</div>
                    <div style={{ fontSize:13, fontWeight:700, color:TX }}>%{Math.round(q.consumer_utilisation*100)}</div>
                    <div style={{ marginTop:5, height:3, borderRadius:99, background:'#2b2f35', overflow:'hidden' }}>
                      <div style={{ width:`${q.consumer_utilisation*100}%`, height:'100%', borderRadius:99,
                                    background: q.consumer_utilisation>=0.9?R:q.consumer_utilisation>=0.7?Y:G }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Pairs + Activity ────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', flexShrink:0, width:264, borderLeft:`1px solid ${BRD}`, background:PNL }}>
          {/* Search */}
          <div style={{ padding:7, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
            <input type="text" placeholder="Kuyruk ara…" value={search}
                   onChange={e => setSearch(e.target.value)}
                   style={{ width:'100%', background:'#2b2f35', border:'none', borderRadius:4, padding:'6px 10px', fontSize:12, color:TX, outline:'none', caretColor:Y, boxSizing:'border-box' }} />
          </div>

          {/* Type tabs */}
          <div style={{ display:'flex', flexShrink:0, borderBottom:`1px solid ${BRD}` }}>
            {(['ALL','MAIN','DLQ','RETRY','SPAPI'] as LTab[]).map(t => (
              <button key={t} onClick={() => setLTab(t)}
                      style={{ flex:1, padding:'5px 0', fontSize:10, fontWeight:600, cursor:'pointer', border:'none', background:'transparent',
                               color: lTab===t?Y:MUT, borderBottom: lTab===t?`2px solid ${Y}`:'2px solid transparent' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px', fontSize:10, color:MUT, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
            <span>Kuyruk / Satıcı</span><span>Bekleyen / Δ</span>
          </div>

          {/* Pair list */}
          <div style={{ flex:'0 0 44%', overflowY:'auto' }}>
            {pairList.map(x => (
              <PairRow key={`${x.vhost}/${x.name}`} q={x}
                       selected={`${x.vhost}/${x.name}`===selKey}
                       onClick={() => setSelKey(`${x.vhost}/${x.name}`)} />
            ))}
          </div>

          {/* Activity */}
          <div style={{ display:'flex', flexDirection:'column', flex:'1 1 0', minHeight:0, borderTop:`1px solid ${BRD}` }}>
            <div style={{ padding:'7px 12px', fontSize:12, fontWeight:600, color:TX, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
              Anlık Aktivite
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'3px 12px', fontSize:10, color:MUT, borderBottom:`1px solid ${BRD}`, flexShrink:0 }}>
              <span>Kuyruk</span><span>Δ</span><span>Bekleyen</span>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {activity.length === 0
                ? <div style={{ padding:'12px', fontSize:11, color:MUT }}>Değişim yok</div>
                : activity.map(x => {
                    const dc = (x.deltaReady??0)>0?R:G
                    return (
                      <button key={`${x.vhost}/${x.name}`} onClick={() => setSelKey(`${x.vhost}/${x.name}`)}
                              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 12px', background:'transparent', border:'none', cursor:'pointer', fontSize:11 }}
                              onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.04)')}
                              onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                        <span style={{ color:TX, fontWeight:500, flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:4 }}>{short(x)}</span>
                        <span style={{ color:dc, fontWeight:600, fontVariantNumeric:'tabular-nums', flexShrink:0, marginRight:8 }}>
                          {(x.deltaReady??0)>0?'+':''}{x.deltaReady}
                        </span>
                        <span style={{ color:x.messages_ready>0?TX:MUT, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                          {fmt(x.messages_ready)}
                        </span>
                      </button>
                    )
                  })
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

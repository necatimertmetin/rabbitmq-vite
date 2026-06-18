import { useState } from 'react'
import type { QueueWithDelta } from '../types'
import type { QueueHistory } from '../history'
import MessageModal from './MessageModal'
import { parseQueueName, hasKnownSeller } from '../sellerNames'
import Sparkline from './Sparkline'

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}sn`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return s > 0 ? `${m}dk ${s}sn` : `${m}dk`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}sa ${m}dk` : `${h}sa`
}

function EtaCell({ q }: { q: QueueWithDelta }) {
  if (q.messages_ready === 0) return <span className="text-zinc-600">—</span>
  const ackRate = q.message_stats?.ack_details?.rate ?? 0
  const publishRate = q.message_stats?.publish_details?.rate ?? 0
  const netRate = ackRate - publishRate
  if (ackRate === 0) return <span className="text-zinc-500 text-xs">işlenmiyor</span>
  if (netRate <= 0) return <span className="text-red-400 text-xs font-semibold">büyüyor</span>
  const secs = q.messages_ready / netRate
  const color = secs < 60 ? 'text-green-400' : secs < 300 ? 'text-amber-400' : 'text-red-400'
  return <span className={`text-xs font-semibold ${color}`}>{formatEta(secs)}</span>
}

type Tab = 'all' | 'main' | 'dlq' | 'retry' | 'spapi'

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-zinc-600">—</span>
  if (delta === 0) return <span className="text-zinc-500">→ 0</span>
  if (delta > 0) return <span className="text-red-400 font-semibold">▲ +{delta.toLocaleString('tr-TR')}</span>
  return <span className="text-green-400 font-semibold">▼ {delta.toLocaleString('tr-TR')}</span>
}

function UtilBar({ util }: { util: number }) {
  const pct = Math.round(util * 100)
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400">%{pct}</span>
    </div>
  )
}

function HealthDot({ health }: { health: QueueWithDelta['health'] }) {
  if (health === 'critical') return <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" title="Kritik" />
  if (health === 'warning') return <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Uyarı" />
  return <span className="w-2 h-2 rounded-full bg-green-500/50 inline-block" title="Normal" />
}

function TypeBadge({ type }: { type: QueueWithDelta['queueType'] }) {
  const styles: Record<string, string> = {
    dlq: 'bg-red-900/40 text-red-400',
    retry: 'bg-amber-900/40 text-amber-400',
    spapi: 'bg-blue-900/40 text-blue-400',
    main: 'bg-zinc-800 text-zinc-400',
  }
  const labels: Record<string, string> = { dlq: 'DLQ', retry: 'Retry', spapi: 'SPAPI', main: 'Ana' }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${styles[type]}`}>{labels[type]}</span>
}

function rate(val?: number) {
  if (!val) return '0.0'
  return val.toFixed(1)
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'main', label: 'Ana Kuyruklar' },
  { key: 'dlq', label: 'Ölü Mesaj (DLQ)' },
  { key: 'retry', label: 'Yeniden Deneme' },
  { key: 'spapi', label: 'SP-API' },
]

export default function QueueTable({ queues, history, filter, intervalMs, pageSize }: { queues: QueueWithDelta[]; history: QueueHistory; filter: string; intervalMs: number; pageSize: number }) {
  const [selected, setSelected] = useState<QueueWithDelta | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const intervalLabel = `${intervalMs / 1000}s`

  const filterLower = filter.toLowerCase()
  const filtered = queues
    .filter((q) => tab === 'all' || q.queueType === tab)
    .filter((q) => {
      if (!filterLower) return true
      if (q.name.toLowerCase().includes(filterLower)) return true
      const parsed = hasKnownSeller(q.name) ? parseQueueName(q.name) : null
      if (parsed?.seller.toLowerCase().includes(filterLower)) return true
      if (parsed?.operation.toLowerCase().includes(filterLower)) return true
      return false
    })
    .slice(0, pageSize)

  const tabCounts: Record<Tab, number> = {
    all: queues.length,
    main: queues.filter((q) => q.queueType === 'main').length,
    dlq: queues.filter((q) => q.queueType === 'dlq').length,
    retry: queues.filter((q) => q.queueType === 'retry').length,
    spapi: queues.filter((q) => q.queueType === 'spapi').length,
  }

  return (
    <>
      <div className="flex gap-1 mb-3 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs rounded font-medium transition flex items-center gap-1.5 ${tab === key ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === key ? 'bg-zinc-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{tabCounts[key]}</span>
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500 self-center">{filtered.length} kuyruk gösteriliyor</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-700">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-800 text-zinc-400 text-xs tracking-wider">
            <tr>
              <th className="px-3 py-3 w-6"></th>
              <th className="px-3 py-3">Kuyruk Adı</th>
              <th className="px-3 py-3 text-right" title="Kuyrukta bekleyen, henüz işlenmemiş mesaj sayısı">Bekleyen</th>
              <th className="px-3 py-3 text-right" title="Son yenilemeden bu yana değişim">Δ Değişim</th>
              <th className="px-3 py-3 text-right" title="Consumer tarafından alınmış ama henüz ack edilmemiş">İşlemde</th>
              <th className="px-3 py-3 text-right" title={`Son ${intervalLabel}de kuyruğa giren yeni mesaj sayısı`}>Gelen/{intervalLabel}</th>
              <th className="px-3 py-3 text-right" title={`Son ${intervalLabel}de ack edilen mesaj sayısı`}>İşlenen/{intervalLabel}</th>
              <th className="px-3 py-3 text-right">Consumer</th>
              <th className="px-3 py-3 text-right" title="Saniyede gelen mesaj hızı">Gelen/s</th>
              <th className="px-3 py-3 text-right" title="Saniyede deliver edilen mesaj hızı">Deliver/s</th>
              <th className="px-3 py-3 text-right" title="Saniyede yeniden kuyruğa alınan mesaj (hata göstergesi)">Tekrar/s</th>
              <th className="px-3 py-3 text-right" title="Mevcut hızda tüm mesajlar ne zaman biter">Bitiş</th>
              <th className="px-3 py-3 text-center">Durum</th>
              <th className="px-3 py-3 text-center">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-8 text-center text-zinc-500">Kuyruk bulunamadı</td></tr>
            ) : filtered.map((q) => {
              const redeliverRate = q.message_stats?.redeliver_details?.rate ?? 0
              const rowBg = q.health === 'critical' ? 'bg-red-950/10' : q.health === 'warning' ? 'bg-amber-950/10' : ''
              return (
                <tr key={`${q.vhost}/${q.name}`} className={`hover:bg-zinc-800/50 transition ${rowBg}`}>
                  <td className="px-3 py-3 text-center"><HealthDot health={q.health} /></td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2" title={q.name}>
                      <TypeBadge type={q.queueType} />
                      {hasKnownSeller(q.name) ? (() => {
                        const p = parseQueueName(q.name)!
                        return (
                          <div className="flex items-center gap-0 min-w-0">
                            <span className="text-zinc-300 text-xs font-semibold w-16 shrink-0">{p.seller}</span>
                            <span className="text-zinc-500 text-xs mx-1">·</span>
                            <span className="text-zinc-200 text-xs font-mono">{p.operation}</span>
                            {p.isDlq && <span className="ml-1.5 text-[10px] bg-red-900/40 text-red-400 px-1 rounded">DLQ</span>}
                          </div>
                        )
                      })() : (
                        <span className="font-mono text-zinc-200 truncate text-xs">{q.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(() => {
                        const pts = (history.get(`${q.vhost}/${q.name}`) ?? []).map((p) => p.ready)
                        return pts.length >= 2 ? <Sparkline data={pts} width={56} height={20} /> : null
                      })()}
                      <span className={q.messages_ready > 0 ? 'text-amber-400 font-semibold' : 'text-zinc-400'}>{q.messages_ready.toLocaleString('tr-TR')}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right"><DeltaBadge delta={q.deltaReady} /></td>
                  <td className="px-3 py-3 text-right">
                    <span className={q.messages_unacknowledged > 0 ? 'text-red-400 font-semibold' : 'text-zinc-400'}>{q.messages_unacknowledged.toLocaleString('tr-TR')}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-sky-400 font-medium">
                    {q.arrivedPerInterval > 0 ? `+${q.arrivedPerInterval.toLocaleString('tr-TR')}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-400 font-medium">
                    {q.processedPerInterval > 0 ? q.processedPerInterval.toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={q.consumers > 0 ? 'text-green-400' : 'text-zinc-500'}>{q.consumers}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-zinc-400">{rate(q.message_stats?.publish_details?.rate)}</td>
                  <td className="px-3 py-3 text-right text-zinc-400">{rate(q.message_stats?.deliver_get_details?.rate)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={redeliverRate > 0 ? 'text-red-400 font-semibold' : 'text-zinc-600'}>{redeliverRate > 0 ? redeliverRate.toFixed(2) : '—'}</span>
                  </td>
                  <td className="px-3 py-3 text-right"><EtaCell q={q} /></td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.state === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {q.state === 'running' ? 'Çalışıyor' : q.state}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-medium">
                    {q.deltaReady === null || q.deltaReady === 0
                      ? <span className="text-zinc-600">—</span>
                      : q.deltaReady > 0
                        ? <span className="text-red-400">▲ artıyor</span>
                        : <span className="text-green-400">▼ azalıyor</span>}
                  </td>
                  {/* <td className="px-3 py-3">
                    <button onClick={() => setSelected(q)} className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1 rounded transition whitespace-nowrap">
                      Mesajlar
                    </button>
                  </td> */}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && <MessageModal queueName={selected.name} vhost={selected.vhost} onClose={() => setSelected(null)} />}
    </>
  )
}

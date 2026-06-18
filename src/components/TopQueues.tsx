import type { QueueWithDelta } from '../types'
import type { QueueHistory } from '../history'
import { parseQueueName, hasKnownSeller } from '../sellerNames'
import Sparkline from './Sparkline'

function displayName(name: string): string {
  if (!hasKnownSeller(name)) return name
  const p = parseQueueName(name)!
  return `${p.seller} · ${p.operation}`
}

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

function getEta(q: QueueWithDelta): { label: string; color: string; detail: string } | null {
  if (q.messages_ready === 0) return null
  const ackRate = q.message_stats?.ack_details?.rate ?? 0
  const publishRate = q.message_stats?.publish_details?.rate ?? 0
  const netRate = ackRate - publishRate

  if (ackRate === 0) return { label: 'İşlenmiyor', color: 'text-zinc-500', detail: 'consumer yok veya mesaj işlenmiyor' }
  if (netRate <= 0) return { label: 'Büyüyor', color: 'text-red-400', detail: `gelen (${publishRate.toFixed(1)}/s) > işlenen (${ackRate.toFixed(1)}/s)` }

  const secs = q.messages_ready / netRate
  return {
    label: formatEta(secs),
    color: secs < 60 ? 'text-green-400' : secs < 300 ? 'text-amber-400' : 'text-red-400',
    detail: `${q.messages_ready.toLocaleString('tr-TR')} mesaj ÷ net ${netRate.toFixed(1)}/s`,
  }
}

export default function TopQueues({ queues, history }: { queues: QueueWithDelta[]; history: QueueHistory }) {
  const top5 = [...queues]
    .sort((a, b) => b.messages_ready - a.messages_ready)
    .slice(0, 5)
    .filter((q) => q.messages_ready > 0)

  if (top5.length === 0) return null

  const max = top5[0].messages_ready

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {top5.map((q, i) => {
        const pct = max > 0 ? (q.messages_ready / max) * 100 : 0
        const barColor = i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-amber-500/70' : 'bg-amber-500/40'
        const eta = getEta(q)
        const key = `${q.vhost}/${q.name}`
        const histPoints = history.get(key) ?? []
        const readySeries = histPoints.map((p) => p.ready)
        return (
          <div key={q.name} className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex flex-col gap-2" title={q.name}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase font-medium">#{i + 1}</span>
              {q.deltaReady !== null && q.deltaReady !== 0 && (
                <span className={`text-[10px] font-semibold ${q.deltaReady > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {q.deltaReady > 0 ? '▲' : '▼'} {Math.abs(q.deltaReady).toLocaleString('tr-TR')}
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-zinc-200 truncate">{displayName(q.name)}</div>
            <div className="flex items-end justify-between">
              <div className="text-xl font-bold text-amber-400">{q.messages_ready.toLocaleString('tr-TR')}</div>
              {readySeries.length >= 2 && (
                <Sparkline data={readySeries} width={72} height={28} />
              )}
            </div>
            <div className="w-full h-1 bg-zinc-700 rounded-full">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>{q.consumers} consumer</span>
              <span>{(q.message_stats?.publish_details?.rate ?? 0).toFixed(1)}/s gelen</span>
            </div>
            {eta && (
              <div className="border-t border-zinc-700/50 pt-2 mt-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Tahmini bitiş</span>
                  <span className={`text-xs font-bold ${eta.color}`}>{eta.label}</span>
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{eta.detail}</div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

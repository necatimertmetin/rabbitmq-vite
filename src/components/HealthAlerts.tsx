import type { QueueWithDelta } from '../types'
import { parseQueueName, hasKnownSeller } from '../sellerNames'

function displayName(name: string): string {
  if (!hasKnownSeller(name)) return name
  const p = parseQueueName(name)!
  return `${p.seller} · ${p.operation}`
}

export default function HealthAlerts({ queues }: { queues: QueueWithDelta[] }) {
  const critical = queues.filter((q) => q.health === 'critical')
  const warnings = queues.filter((q) => q.health === 'warning')

  if (critical.length === 0 && warnings.length === 0) return null

  return (
    <div className="mb-5 space-y-2">
      {critical.length > 0 && (
        <div className="bg-red-950/40 border border-red-700/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-sm font-semibold">Kritik Sorun ({critical.length} kuyruk)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {critical.map((q) => (
              <span key={q.name} className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded" title={q.name}>
                {displayName(q.name)}
                {q.consumers === 0 && q.messages_ready > 0 && (
                  <span className="ml-1 text-red-400">· consumer yok, mesajlar işlenemiyor</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-400 text-sm font-semibold">Uyarı ({warnings.length} kuyruk)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {warnings.map((q) => {
              const redeliverRate = q.message_stats?.redeliver_details?.rate ?? 0
              return (
                <span key={q.name} className="text-xs bg-amber-900/50 text-amber-300 px-2 py-1 rounded" title={q.name}>
                  {displayName(q.name)}
                  {redeliverRate > 0 && <span className="ml-1 text-amber-400">· {redeliverRate.toFixed(1)}/s tekrar kuyruğa giriyor</span>}
                  {q.consumer_utilisation >= 1 && q.messages_ready > 500 && <span className="ml-1 text-amber-400">· consumer'lar dolu</span>}
                  {q.deltaReady != null && q.deltaReady > 0 && <span className="ml-1 text-amber-400">· +{q.deltaReady.toLocaleString('tr-TR')} birikti</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

import type { QueueWithDelta } from '../types'
import { parseQueueName, hasKnownSeller } from '../sellerNames'

interface OperationStat {
  seller: string;
  queueName: string;
  count: number;
  delta: number | null;
}

interface OperationGroup {
  operation: string;
  dlq: OperationStat[];
  retry: OperationStat[];
  total: number;
}

function Section({ title, stats, color }: { title: string; stats: OperationStat[]; color: string }) {
  const total = stats.reduce((s, r) => s + r.count, 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{title}</span>
        <span className={`text-sm font-bold ${color}`}>{total.toLocaleString('tr-TR')}</span>
      </div>
      <div className="space-y-1">
        {stats.map((s) => (
          <div key={s.queueName} className="flex items-center justify-between" title={s.queueName}>
            <span className="text-xs text-zinc-400 w-16 shrink-0">{s.seller}</span>
            <div className="flex-1 mx-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
              {total > 0 && s.count > 0 && (
                <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${(s.count / total) * 100}%` }} />
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-16 justify-end">
              <span className={`text-xs font-semibold ${s.count > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
                {s.count.toLocaleString('tr-TR')}
              </span>
              {s.delta !== null && s.delta !== 0 && (
                <span className={`text-[10px] font-medium ${s.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {s.delta > 0 ? `+${s.delta}` : s.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseNonSpapiOperation(name: string): string {
  const stripped = name
    .replace(/\.deadletter\.queue$/, '')
    .replace(/\.retry\.queue$/, '')
    .replace(/\.queue$/, '')
  return stripped
    .split('.')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function OperationHealth({ queues }: { queues: QueueWithDelta[] }) {
  const groupMap = new Map<string, OperationGroup>()

  for (const q of queues) {
    if (q.queueType !== 'dlq' && q.queueType !== 'retry') continue
    if (q.messages_ready === 0) continue

    const parsed = hasKnownSeller(q.name) ? parseQueueName(q.name) : null
    const operation = parsed?.operation ?? parseNonSpapiOperation(q.name)
    const seller = parsed?.seller ?? '—'

    if (!groupMap.has(operation)) {
      groupMap.set(operation, { operation, dlq: [], retry: [], total: 0 })
    }
    const group = groupMap.get(operation)!
    const stat: OperationStat = { seller, queueName: q.name, count: q.messages_ready, delta: q.deltaReady }
    if (q.queueType === 'dlq') group.dlq.push(stat)
    else group.retry.push(stat)
    group.total += q.messages_ready
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => b.total - a.total)

  if (groups.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Hata Takibi</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {groups.map((g) => (
          <div key={g.operation} className="bg-zinc-900 border border-amber-700/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-200 truncate">{g.operation}</span>
              <span className="text-sm font-bold text-amber-400 ml-2 shrink-0">{g.total.toLocaleString('tr-TR')}</span>
            </div>
            <div className="space-y-3">
              {g.dlq.length > 0 && <Section title="DLQ" stats={g.dlq} color="text-red-400" />}
              {g.retry.length > 0 && <Section title="Retry" stats={g.retry} color="text-amber-400" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { groupByContent } from '../similarity'
import type { QueueMessage, SimilarityGroup } from '../types'

export default function MessageModal({
  queueName, vhost, onClose,
}: { queueName: string; vhost: string; onClose: () => void }) {
  const [messages, setMessages] = useState<QueueMessage[]>([])
  const [groups, setGroups] = useState<SimilarityGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(10)
  const [tab, setTab] = useState<'grouped' | 'raw'>('grouped')
  const [expanded, setExpanded] = useState<number | null>(null)

  async function load(n: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/rmq/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(queueName)}/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: n, requeue: true, encoding: 'auto', ackmode: 'ack_requeue_true' }),
      })
      const data: QueueMessage[] = await res.json()
      const list = Array.isArray(data) ? data : []
      setMessages(list)
      setGroups(groupByContent(list))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(count) }, [])

  function fmt(payload: string) {
    try { return JSON.stringify(JSON.parse(payload), null, 2) } catch { return payload }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div>
            <h2 className="text-white font-semibold text-lg">{queueName}</h2>
            <span className="text-zinc-400 text-xs">vhost: {vhost}</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="bg-zinc-800 border border-zinc-600 text-white text-sm rounded px-2 py-1"
              value={count}
              onChange={(e) => { const n = Number(e.target.value); setCount(n); load(n) }}
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} messages</option>)}
            </select>
            <button onClick={() => load(count)} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded">Refresh</button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex border-b border-zinc-700">
          {(['grouped', 'raw'] as const).map((t) => (
            <button key={t} className={`px-5 py-2 text-sm font-medium transition ${tab === t ? 'text-white border-b-2 border-blue-500' : 'text-zinc-400 hover:text-zinc-200'}`} onClick={() => setTab(t)}>
              {t === 'grouped' ? 'Similarity Groups' : 'Raw Messages'}
            </button>
          ))}
          {!loading && <span className="ml-auto px-4 py-2 text-xs text-zinc-500">{messages.length} fetched</span>}
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">No messages in queue</div>
          ) : tab === 'grouped' ? (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.key} className="bg-zinc-800 rounded-lg border border-zinc-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 text-sm font-mono font-medium">{g.key}</span>
                    <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5">{g.count}×</span>
                  </div>
                  <pre className="text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all max-h-40">{JSON.stringify(g.sample, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className="bg-zinc-800 rounded-lg border border-zinc-700 p-3 cursor-pointer hover:border-zinc-500" onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-400">#{i + 1}</span>
                    <div className="flex gap-2 text-xs text-zinc-500">
                      <span>{msg.payload_bytes}B</span>
                      {msg.redelivered && <span className="text-amber-400">redelivered</span>}
                    </div>
                  </div>
                  <pre className={`text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all transition-all ${expanded === i ? 'max-h-96' : 'max-h-16'}`}>{fmt(msg.payload)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

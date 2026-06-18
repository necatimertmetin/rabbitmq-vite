import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueuesResponse, Queue } from './types'
import type { QueueHistory } from './history'
import { updateHistory } from './history'
import { enrichQueues } from './queueUtils'
import StatsBar from './components/StatsBar'
import TopQueues from './components/TopQueues'
import QueueTable from './components/QueueTable'
import HealthAlerts from './components/HealthAlerts'
import OperationHealth from './components/OperationHealth'
import './index.css'

export default function App() {
  const [data, setData] = useState<QueuesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [refreshInterval, setRefreshInterval] = useState(5000)
  const [paused, setPaused] = useState(false)
  const prevQueuesRef = useRef<Queue[]>([])
  const historyRef = useRef<QueueHistory>(new Map())
  const [, forceRender] = useState(0)

  const fetchQueues = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rmq/queues?page=1&page_size=100&sort=messages_ready&sort_reverse=true&pagination=true')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: QueuesResponse = await res.json()
      const ts = Date.now()
      setData((prev) => {
        if (prev) prevQueuesRef.current = prev.items
        return json
      })
      for (const q of json.items) {
        const key = `${q.vhost}/${q.name}`
        const ackRate = q.message_stats?.ack_details?.rate ?? 0
        const publishRate = q.message_stats?.publish_details?.rate ?? 0
        updateHistory(historyRef.current, key, {
          ts,
          ready: q.messages_ready,
          arrived: Math.round(publishRate * (refreshInterval / 1000)),
          processed: Math.round(ackRate * (refreshInterval / 1000)),
        })
      }
      forceRender((n) => n + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [refreshInterval])

  useEffect(() => { fetchQueues(false) }, [fetchQueues])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => fetchQueues(true), refreshInterval)
    return () => clearInterval(id)
  }, [paused, refreshInterval, fetchQueues])

  const enriched = data ? enrichQueues(data.items, prevQueuesRef.current, refreshInterval) : []
  const totalReady = enriched.reduce((s, q) => s + q.messages_ready, 0)
  const totalUnacked = enriched.reduce((s, q) => s + q.messages_unacknowledged, 0)
  const totalConsumers = enriched.reduce((s, q) => s + q.consumers, 0)
  const totalArrived = enriched.reduce((s, q) => s + q.arrivedPerInterval, 0)
  const totalProcessed = enriched.reduce((s, q) => s + q.processedPerInterval, 0)

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">RabbitMQ Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {data ? `${data.total_count} kuyruk` : 'Bağlanıyor...'}
            {refreshing && <span className="ml-2 text-zinc-500 animate-pulse">· yenileniyor</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded px-3 py-1.5"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={paused}
          >
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
          <button
            onClick={() => setPaused((p) => !p)}
            className={`text-sm px-4 py-1.5 rounded border transition ${paused ? 'border-green-600 text-green-400 hover:bg-green-600/10' : 'border-zinc-600 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {paused ? 'Devam Et' : 'Duraklat'}
          </button>
          <button onClick={() => fetchQueues(false)} className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded transition">
            Yenile
          </button>
        </div>
      </div>

      <div className="mb-6">
        <StatsBar
          totalQueues={data?.total_count ?? 0}
          totalReady={totalReady}
          totalUnacked={totalUnacked}
          totalConsumers={totalConsumers}
          totalArrived={totalArrived}
          totalProcessed={totalProcessed}
          intervalLabel={`${refreshInterval / 1000}s`}
        />
      </div>

      <TopQueues queues={enriched} history={historyRef.current} />

      {!loading && enriched.length > 0 && (
        <div className="mb-6">
          <OperationHealth queues={enriched} />
        </div>
      )}

      <HealthAlerts queues={enriched} />

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Kuyruk adı veya satıcı adına göre filtrele..."
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 w-full max-w-sm focus:outline-none focus:border-blue-500 transition"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="bg-zinc-800 border border-zinc-700 text-sm text-white rounded-lg px-3 py-2 shrink-0"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {[5, 10, 20, 30, 50, 100].map((n) => (
            <option key={n} value={n}>{n} kuyruk</option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          Hata: {error}
        </div>
      ) : loading ? (
        <div className="text-zinc-400 text-sm text-center py-20">Kuyruklar yükleniyor...</div>
      ) : (
        <QueueTable queues={enriched} history={historyRef.current} filter={filter} intervalMs={refreshInterval} pageSize={pageSize} />
      )}
    </main>
  )
}

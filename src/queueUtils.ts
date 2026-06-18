import type { Queue, QueueWithDelta, QueueHealth } from './types'

export function getQueueType(name: string): QueueWithDelta['queueType'] {
  const n = name.toLowerCase()
  if (n.includes('deadletter') || n.includes('.dlq.') || n.endsWith('.dlq')) return 'dlq'
  if (n.includes('retry')) return 'retry'
  if (n.startsWith('spapi.')) return 'spapi'
  return 'main'
}

export function getHealth(q: Queue, prev: Queue | undefined): QueueHealth {
  const type = getQueueType(q.name)
  if ((type === 'main' || type === 'spapi') && q.consumers === 0 && q.messages_ready > 0) return 'critical'
  const redeliverRate = q.message_stats?.redeliver_details?.rate ?? 0
  if (redeliverRate > 0.5) return 'warning'
  if (q.consumer_utilisation >= 1 && q.messages_ready > 500) return 'warning'
  if (prev && q.messages_ready > 0 && q.messages_ready > prev.messages_ready * 1.5) return 'warning'
  return 'ok'
}

export function enrichQueues(
  current: Queue[],
  prev: Queue[],
  intervalMs: number,
): QueueWithDelta[] {
  const intervalSec = intervalMs / 1000
  const prevMap = new Map(prev.map((q) => [`${q.vhost}/${q.name}`, q]))

  return current.map((q) => {
    const p = prevMap.get(`${q.vhost}/${q.name}`)
    const publishRate = q.message_stats?.publish_details?.rate ?? 0
    const ackRate = q.message_stats?.ack_details?.rate ?? 0
    return {
      ...q,
      deltaReady: p != null ? q.messages_ready - p.messages_ready : null,
      arrivedPerInterval: Math.round(publishRate * intervalSec),
      processedPerInterval: Math.round(ackRate * intervalSec),
      health: getHealth(q, p),
      queueType: getQueueType(q.name),
    }
  })
}

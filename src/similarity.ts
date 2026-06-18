import type { QueueMessage, SimilarityGroup } from './types'

const TYPE_FIELDS = ['commandType', 'type', 'command', 'action', 'eventType', 'messageType', 'operationType']

function extractGroupKey(payload: string): string {
  try {
    const obj = JSON.parse(payload)
    for (const field of TYPE_FIELDS) {
      if (obj[field] && typeof obj[field] === 'string') {
        return `${field}=${obj[field]}`
      }
    }
    const keys = Object.keys(obj).filter((k) => typeof obj[k] === 'string' || typeof obj[k] === 'number')
    if (keys.length > 0) {
      const k = keys[0]
      return `${k}=${String(obj[k]).slice(0, 40)}`
    }
    return 'unknown'
  } catch {
    return payload.slice(0, 60)
  }
}

export function groupByContent(messages: QueueMessage[]): SimilarityGroup[] {
  const groups = new Map<string, { count: number; sample: Record<string, unknown> }>()

  for (const msg of messages) {
    const key = extractGroupKey(msg.payload)
    const existing = groups.get(key)
    if (existing) {
      existing.count++
    } else {
      let sample: Record<string, unknown> = {}
      try { sample = JSON.parse(msg.payload) } catch { sample = { raw: msg.payload } }
      groups.set(key, { count: 1, sample })
    }
  }

  return Array.from(groups.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count)
}

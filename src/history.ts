export interface HistoryPoint {
  ts: number;
  ready: number;
  arrived: number;
  processed: number;
}

export type QueueHistory = Map<string, HistoryPoint[]>

const MAX_POINTS = 500

export function updateHistory(
  history: QueueHistory,
  queueKey: string,
  point: HistoryPoint,
): HistoryPoint[] {
  const existing = history.get(queueKey) ?? []
  const updated = [...existing, point].slice(-MAX_POINTS)
  history.set(queueKey, updated)
  return updated
}

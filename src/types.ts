export interface Queue {
  name: string;
  vhost: string;
  messages: number;
  messages_ready: number;
  messages_unacknowledged: number;
  consumers: number;
  consumer_utilisation: number;
  message_stats?: {
    publish?: number;
    publish_details?: { rate: number };
    deliver_get_details?: { rate: number };
    ack?: number;
    ack_details?: { rate: number };
    redeliver?: number;
    redeliver_details?: { rate: number };
  };
  state: string;
  memory?: number;
  type: string;
}

export interface QueuesResponse {
  items: Queue[];
  total_count: number;
  filtered_count: number;
  item_count: number;
  page: number;
  page_count: number;
  page_size: number;
}

export interface QueueMessage {
  payload: string;
  payload_bytes: number;
  redelivered: boolean;
  exchange: string;
  routing_key: string;
  message_count: number;
  properties: Record<string, unknown>;
  payload_encoding: string;
}

export interface SimilarityGroup {
  key: string;
  count: number;
  sample: Record<string, unknown>;
}

export type QueueHealth = 'critical' | 'warning' | 'ok'

export interface QueueWithDelta extends Queue {
  deltaReady: number | null;
  arrivedPerInterval: number;
  processedPerInterval: number;
  health: QueueHealth;
  queueType: 'main' | 'dlq' | 'retry' | 'spapi';
}

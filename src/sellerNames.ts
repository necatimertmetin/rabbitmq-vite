const SELLER_NAMES: Record<string, string> = {
  '446ee8ad-8dd7-4642-8398-2816a89352f3': 'Erkan',
  '7388e084-ae70-4959-a14d-cf57573dced8': 'Ilayda',
  '61fbcda1-4746-4817-a1ed-0ad53f66e26b': 'Arda',
  '5775e363-1e94-445d-885d-ef211b615ef5': 'Sedat',
  '08cd99a2-4f8b-4e99-9465-c033eaccab55': 'Sarper',
  '6bb2b3e9-b609-4df9-a6f1-93abe0ccd203': 'Bati',
}

const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export interface ParsedQueueName {
  seller: string;
  operation: string;
  isDlq: boolean;
}

export function parseQueueName(name: string): ParsedQueueName | null {
  const match = name.match(UUID_REGEX)
  if (!match) return null
  const parts = name.split('.')
  return {
    seller: SELLER_NAMES[match[0]] ?? 'Unknown',
    operation: parts[parts.length - 1],
    isDlq: name.includes('.dlq.'),
  }
}

export function hasKnownSeller(name: string): boolean {
  return UUID_REGEX.test(name)
}

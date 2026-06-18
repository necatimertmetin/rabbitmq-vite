function Stat({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value.toLocaleString('tr-TR')}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  )
}

export default function StatsBar({
  totalQueues, totalReady, totalUnacked, totalConsumers, totalArrived, totalProcessed, intervalLabel,
}: {
  totalQueues: number
  totalReady: number
  totalUnacked: number
  totalConsumers: number
  totalArrived: number
  totalProcessed: number
  intervalLabel: string
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Stat label="Toplam Kuyruk" value={totalQueues} color="text-blue-400" />
      <Stat label="Bekleyen Mesaj" value={totalReady} sub="işlenmeyi bekliyor" color="text-amber-400" />
      <Stat label="İşlemde" value={totalUnacked} sub="consumer'da, henüz ack yok" color="text-red-400" />
      <Stat label="Consumer" value={totalConsumers} sub="aktif tüketici" color="text-green-400" />
      <Stat label={`Gelen / ${intervalLabel}`} value={totalArrived} sub="son aralıkta publish edilen" color="text-sky-400" />
      <Stat label={`İşlenen / ${intervalLabel}`} value={totalProcessed} sub="son aralıkta ack edilen" color="text-emerald-400" />
    </div>
  )
}

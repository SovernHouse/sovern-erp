// ─── TariffExpiringWidget — Phase 4.9 C-5 ────────────────────────────────
//
// Compact card listing TariffRate rows whose effectiveUntil is within
// 7 days OR already past. Hides itself when there's nothing to show so
// the dashboard isn't cluttered for users who don't deal with US
// imports. Click anywhere to jump to /settings/tariff-rates for editing.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { tariffRatesAPI } from '../../services/api'

function daysFromToday(iso) {
  const a = new Date(new Date().toISOString().slice(0, 10)).getTime()
  const b = new Date(iso).getTime()
  return Math.round((b - a) / 86400000)
}

export default function TariffExpiringWidget() {
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // Combine "expiring within 7 days" with "already expired up to
        // 30 days back" so Alex sees both before they bite a quotation.
        // The expiring endpoint only returns future rows; query the
        // full list with includeExpired=true and filter client-side
        // (cheap — there are at most dozens of rows).
        const res = await tariffRatesAPI.getAll({ includeExpired: true })
        const all = Array.isArray(res.data) ? res.data : []
        const flagged = all
          .map(r => ({ ...r, _days: daysFromToday(r.effectiveUntil) }))
          .filter(r => r._days <= 7 && r._days >= -30)
          .sort((a, b) => a._days - b._days)
        if (!cancelled) {
          setRows(flagged)
          setLoaded(true)
        }
      } catch (e) {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!loaded || rows.length === 0) return null

  const expiredCount = rows.filter(r => r._days < 0).length
  const expiringCount = rows.length - expiredCount

  return (
    <Link
      to="/settings/tariff-rates"
      className="block rounded-lg border border-amber-300 bg-amber-50 p-4 hover:bg-amber-100 transition no-underline"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-amber-900 mb-1">
            {expiredCount > 0 && `${expiredCount} tariff rate${expiredCount === 1 ? '' : 's'} expired`}
            {expiredCount > 0 && expiringCount > 0 && ' · '}
            {expiringCount > 0 && `${expiringCount} expiring in ≤7 days`}
          </div>
          <div className="space-y-0.5">
            {rows.slice(0, 5).map(r => (
              <div key={r.id} className="flex justify-between text-xs text-amber-900">
                <span className="font-mono">{r.originCountry} → {r.destinationCountry}</span>
                <span>
                  <span className="font-mono">{Number(r.ratePercent).toFixed(4)}%</span>
                  {' · '}
                  <span className="italic">{r._days < 0 ? `expired ${-r._days}d ago` : `${r._days}d left`}</span>
                </span>
              </div>
            ))}
            {rows.length > 5 && (
              <div className="text-xs text-amber-700 italic">…and {rows.length - 5} more.</div>
            )}
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium underline">
            Edit on Settings → Tariff rates
          </div>
        </div>
      </div>
    </Link>
  )
}

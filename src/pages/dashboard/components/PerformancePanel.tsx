import { useEffect, useState } from 'react'
import { dashboardApi } from '../../../api/endpoints'
import type { DashboardMetric, DashboardPerformance, DashboardPerformanceKey } from '../../../types/api'
import { formatAed, formatCount, reportRange, type ReportPanelProps } from './reportFormat'

const PERFORMANCE_METRICS: Array<{ key: DashboardPerformanceKey; label: string; money?: boolean }> = [
  { key: 'total_sales', label: 'Total sales', money: true },
  { key: 'net_sales', label: 'Net sales', money: true },
  { key: 'orders', label: 'Orders' },
  { key: 'products_sold', label: 'Products sold' },
  { key: 'variations_sold', label: 'Variations Sold' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'views', label: 'Views' },
]

function Delta({ metric }: { metric?: DashboardMetric }) {
  const change = metric?.change_percent
  if (change == null) {
    return (
      <span className="dashboard-performance__delta" title="No earlier period to compare">
        —
      </span>
    )
  }
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const previous = metric?.previous ?? 0
  return (
    <span
      className={`dashboard-performance__delta dashboard-performance__delta--${tone}`}
      title={`Previous period: ${previous.toLocaleString('en-US')}`}
    >
      {change > 0 ? '+' : ''}
      {change}%
    </span>
  )
}

export function PerformancePanel({ fromDate, toDate, paused }: ReportPanelProps) {
  const requestKey = `${fromDate ?? ''}|${toDate ?? ''}`
  const [result, setResult] = useState<{ key: string; data: DashboardPerformance | null; error: string } | null>(null)
  const data = result?.data ?? null
  const error = result?.key === requestKey ? result.error : ''
  const loading = !paused && result?.key !== requestKey

  useEffect(() => {
    if (paused) return
    let cancelled = false
    dashboardApi
      .getPerformance(reportRange(fromDate, toDate))
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data?.data ?? null, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: 'Failed to load performance' }))
      })
    return () => {
      cancelled = true
    }
  }, [paused, fromDate, toDate, requestKey])

  return (
    <section className="dashboard-performance" aria-label="Performance" aria-busy={loading}>
      <header className="dashboard-performance__header">
        <h3 className="dashboard-performance__title">Performance</h3>
        {error ? <span className="dashboard-report__error">{error}</span> : null}
      </header>
      <div className="dashboard-performance__grid">
        {PERFORMANCE_METRICS.map(({ key, label, money }) => {
          const metric = data?.metrics?.[key]
          const value = metric ? (money ? formatAed(metric.value) : formatCount(metric.value)) : '—'
          return (
            <article key={key} className="dashboard-performance__cell">
              <p className="dashboard-performance__label">{label}</p>
              <div className="dashboard-performance__value-row">
                <p className="dashboard-performance__value">{loading && !data ? '…' : value}</p>
                {loading && !data ? null : <Delta metric={metric} />}
              </div>
            </article>
          )
        })}
        <div className="dashboard-performance__cell dashboard-performance__cell--empty" aria-hidden />
      </div>
    </section>
  )
}

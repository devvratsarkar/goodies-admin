import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { dashboardApi } from '../../../api/endpoints'
import type { DashboardMetric, DashboardSalesKey, DashboardSalesSummary } from '../../../types/api'
import { formatAed, reportRange, type ReportPanelProps } from './reportFormat'

const SALES_METRICS: Array<{ key: DashboardSalesKey; label: string; info?: string }> = [
  { key: 'gross_sales', label: 'Gross sales' },
  { key: 'returns', label: 'Returns' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'net_sales', label: 'Net sales', info: 'Gross sales minus returns and coupons.' },
  { key: 'taxes', label: 'Taxes', info: 'Tax collected on orders in this period.' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'total_sales', label: 'Total sales', info: 'Net sales plus taxes, shipping, fees and cash on delivery.' },
]

function Delta({ metric }: { metric?: DashboardMetric }) {
  const change = metric?.change_percent
  if (change == null) {
    return (
      <span className="dashboard-sales__delta dashboard-sales__delta--flat" title="No earlier period to compare">
        —
      </span>
    )
  }
  const tone = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const previous = metric?.previous ?? 0
  return (
    <span className={`dashboard-sales__delta dashboard-sales__delta--${tone}`} title={`Previous period: ${formatAed(previous)}`}>
      {change > 0 ? '+' : ''}
      {change}%
    </span>
  )
}

export function SalesSummaryPanel({ fromDate, toDate, paused }: ReportPanelProps) {
  const requestKey = `${fromDate ?? ''}|${toDate ?? ''}`
  const [result, setResult] = useState<{ key: string; data: DashboardSalesSummary | null; error: string } | null>(null)
  const data = result?.data ?? null
  const error = result?.key === requestKey ? result.error : ''
  const loading = !paused && result?.key !== requestKey

  useEffect(() => {
    if (paused) return
    let cancelled = false
    dashboardApi
      .getSalesSummary(reportRange(fromDate, toDate))
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data?.data ?? null, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: 'Failed to load sales summary' }))
      })
    return () => {
      cancelled = true
    }
  }, [paused, fromDate, toDate, requestKey])

  return (
    <section className="dashboard-sales" aria-label="Sales summary" aria-busy={loading}>
      {error ? <p className="dashboard-report__error dashboard-report__error--block">{error}</p> : null}
      <div className="dashboard-sales__grid">
        {SALES_METRICS.map((metric) => {
          const value = data?.metrics?.[metric.key]
          return (
            <article key={metric.key} className="dashboard-sales__cell">
              <p className="dashboard-sales__label">
                {metric.label}
                {metric.info ? (
                  <span className="dashboard-sales__info" title={metric.info} aria-label={metric.info}>
                    <Info size={14} aria-hidden />
                  </span>
                ) : null}
              </p>
              <div className="dashboard-sales__value-row">
                <p className="dashboard-sales__value">{loading && !data ? '…' : formatAed(value?.value ?? 0)}</p>
                {loading && !data ? null : <Delta metric={value} />}
              </div>
            </article>
          )
        })}
        <div className="dashboard-sales__cell dashboard-sales__cell--empty" aria-hidden />
      </div>
    </section>
  )
}

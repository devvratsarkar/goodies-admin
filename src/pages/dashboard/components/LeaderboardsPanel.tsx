import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboardApi } from '../../../api/endpoints'
import type { DashboardLeaderboardRow, DashboardLeaderboards } from '../../../types/api'
import { formatAed, formatCount, reportRange, splitBilingual, type ReportPanelProps } from './reportFormat'

function LeaderboardTable({
  title,
  nameLabel,
  rows,
  loading,
}: {
  title: string
  nameLabel: string
  rows: DashboardLeaderboardRow[]
  loading: boolean
}) {
  return (
    <article className="dashboard-leaderboards__card">
      <h3 className="dashboard-leaderboards__card-title">{title}</h3>
      <div className="dashboard-leaderboards__table-wrap">
        <table className="dashboard-leaderboards__table">
          <thead>
            <tr>
              <th scope="col">{nameLabel}</th>
              <th scope="col">Items Sold</th>
              <th scope="col">Net Sales</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="dashboard-products__empty" colSpan={3}>
                  {loading ? 'Loading…' : 'No sales in this period.'}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const { name, nameAr } = splitBilingual(row.name)
                const label = (
                  <span className="dashboard-leaderboards__name">
                    <span dir="ltr">{name}</span>
                    {nameAr ? <span dir="rtl">{nameAr}</span> : null}
                  </span>
                )
                return (
                  <tr key={row._id ?? `row-${index}`}>
                    <td><Link to={`${import.meta.env.VITE_STORE_URL}/${nameLabel === 'Category' ? 'product-category' : 'product'}/${row.slug}`} target="_blank" rel="noopener noreferrer">{label}</Link></td>
                    <td>{formatCount(row.items_sold)}</td>
                    <td>{formatAed(row.net_sales)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function LeaderboardsPanel({ fromDate, toDate, paused }: ReportPanelProps) {
  const requestKey = `${fromDate ?? ''}|${toDate ?? ''}`
  const [result, setResult] = useState<{ key: string; data: DashboardLeaderboards | null; error: string } | null>(null)
  const data = result?.data ?? null
  const error = result?.key === requestKey ? result.error : ''
  const loading = !paused && result?.key !== requestKey

  useEffect(() => {
    if (paused) return
    let cancelled = false
    dashboardApi
      .getLeaderboards({ ...reportRange(fromDate, toDate), limit: 5 })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data?.data ?? null, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: 'Failed to load leaderboards' }))
      })
    return () => {
      cancelled = true
    }
  }, [paused, fromDate, toDate, requestKey])

  return (
    <div className="dashboard-leaderboards" aria-busy={loading}>
      {error ? <p className="dashboard-report__error">{error}</p> : null}
      <div className="dashboard-leaderboards__grid">
        <LeaderboardTable
          title="Top Categories - Items Sold"
          nameLabel="Category"
          rows={data?.top_categories ?? []}
          loading={loading}
        />
        <LeaderboardTable
          title="Top Products - Items Sold"
          nameLabel="Product"
          rows={data?.top_products ?? []}
          loading={loading}
        />
      </div>
    </div>
  )
}

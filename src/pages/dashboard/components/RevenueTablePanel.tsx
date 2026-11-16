import { useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import { Download } from 'lucide-react'
import { dashboardApi } from '../../../api/endpoints'
import { MuiDataTable } from '../../../components/ui/MuiDataTable'
import type { DashboardRevenue, DashboardRevenueRow } from '../../../types/api'
import type { TimeMode } from './dashboardSeries'
import { formatAed, formatCount, reportRange, type ReportPanelProps } from './reportFormat'
import { useModuleCan } from '../../../components/rbac/useModuleCan'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const DAY_DATE = /^\d{4}-\d{2}-\d{2}$/

function revenuePeriodLabel(row: DashboardRevenueRow) {
  if (row.label) return row.label
  if (DAY_DATE.test(row.date)) {
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
      new Date(`${row.date}T00:00:00`),
    )
  }
  return row.date
}

const moneyColumn = (field: keyof DashboardRevenueRow, headerName: string): GridColDef<DashboardRevenueRow> => ({
  field,
  headerName,
  flex: 1,
  minWidth: 120,
  sortable: false,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (value) => formatAed(Number(value)),
})

function visibleRevenueRows(data: DashboardRevenue | null, page: number, pageSize: number, sortDir: 'asc' | 'desc') {
  const days = data?.days ?? []
  const pagination = data?.pagination
  const pageSizeFromApi = Number(pagination?.itemsPerPage) || pageSize
  const apiPaged = pagination != null && days.length <= pageSizeFromApi
  if (apiPaged) return { rows: days, total: Number(pagination.totalItems) || days.length }
  const sorted = [...days].sort((a, b) => (sortDir === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  const start = page * pageSize
  return { rows: sorted.slice(start, start + pageSize), total: sorted.length }
}

export function RevenueTablePanel({ fromDate, toDate, paused, timeMode = 'monthly' }: ReportPanelProps & { timeMode?: TimeMode }) {
  const { canExport } = useModuleCan('dashboard')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const group = timeMode === 'yearly' ? 'yearly' : 'month'
  const rangeKey = `${fromDate ?? ''}|${toDate ?? ''}|${group}`
  const [seenRange, setSeenRange] = useState(rangeKey)
  if (seenRange !== rangeKey) {
    setSeenRange(rangeKey)
    setPage(0)
  }
  const requestKey = [rangeKey, sortDir, page, pageSize].join('|')
  const [result, setResult] = useState<{ key: string; data: DashboardRevenue | null; error: string } | null>(null)
  const data = result?.data ?? null
  const loading = !paused && result?.key !== requestKey
  const error = downloadError || (result?.key === requestKey ? result.error : '')

  useEffect(() => {
    if (paused) return
    let cancelled = false
    dashboardApi
      .getRevenue({ ...reportRange(fromDate, toDate), sortOrder: sortDir, page: page + 1, limit: pageSize, group })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data?.data ?? null, error: '' })
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: 'Failed to load revenue' }))
      })
    return () => {
      cancelled = true
    }
  }, [paused, fromDate, toDate, sortDir, page, pageSize, requestKey])

  const { rows, total } = useMemo(
    () => visibleRevenueRows(data, page, pageSize, sortDir),
    [data, page, pageSize, sortDir],
  )
  const sortModel = useMemo<GridSortModel>(() => [{ field: 'date', sort: sortDir }], [sortDir])

  const download = async () => {
    if (!canExport) return
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await dashboardApi.exportRevenue({ ...reportRange(fromDate, toDate), sortOrder: sortDir, group })
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `revenue-report-${fromDate && toDate ? `${fromDate}-to-${toDate}` : 'all-time'}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Failed to download revenue report')
    } finally {
      setDownloading(false)
    }
  }

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const handleSortChange = (model: GridSortModel) => {
    const next = model[0]?.sort
    if (next !== 'asc' && next !== 'desc') return
    setSortDir(next)
    setPage(0)
  }

  const columns = useMemo<GridColDef<DashboardRevenueRow>[]>(
    () => [
      {
        field: 'date',
        headerName: 'Date',
        flex: 1.2,
        minWidth: 160,
        valueGetter: (_, row) => revenuePeriodLabel(row),
      },
      {
        field: 'orders',
        headerName: 'Orders',
        width: 100,
        minWidth: 90,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: ({ value }) => <span className="dashboard-revenue__orders">{formatCount(Number(value))}</span>,
      },
      moneyColumn('gross_sales', 'Gross sales'),
      moneyColumn('returns', 'Returns'),
      moneyColumn('coupons', 'Coupons'),
      moneyColumn('net_sales', 'Net sales'),
      moneyColumn('taxes', 'Taxes'),
      moneyColumn('shipping', 'Shipping'),
      moneyColumn('total_sales', 'Total sales'),
    ],
    [],
  )

  return (
    <section className="dashboard-revenue" aria-label="Revenue" aria-busy={loading}>
      <header className="dashboard-revenue__header">
        <h3 className="dashboard-revenue__title">Revenue</h3>
        {error ? <span className="dashboard-report__error">{error}</span> : null}
        {canExport && (
          <button
            type="button"
            className="btn btn-ghost dashboard-revenue__download"
            onClick={download}
            disabled={downloading || total === 0}
          >
            <Download size={16} aria-hidden />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        )}
      </header>
      <div className="dashboard-revenue__table-wrap">
        <MuiDataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.date}
          loading={loading}
          paginationMode="server"
          rowCount={total}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={handlePageChange}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          density="compact"
          sortingMode="server"
          sortModel={sortModel}
          sortingOrder={['asc', 'desc']}
          onSortModelChange={handleSortChange}
        />
      </div>
    </section>
  )
}

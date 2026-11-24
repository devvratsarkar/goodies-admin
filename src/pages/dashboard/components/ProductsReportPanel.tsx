import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import { Download, Search } from 'lucide-react'
import { dashboardApi } from '../../../api/endpoints'
import { MuiDataTable } from '../../../components/ui/MuiDataTable'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import type { DashboardProductRow, DashboardProductSort, DashboardProductsReport } from '../../../types/api'
import { formatAed, formatCount, reportRange, splitBilingual, type ReportPanelProps } from './reportFormat'
import { useModuleCan } from '../../../components/rbac/useModuleCan'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const SORT_FIELDS: DashboardProductSort[] = ['title', 'items_sold', 'net_sales', 'orders']

const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  draft: 'Draft',
  pending: 'Pending',
  inactive: 'Inactive',
  deleted: 'Deleted',
  unknown: 'Unknown',
}

function BilingualLabel({ value }: { value: string }) {
  const { name, nameAr } = splitBilingual(value)
  return (
    <span className="dashboard-products__link">
      <span dir="ltr">{name}</span>
      {nameAr ? <span dir="rtl">{nameAr}</span> : null}
    </span>
  )
}

function stockLabel(row: DashboardProductRow) {
  if (!row.stock_status) return '—'
  const label = row.stock_status === 'in_stock' ? 'In stock' : 'Out of stock'
  return row.stock_quantity == null ? label : `${label} (${formatCount(row.stock_quantity)})`
}

function isSortField(field: string): field is DashboardProductSort {
  return SORT_FIELDS.includes(field as DashboardProductSort)
}

export function ProductsReportPanel({ fromDate, toDate, paused }: ReportPanelProps) {
  const { canExport } = useModuleCan('dashboard')
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query, query.trim() ? 350 : 0)
  const [sortBy, setSortBy] = useState<DashboardProductSort>('items_sold')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const requestKey = [fromDate, toDate, search, sortBy, sortOrder, page, pageSize].join('|')
  const [result, setResult] = useState<{ key: string; data: DashboardProductsReport | null; error: string } | null>(null)
  const data = result?.data ?? null
  const loading = !paused && result?.key !== requestKey
  const error = downloadError || (result?.key === requestKey ? result.error : '')

  useEffect(() => {
    if (paused) return
    let cancelled = false
    dashboardApi
      .getProducts({
        ...reportRange(fromDate, toDate),
        search,
        sortBy,
        sortOrder,
        page: page + 1,
        limit: pageSize,
      })
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, data: res.data?.data ?? null, error: '' })
      })
      .catch(() => {
        if (!cancelled) {
          setResult((prev) => ({ key: requestKey, data: prev?.data ?? null, error: 'Failed to load products report' }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [paused, fromDate, toDate, search, sortBy, sortOrder, page, pageSize, requestKey])

  const download = async () => {
    if (!canExport) return
    setDownloading(true)
    setDownloadError('')
    try {
      const res = await dashboardApi.exportProducts({ ...reportRange(fromDate, toDate), search, sortBy, sortOrder })
      const url = URL.createObjectURL(res.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `products-report-${fromDate && toDate ? `${fromDate}-to-${toDate}` : 'all-time'}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Failed to download products report')
    } finally {
      setDownloading(false)
    }
  }

  const rows = data?.products ?? []
  const total = data?.pagination?.totalItems ?? 0
  const sortModel = useMemo<GridSortModel>(() => [{ field: sortBy, sort: sortOrder }], [sortBy, sortOrder])

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const handleSortChange = (model: GridSortModel) => {
    const next = model[0]
    if (!next?.field || !next.sort || !isSortField(next.field)) return
    setPage(0)
    setSortBy(next.field)
    setSortOrder(next.field === sortBy ? next.sort : next.field === 'title' ? 'asc' : 'desc')
  }

  const columns = useMemo<GridColDef<DashboardProductRow>[]>(
    () => [
      {
        field: 'title',
        headerName: 'Product title',
        flex: 1.4,
        minWidth: 220,
        renderCell: ({ row }) => {
          const label = <BilingualLabel value={row.title} />
          return row.product_id && row.status !== 'deleted' ? <Link to={`${import.meta.env.VITE_STORE_URL}/product/${row.slug}`} target="_blank" rel="noopener noreferrer">{label}</Link> : label
        },
      },
      {
        field: 'sku',
        headerName: 'SKU',
        width: 150,
        minWidth: 120,
        sortable: false,
        valueGetter: (_, row) => row.sku || '—',
      },
      {
        field: 'items_sold',
        headerName: 'Items sold',
        width: 120,
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatCount(Number(value)),
      },
      {
        field: 'net_sales',
        headerName: 'Net sales',
        width: 150,
        minWidth: 130,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatAed(Number(value)),
      },
      {
        field: 'orders',
        headerName: 'Orders',
        width: 110,
        minWidth: 100,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatCount(Number(value)),
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
        minWidth: 160,
        sortable: false,
        renderCell: ({ row }) => (row.category ? <BilingualLabel value={row.category.name} /> : '—'),
      },
      {
        field: 'variations',
        headerName: 'Variations',
        width: 120,
        minWidth: 110,
        sortable: false,
        align: 'right',
        headerAlign: 'right',
        valueFormatter: (value) => formatCount(Number(value)),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        minWidth: 110,
        sortable: false,
        valueGetter: (_, row) => STATUS_LABELS[row.status] ?? row.status,
      },
      {
        field: 'stock_status',
        headerName: 'Stock',
        width: 160,
        minWidth: 140,
        sortable: false,
        valueGetter: (_, row) => stockLabel(row),
      },
    ],
    [],
  )

  return (
    <section className="dashboard-products" aria-label="Products" aria-busy={loading}>
      <div className="dashboard-products__toolbar">
        <h3 className="dashboard-products__title">Products</h3>
        <label className="dashboard-products__search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search products</span>
          <input
            type="search"
            value={query}
            placeholder="Search by title, SKU or category"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </label>
        {canExport && (
          <button
            type="button"
            className="btn btn-ghost dashboard-products__download"
            onClick={download}
            disabled={downloading || total === 0}
          >
            <Download size={16} aria-hidden />
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        )}
      </div>
      {error ? <p className="dashboard-report__error dashboard-report__error--block">{error}</p> : null}
      <div className="dashboard-products__table-wrap">
        <MuiDataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => String(row.product_id || `${row.sku ?? ''}:${row.title}`)}
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

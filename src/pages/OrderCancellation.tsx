import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridColDef } from '@mui/x-data-grid'
import { Eye, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { orderCancellationApi } from '../api/endpoints'
import type { OrderCancellationRequest } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { isoDateParam } from '../utils/dateQuery'

type PageResult = {
  requests: OrderCancellationRequest[]
  pagination: { totalItems: number; currentPage: number; itemsPerPage: number }
}

const FILTERS = [
  { id: 'all', label: 'All', status: 'all', refund: 'all' },
  { id: 'pending', label: 'Needs review', status: 'pending', refund: 'all' },
  { id: 'refund', label: 'Needs refund', status: 'approved', refund: 'pending' },
  { id: 'approved', label: 'Approved', status: 'approved', refund: 'all' },
  { id: 'rejected', label: 'Rejected', status: 'rejected', refund: 'all' },
]

function parseResponse(payload: unknown): PageResult {
  const fallback: PageResult = {
    requests: [],
    pagination: { totalItems: 0, currentPage: 1, itemsPerPage: 20 },
  }
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as {
    requests?: unknown
    pagination?: { totalItems?: number; currentPage?: number; itemsPerPage?: number }
  }
  return {
    requests: Array.isArray(data.requests) ? (data.requests as OrderCancellationRequest[]) : [],
    pagination: {
      totalItems: Number(data.pagination?.totalItems ?? 0),
      currentPage: Number(data.pagination?.currentPage ?? 1),
      itemsPerPage: Number(data.pagination?.itemsPerPage ?? 20),
    },
  }
}

const toTitleCase = (value?: string | null) => {
  if (!value) return '—'
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const statusClass = (status?: string | null) => {
  const key = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (['approved', 'refunded', 'paid', 'success', 'completed'].includes(key)) return 'order-status order-status--success'
  if (key === 'refund_initiated') return 'order-status order-status--info'
  if (['pending', 'refund_pending', 'initiating_refund'].includes(key)) return 'order-status order-status--warning'
  if (['rejected', 'failed', 'cancelled', 'canceled'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span>—</span>
  return (
    <span className={statusClass(status)}>
      <span className="order-status__dot" aria-hidden="true" />
      {toTitleCase(status)}
    </span>
  )
}

const orderOf = (row: OrderCancellationRequest) =>
  row.order_id && typeof row.order_id === 'object' ? row.order_id : null

const userOf = (row: OrderCancellationRequest) =>
  row.user_id && typeof row.user_id === 'object' ? row.user_id : null

export function OrderCancellation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [rows, setRows] = useState<OrderCancellationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)
  const [status, setStatus] = useState('all')
  const [refundStatus, setRefundStatus] = useState('all')
  const [fromDate, setFromDate] = useState(() => isoDateParam(searchParams.get('fromDate')))
  const [toDate, setToDate] = useState(() => isoDateParam(searchParams.get('toDate')))
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const requestSeq = useRef(0)

  const load = useCallback(
    (targetPageIndex = 0, targetPageSize = pageSize) => {
      const seq = ++requestSeq.current
      setLoading(true)
      setError('')
      orderCancellationApi
        .getAll({
          status,
          refund_status: refundStatus,
          search: debouncedSearch.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page: targetPageIndex + 1,
          limit: targetPageSize,
        })
        .then((res) => {
          if (seq !== requestSeq.current) return
          const parsed = parseResponse(res.data)
          setRows(parsed.requests)
          setTotalCount(parsed.pagination.totalItems)
          setPageIndex(Math.max((parsed.pagination.currentPage || 1) - 1, 0))
          setPageSize(parsed.pagination.itemsPerPage || targetPageSize)
        })
        .catch(() => {
          if (seq !== requestSeq.current) return
          setError('Failed to load cancellation requests')
        })
        .finally(() => {
          if (seq !== requestSeq.current) return
          setLoading(false)
        })
    },
    [status, refundStatus, debouncedSearch, pageSize, fromDate, toDate],
  )

  useEffect(() => {
    load(0, pageSize)
    // Reload from page 1 when filters/search change. Pagination calls load() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, refundStatus, debouncedSearch, fromDate, toDate])

  const columns: GridColDef<OrderCancellationRequest>[] = useMemo(
    () => [
      {
        field: 'actions',
        headerName: 'Actions',
        width: 88,
        minWidth: 88,
        maxWidth: 88,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        cellClassName: 'products-actions-cell',
        renderCell: ({ row }) => (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            title={row.status === 'pending' ? 'Review request' : 'View request'}
            aria-label={row.status === 'pending' ? 'Review request' : 'View request'}
            onClick={() => navigate(`/order-cancellations/${row._id}`)}
          >
            <Eye size={16} />
          </button>
        ),
      },
      {
        field: '__index',
        headerName: '#',
        width: 56,
        minWidth: 56,
        maxWidth: 56,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) =>
          pageIndex * pageSize + params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
      },
      {
        field: 'order',
        headerName: 'Order',
        flex: 0.7,
        minWidth: 110,
        sortable: false,
        valueGetter: (_, row) => {
          const order = orderOf(row)
          return order?.order_number != null ? `#${order.order_number}` : '—'
        },
        renderCell: ({ row, value }) => (
          <button
            type="button"
            className="product-cell__title product-cell__link"
            onClick={() => navigate(`/order-cancellations/${row._id}`)}
          >
            {String(value || '—')}
          </button>
        ),
      },
      {
        field: 'customer',
        headerName: 'Customer',
        flex: 1.3,
        minWidth: 180,
        sortable: false,
        valueGetter: (_, row) => {
          const user = userOf(row)
          return [user?.name, user?.email].filter(Boolean).join(' ')
        },
        renderCell: ({ row }) => {
          const user = userOf(row)
          if (!user) return '—'
          return (
            <div className="product-cell__text" title={user.email ? `${user.name || ''}\n${user.email}` : user.name}>
              <span className="product-cell__title">{user.name || '—'}</span>
              {user.email ? <span className="product-cell__meta">{user.email}</span> : null}
            </div>
          )
        },
      },
      {
        field: 'items',
        headerName: 'Items',
        flex: 0.5,
        minWidth: 90,
        sortable: false,
        valueGetter: (_, row) => {
          const count = Array.isArray(row.order_item_ids) ? row.order_item_ids.length : 0
          return count ? `${count} item${count === 1 ? '' : 's'}` : 'Full order'
        },
      },
      {
        field: 'reason',
        headerName: 'Reason',
        flex: 1.4,
        minWidth: 180,
        sortable: false,
        renderCell: ({ row }) => {
          const reason = row.reason?.trim() || '—'
          return (
            <span className="cancel-reason" title={reason}>
              {reason}
            </span>
          )
        },
      },
      {
        field: 'status',
        headerName: 'Request',
        flex: 0.8,
        minWidth: 120,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => <StatusBadge status={row.status} />,
      },
      {
        field: 'refund_status',
        headerName: 'Refund',
        flex: 0.9,
        minWidth: 140,
        sortable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => {
          const refund = row.refund_status
          const amount = row.refund_amount
          const currency = orderOf(row)?.currency || 'AED'
          return (
            <div className="product-cell__text" style={{ alignItems: 'center' }}>
              <StatusBadge status={refund} />
              {amount != null && refund && refund !== 'not_required' ? (
                <span className="product-cell__meta">
                  {currency} {Number(amount).toFixed(2)}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        field: 'createdAt',
        headerName: 'Requested',
        flex: 0.9,
        minWidth: 140,
        sortable: false,
        renderCell: ({ row }) => {
          if (!row.createdAt) return '—'
          const date = new Date(row.createdAt)
          if (Number.isNaN(date.getTime())) return '—'
          const label = date.toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })
          return (
            <div className="product-cell__text" title={date.toLocaleString()}>
              <span className="product-cell__title">{label}</span>
            </div>
          )
        },
      },
    ],
    [navigate, pageIndex, pageSize],
  )

  const activeFilter =
    FILTERS.find((filter) => filter.status === status && filter.refund === refundStatus)?.id || ''

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cancellation requests</h1>
          <p className="page-subtitle">
            Review a customer request, approve it to cancel the items, then process the refund separately.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="cancel-filters">
          <div className="cancel-filter-tabs" role="group" aria-label="Request status">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`cancel-filter-tab${activeFilter === filter.id ? ' is-active' : ''}`}
                aria-pressed={activeFilter === filter.id}
                onClick={() => {
                  setStatus(filter.status)
                  setRefundStatus(filter.refund)
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
            <input type="date" className="input" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
            <input type="date" className="input" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <label className="cancel-filters__search">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              placeholder="Search by order number, customer, or reason"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search by order number, customer, or reason"
            />
          </label>
          <select
            className="select cancel-filters__refund"
            value={status}
            onChange={(event) => {
              const next = event.target.value
              setStatus(next)
              if (next !== 'approved' && refundStatus === 'pending') {
                setRefundStatus('all')
              }
            }}
            aria-label="Request status"
          >
            <option value="all">All request statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="select cancel-filters__refund"
            value={refundStatus}
            onChange={(e) => setRefundStatus(e.target.value)}
            aria-label="Refund status"
          >
            <option value="all">All refund statuses</option>
            <option value="pending">Refund pending</option>
            <option value="initiating_refund">Initiating refund</option>
            <option value="refund_initiated">Refund initiated</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
            <option value="not_required">Not required</option>
          </select>
        </div>
        <div className="table-wrap">
          <MuiDataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row._id)}
            loading={loading}
            paginationMode="server"
            rowCount={totalCount}
            paginationModel={{ page: pageIndex, pageSize }}
            onPaginationModelChange={(model) => {
              const nextPage = model.pageSize === pageSize ? model.page : 0
              setPageIndex(nextPage)
              setPageSize(model.pageSize)
              load(nextPage, model.pageSize)
            }}
            pageSizeOptions={[10, 20, 25, 50]}
            density="compact"
          />
        </div>
      </div>
    </>
  )
}

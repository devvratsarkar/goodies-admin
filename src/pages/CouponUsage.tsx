import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, FileDown } from 'lucide-react'
import { couponsApi } from '../api/endpoints'
import type { CouponUsage, CouponUsagePagination } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { useModuleCan } from '../components/rbac/useModuleCan'

type CouponUsageResult = {
  rows: CouponUsage[]
  pagination: CouponUsagePagination
}

function extractUsage(payload: unknown): CouponUsageResult {
  const fallback: CouponUsageResult = {
    rows: [],
    pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 },
  }
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  const data =
    root.data !== undefined && root.data !== null && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : (payload as Record<string, unknown>)

  const innerList = Array.isArray(data.data)
    ? (data.data as CouponUsage[])
    : Array.isArray(data.list)
      ? (data.list as CouponUsage[])
      : Array.isArray(root.data)
        ? (root.data as CouponUsage[])
        : []

  const pag = (data.pagination || {}) as Partial<CouponUsagePagination>
  return {
    rows: innerList,
    pagination: {
      currentPage: Number(pag.currentPage ?? 1),
      totalPages: Number(pag.totalPages ?? 0),
      totalItems: Number(pag.totalItems ?? innerList.length),
      itemsPerPage: Number(pag.itemsPerPage ?? 10),
    },
  }
}

function isoToApiDate(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return undefined
  return `${day}-${month}-${year}`
}

function formatMoney(amount?: number, currency?: string) {
  const value = Number(amount ?? 0)
  const code = currency || 'AED'
  return `${code} ${value.toFixed(2)}`
}

function formatUsageDate(value?: string) {
  if (!value) return '-'
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  return `${day}-${month}-${parsed.getFullYear()}`
}

function getUser(row: CouponUsage) {
  if (row.user && typeof row.user === 'object') return row.user
  if (row.user_id && typeof row.user_id === 'object') return row.user_id
  return null
}

function getCoupon(row: CouponUsage) {
  if (row.coupon && typeof row.coupon === 'object') return row.coupon
  if (row.coupon_id && typeof row.coupon_id === 'object') return row.coupon_id
  return null
}

function getOrder(row: CouponUsage) {
  if (row.order && typeof row.order === 'object') return row.order
  if (row.order_id && typeof row.order_id === 'object') return row.order_id
  return null
}

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'order', label: 'Order' },
]

export function CouponUsagePage() {
  const { canExport } = useModuleCan('coupons')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const couponId = searchParams.get('couponId') || ''
  const couponCode = searchParams.get('code') || ''
  const [rows, setRows] = useState<CouponUsage[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeInput, setTypeInput] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedType, setAppliedType] = useState('')
  const [appliedFromDate, setAppliedFromDate] = useState('')
  const [appliedToDate, setAppliedToDate] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = (
    targetPageIndex = pageIndex,
    targetPageSize = pageSize,
    typeOverride = appliedType,
    fromOverride = appliedFromDate,
    toOverride = appliedToDate,
  ) => {
    setLoading(true)
    setError('')
    couponsApi
      .getUsage({
        page: targetPageIndex + 1,
        limit: targetPageSize,
        search: debouncedSearch.trim() || undefined,
        type: typeOverride || undefined,
        fromDate: isoToApiDate(fromOverride),
        toDate: isoToApiDate(toOverride),
        couponId: couponId || undefined,
      })
      .then((res) => {
        const parsed = extractUsage(res.data)
        setRows(parsed.rows)
        setTotalCount(parsed.pagination.totalItems)
        setPageIndex(Math.max((parsed.pagination.currentPage || 1) - 1, 0))
        setPageSize(parsed.pagination.itemsPerPage || targetPageSize)
      })
      .catch(() => setError('Failed to load coupon usage'))
      .finally(() => {
        setLoading(false)
        setInitialLoading(false)
      })
  }

  useEffect(() => {
    setPageIndex(0)
    load(0, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, couponId])

  const applyFilters = () => {
    setAppliedType(typeInput)
    setAppliedFromDate(fromDate)
    setAppliedToDate(toDate)
    setPageIndex(0)
    load(0, pageSize, typeInput, fromDate, toDate)
  }

  const exportCsv = async () => {
    if (!canExport) return
    setExporting(true)
    setError('')
    try {
      const res = await couponsApi.exportUsage({
        search: debouncedSearch.trim() || undefined,
        type: appliedType || undefined,
        fromDate: isoToApiDate(appliedFromDate),
        toDate: isoToApiDate(appliedToDate),
        couponId: couponId || undefined,
      })
      const contentType = String(res.headers['content-type'] || '')
      if (contentType.includes('application/json')) {
        setError('Failed to export coupon usage')
        return
      }
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      const name = couponCode ? `${couponCode}-usage` : 'coupon-usage'
      link.href = url
      link.download = `${name}-${stamp}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export coupon usage')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<CouponUsage>[] = useMemo(
    () => [
      {
        header: 'Date',
        accessorKey: 'createdAt',
        cell: ({ getValue }) => formatUsageDate(getValue() as string | undefined),
      },
      {
        header: 'Coupon',
        id: 'coupon',
        cell: ({ row }) =>
          getCoupon(row.original)?.coupon_code || row.original.coupon_code || '-',
      },
      {
        header: 'Type',
        id: 'coupon_type',
        cell: ({ row }) =>
          getCoupon(row.original)?.coupon_type || row.original.coupon_type || '-',
      },
      {
        header: 'Customer',
        id: 'customer',
        cell: ({ row }) => getUser(row.original)?.name || '-',
      },
      {
        header: 'Email',
        id: 'email',
        cell: ({ row }) => getUser(row.original)?.email || '-',
      },
      {
        header: 'Order',
        id: 'order',
        cell: ({ row }) => {
          const order = getOrder(row.original)
          if (!order) return '-'
          return order.order_number != null ? `#${order.order_number}` : '-'
        },
      },
      {
        header: 'Cart',
        id: 'cart',
        cell: ({ row }) => formatMoney(row.original.cart_amount, row.original.currency),
      },
      {
        header: 'Discount',
        id: 'discount',
        cell: ({ row }) => formatMoney(row.original.discount_amount, row.original.currency),
      },
      {
        header: 'Order total',
        id: 'order_total',
        cell: ({ row }) => {
          const order = getOrder(row.original)
          return formatMoney(
            row.original.order_total ?? order?.total_amount,
            row.original.currency || order?.currency,
          )
        },
      },
      {
        header: 'Usage',
        accessorKey: 'type',
        cell: ({ getValue }) => (getValue() as string) || 'order',
      },
      {
        header: 'Actions',
        id: 'actions',
        cell: ({ row }) => {
          const order = getOrder(row.original)
          if (!order?._id) return '-'
          return (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => navigate(`/orders/${order._id}`)}
              title="View order"
            >
              <Eye size={16} />
            </button>
          )
        },
      },
    ],
    [navigate],
  )

  if (initialLoading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{couponCode ? `${couponCode} usage` : 'Coupon Usage'}</h1>
          <p className="page-subtitle">
            {couponCode
              ? `Orders and customers that used ${couponCode}.`
              : 'See which customers used coupons, on which orders, and the discount applied.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canExport && (
            <button type="button" className="btn" onClick={exportCsv} disabled={exporting}>
              <FileDown size={18} /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => navigate('/coupons')}>
            Back to coupons
          </button>
        </div>
      </div>

      <div className="card payment-filter-card">
        <div className="payment-filter-bar">
          <div className="payment-filter-fields">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>From Date</div>
              <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>To Date</div>
              <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Type</div>
              <select className="select" value={typeInput} onChange={(e) => setTypeInput(e.target.value)}>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={loading}>
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.65)',
              borderRadius: 12,
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading coupon usage…</span>
          </div>
        )}
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search coupon, customer, or type..."
          serverSearch={{
            value: searchInput,
            onChange: (value) => {
              setSearchInput(value)
              setPageIndex(0)
            },
          }}
          serverPagination={{
            pageIndex,
            pageSize,
            totalCount,
            onPageChange: (nextPageIndex, nextPageSize) => {
              setPageIndex(nextPageIndex)
              setPageSize(nextPageSize)
              load(nextPageIndex, nextPageSize)
            },
          }}
        />
      </div>
    </>
  )
}

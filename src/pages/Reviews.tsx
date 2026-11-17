import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, Eye, ImageOff, Star, X } from 'lucide-react'
import { reviewsApi } from '../api/endpoints'
import { getProfileImageUrl } from '../api/client'
import type { ProductReview, ProductReviewProduct } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { useModuleCan } from '../components/rbac/useModuleCan'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function reviewsFrom(payload: unknown): ProductReview[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown; reviews?: unknown }
  const body = root.data && typeof root.data === 'object' ? (root.data as { reviews?: unknown }) : root
  return Array.isArray(body.reviews) ? (body.reviews as ProductReview[]) : []
}

const productOf = (review: ProductReview): ProductReviewProduct | null => {
  const product = review.product_id
  return product && typeof product === 'object' ? product : null
}

const customerName = (review: ProductReview) => {
  const user = review.user_id && typeof review.user_id === 'object' ? review.user_id : null
  return String(review.name || user?.name || '').trim() || '-'
}

const customerEmail = (review: ProductReview) => {
  const user = review.user_id && typeof review.user_id === 'object' ? review.user_id : null
  return String(review.email || user?.email || '').trim() || '-'
}

const isRejected = (status?: string) => {
  const key = String(status || '').toLowerCase()
  return key === 'rejected' || key === 'remove'
}

const isDecided = (status?: string) =>
  String(status || '').toLowerCase() === 'approved' || isRejected(status)

const statusLabel = (status?: string) => {
  const key = String(status || '').toLowerCase()
  if (key === 'approved') return 'Approved'
  if (isRejected(key)) return 'Rejected'
  if (key === 'pending') return 'Pending'
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '-'
}

const statusClass = (status?: string) => {
  const key = String(status || '').toLowerCase()
  if (key === 'approved') return 'order-status order-status--success'
  if (isRejected(key)) return 'order-status order-status--danger'
  if (key === 'pending') return 'order-status order-status--warning'
  return 'order-status order-status--neutral'
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const apiMessage = (err: unknown, fallback: string) => {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

function Stars({ rating }: { rating: number }) {
  const score = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return (
    <span className="review-stars" title={`${Number(rating) || 0} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={14} fill={index < score ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

function ReviewThumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <span className="review-product__thumb review-product__thumb--empty">
        <ImageOff size={16} />
      </span>
    )
  }
  return <img src={src} alt="" className="review-product__thumb" onError={() => setFailed(true)} />
}

function ReviewDate({ value }: { value?: string }) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return <span className="review-muted">-</span>
  return (
    <div className="review-date">
      <span>{date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      <span className="review-muted">{date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  )
}

export function Reviews() {
  const { canEdit } = useModuleCan('reviews')
  const [data, setData] = useState<ProductReview[]>([])
  const [status, setStatus] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState('')
  const [viewReview, setViewReview] = useState<ProductReview | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    reviewsApi
      .getAll()
      .then((res) => setData(reviewsFrom(res.data)))
      .catch((err) => setError(apiMessage(err, 'Failed to load reviews')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const applyStatus = (review: ProductReview, next: string) => {
    setData((rows) => rows.map((row) => (row._id === review._id ? { ...row, status: next } : row)))
    setViewReview((current) => (current?._id === review._id ? { ...current, status: next } : current))
  }

  const decide = async (review: ProductReview, decision: 'approved' | 'rejected') => {
    if (!canEdit || isDecided(review.status)) return
    setActingId(review._id)
    setError('')
    try {
      if (decision === 'approved') await reviewsApi.approve(review._id)
      else await reviewsApi.reject(review._id)
      applyStatus(review, decision === 'approved' ? 'approved' : 'remove')
    } catch (err) {
      setError(apiMessage(err, decision === 'approved' ? 'Failed to approve review' : 'Failed to reject review'))
    } finally {
      setActingId('')
    }
  }

  const visibleRows = useMemo(
    () => data.filter((row) => {
      if (status === 'all') return true
      if (status === 'rejected') return isRejected(row.status)
      return String(row.status || '').toLowerCase() === status
    }),
    [data, status],
  )

  const counts = useMemo(() => ({
    all: data.length,
    pending: data.filter((row) => String(row.status || '').toLowerCase() === 'pending').length,
    approved: data.filter((row) => String(row.status || '').toLowerCase() === 'approved').length,
    rejected: data.filter((row) => isRejected(row.status)).length,
  }), [data])

  const columns: ColumnDef<ProductReview, unknown>[] = [
    {
      header: 'Action',
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => {
        const review = row.original
        const busy = actingId === review._id
        const decided = isDecided(review.status)
        const approved = String(review.status || '').toLowerCase() === 'approved'
        const lockedTitle = approved
          ? 'Approved reviews cannot be changed'
          : 'Rejected reviews cannot be changed'
        return (
          <div className="review-row-actions">
            <button
              type="button"
              className="review-icon-btn"
              title="View review"
              aria-label="View review"
              onClick={() => setViewReview(review)}
            >
              <Eye size={15} />
            </button>
            {canEdit && (
            <button
              type="button"
              className="review-icon-btn review-icon-btn--approve"
              title={decided ? lockedTitle : 'Approve'}
              aria-label="Approve review"
              disabled={busy || decided}
              onClick={() => decide(review, 'approved')}
            >
              <Check size={15} />
            </button>
            )}
            {canEdit && (
            <button
              type="button"
              className="review-icon-btn review-icon-btn--reject"
              title={decided ? lockedTitle : 'Reject'}
              aria-label="Reject review"
              disabled={busy || decided}
              onClick={() => decide(review, 'rejected')}
            >
              <X size={15} />
            </button>
            )}
          </div>
        )
      },
    },
    {
      header: 'Product',
      id: 'product',
      accessorFn: (row) => productOf(row)?.title || '',
      cell: ({ row }) => {
        const product = productOf(row.original)
        const title = product?.title || '-'
        return (
          <div className="review-product">
            <ReviewThumb src={getProfileImageUrl(product?.thumbnail)} />
            <div className="review-product__text">
              {product?._id ? (
                <Link to={`/products/${product._id}`} className="review-product__title" title={title}>
                  {title}
                </Link>
              ) : (
                <span className="review-product__title" title={title}>{title}</span>
              )}
              {row.original.variant_sku ? (
                <span className="review-muted">SKU {row.original.variant_sku}</span>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      header: 'Customer',
      id: 'customer',
      accessorFn: (row) => `${customerName(row)} ${customerEmail(row)}`,
      cell: ({ row }) => (
        <div className="review-customer">
          <span className="review-customer__name">{customerName(row.original)}</span>
          <span className="review-muted">{customerEmail(row.original)}</span>
        </div>
      ),
    },
    {
      header: 'Review',
      id: 'text',
      accessorFn: (row) => row.text,
      cell: ({ row }) => {
        const value = String(row.original.text || '').trim() || '-'
        return (
          <button type="button" className="review-text" onClick={() => setViewReview(row.original)} title="Read full review">
            <Stars rating={Number(row.original.rating) || 0} />
            <span className="review-text__body">{value}</span>
          </button>
        )
      },
    },
    {
      header: 'Status',
      id: 'status',
      accessorFn: (row) => statusLabel(row.status),
      cell: ({ row }) => (
        <span className={statusClass(row.original.status)}>
          <span className="order-status__dot" />
          {statusLabel(row.original.status)}
        </span>
      ),
    },
    {
      header: 'Date',
      id: 'createdAt',
      accessorFn: (row) => row.createdAt || '',
      cell: ({ row }) => <ReviewDate value={row.original.createdAt} />,
    },
  
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  const viewed = viewReview

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">Approve or reject product reviews before they appear on the store.</p>
        </div>
      </div>

      <div className="card filter-toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status</span>
          <select className="select" aria-label="Review status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({counts[option.value]})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        data={visibleRows}
        columns={columns}
        searchPlaceholder="Search product, customer, email, or review..."
      />

      {viewed && (
        <Modal title="Product review" onClose={() => setViewReview(null)}>
          <div className="review-detail">
            <div className="review-detail__grid">
              <span>Product</span>
              <span>{productOf(viewed)?.title || '-'}</span>
              <span>Customer</span>
              <span>{customerName(viewed)}</span>
              <span>Email</span>
              <span>{customerEmail(viewed)}</span>
              <span>Rating</span>
              <Stars rating={Number(viewed.rating) || 0} />
              <span>Status</span>
              <span className={statusClass(viewed.status)}>
                <span className="order-status__dot" />
                {statusLabel(viewed.status)}
              </span>
              <span>Date</span>
              <span>{formatDate(viewed.createdAt)}</span>
            </div>
            <p className="review-detail__text">{viewed.text}</p>
            {canEdit && (
            <div className="review-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actingId === viewed._id || isDecided(viewed.status)}
                onClick={() => decide(viewed, 'approved')}
              >
                <Check size={14} />
                Approve
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={actingId === viewed._id || isDecided(viewed.status)}
                onClick={() => decide(viewed, 'rejected')}
              >
                <X size={14} />
                Reject
              </button>
            </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

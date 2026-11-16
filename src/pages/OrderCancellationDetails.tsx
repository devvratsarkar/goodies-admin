import { useEffect, useState } from 'react'
import moment from 'moment'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MapPin, Package, Receipt, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import { orderCancellationApi } from '../api/endpoints'
import type { OrderCancellationRequest, OrderItemSummary } from '../types/api'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { useModuleCan } from '../components/rbac/useModuleCan'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = moment(value)
  return date.isValid() ? date.format('D MMM YYYY, h:mm A') : value
}

const toTitleCase = (value?: string | null) => {
  if (!value) return '—'
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const money = (currency: string | undefined, amount?: number | null) => {
  if (amount == null || Number.isNaN(Number(amount))) return '—'
  return `${currency || 'AED'} ${Number(amount).toFixed(2)}`
}

const statusKey = (status?: string | null) => String(status || '').toLowerCase().replace(/\s+/g, '_')

const timelineTone = (status?: string | null) => {
  const key = statusKey(status).replace(/-/g, '_')
  if (['failed', 'cancelled', 'canceled', 'rejected', 'returned'].includes(key)) return 'danger'
  if (['completed', 'delivered', 'paid', 'approved', 'success'].includes(key)) return 'success'
  if (['pending', 'refund_pending', 'on_hold'].includes(key)) return 'warning'
  if (['processing', 'shipped', 'packed', 'refund_initiated', 'initiating_refund'].includes(key)) return 'info'
  if (key === 'refunded') return 'refunded'
  return 'neutral'
}

const statusClass = (status?: string | null) => {
  const key = statusKey(status)
  if (key === 'refunded') return 'order-status order-status--refunded'
  if (['approved', 'paid', 'success', 'completed', 'delivered'].includes(key)) return 'order-status order-status--success'
  if (['refund_initiated', 'shipped'].includes(key)) return 'order-status order-status--info'
  if (['pending', 'refund_pending', 'initiating_refund', 'processing', 'packed'].includes(key)) return 'order-status order-status--warning'
  if (['rejected', 'failed', 'cancelled', 'canceled'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

const displayMethod = (value?: string | null) => {
  const text = toTitleCase(value)
  if (text === '—') return text
  if (text.length <= 4 && !text.includes(' ')) return text.toUpperCase()
  return text
}

function StatusChip({ status }: { status?: string | null }) {
  if (!status) return <span>—</span>
  return (
    <span className={statusClass(status)}>
      <span className="order-status__dot" aria-hidden="true" />
      {toTitleCase(status)}
    </span>
  )
}

function AddressFields({ address }: { address: Record<string, unknown> }) {
  const phone = address.country_code
    ? `${String(address.phone_number || '')}`.trim()
    : String(address.phone_number || '—')

  return (
    <div className="order-info-card-body order-info-card-body-grid">
      <div className="order-field">
        <span className="order-field-label">Full name</span>
        <span className="order-field-value">
          {String(address.full_name || [address.first_name, address.last_name].filter(Boolean).join(' ') || '—')}
        </span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Phone</span>
        <span className="order-field-value">{phone}</span>
      </div>
      <div className="order-field order-field--wide">
        <span className="order-field-label">Address</span>
        <span className="order-field-value order-address-value">{String(address.street_address || '—')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">State</span>
        <span className="order-field-value">{String(address.state || '—')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">City</span>
        <span className="order-field-value">{String(address.city || '—')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Postal code</span>
        <span className="order-field-value">{String(address.postal_code || '—')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Country</span>
        <span className="order-field-value">{String(address.country || '—')}</span>
      </div>
      {address.email ? (
        <div className="order-field order-field--wide">
          <span className="order-field-label">Email</span>
          <span className="order-field-value">{String(address.email)}</span>
        </div>
      ) : null}
    </div>
  )
}

function ItemTable({ items, currency }: { items: Array<OrderItemSummary | string>; currency: string }) {
  return (
    <div className="table-wrap">
      <table className="data-table order-items-table cancel-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            if (typeof item !== 'object') return null
            const preview = itemImage(item)
            return (
              <tr key={item._id || `${idx}`}>
                <td>
                  <div className="order-item-product">
                    {preview ? <img src={preview} alt="" className="order-item-product-image" /> : null}
                    <div>
                      <span className="order-item-product-title">{itemTitle(item)}</span>
                      {item.cancelled ? <div className="cancel-person-sub">Already cancelled</div> : null}
                    </div>
                  </div>
                </td>
                <td data-label="SKU">{item.variant_sku || '—'}</td>
                <td data-label="Qty">{item.quantity ?? '—'}</td>
                <td data-label="Total">{money(currency, item.total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function normalize(payload: unknown): OrderCancellationRequest | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as OrderCancellationRequest
  return data ?? null
}

const itemTitle = (item: OrderItemSummary) => {
  const product = item.product_id && typeof item.product_id === 'object' ? item.product_id : null
  return product?.title || item.product_name || 'Product'
}

const itemImage = (item: OrderItemSummary) => {
  const product = item.product_id && typeof item.product_id === 'object' ? item.product_id : null
  return product?.thumbnail || product?.images?.[0] || ''
}

export function OrderCancellationDetails() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit } = useModuleCan('order-cancellations')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [request, setRequest] = useState<OrderCancellationRequest | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [refundStatus, setRefundStatus] = useState('pending')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundTransactionId, setRefundTransactionId] = useState('')

  const load = () => {
    if (!id) return
    setLoading(true)
    setError('')
    orderCancellationApi
      .getById(id)
      .then((res) => {
        const detail = normalize(res.data)
        setRequest(detail)
        setAdminNote(detail?.admin_note || '')
        const normalizedRefundStatus = (detail?.refund_status || 'pending')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
        setRefundStatus(normalizedRefundStatus || 'pending')
        setRefundAmount(detail?.refund_amount != null ? String(detail.refund_amount) : '')
        setRefundTransactionId(detail?.refund_transaction_id || '')
      })
      .catch(() => setError('Failed to load cancellation request'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const decide = async (status: 'approved' | 'rejected') => {
    if (!canEdit || !id) return
    const paid = ['paid', 'completed', 'success'].includes(
      String(order?.payment_status || '').toLowerCase(),
    )
    const message =
      status === 'approved'
        ? paid
          ? 'Approving cancels the requested items and restores their stock. The refund stays pending until you process it. Continue?'
          : 'Approving cancels the requested items and restores their stock. This order was not paid, so no refund is created. Continue?'
        : 'Rejecting leaves the order and its items unchanged. Continue?'
    if (!(await adminConfirm(message, {
      title: status === 'approved' ? 'Approve cancellation' : 'Reject cancellation',
      confirmText: status === 'approved' ? 'Approve' : 'Reject',
    }))) {
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await orderCancellationApi.updateStatus(id, {
        status,
        admin_note: adminNote || undefined,
      })
      setSuccess(status === 'approved' ? 'Cancellation approved' : 'Cancellation rejected')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, `Failed to ${status === 'approved' ? 'approve' : 'reject'} this request`))
    } finally {
      setSaving(false)
    }
  }

  const updateRefund = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || !id) return
    const tabby = String(order?.payment_method || '').toLowerCase() === 'tabby_installments'
    const markingRefunded = refundStatus === 'refunded'
    if (!(await adminConfirm(
      markingRefunded && tabby
        ? 'This will send the refund to Tabby. Continue?'
        : 'Update the refund status for this request?',
      { title: 'Update refund', confirmText: 'Update refund' },
    ))) {
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await orderCancellationApi.updateRefund(id, {
        refund_status: refundStatus,
        refund_amount: refundAmount ? Number(refundAmount) : undefined,
        refund_transaction_id: refundTransactionId || undefined,
        admin_note: adminNote || undefined,
      })
      setSuccess('Refund updated')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update refund'))
    } finally {
      setSaving(false)
    }
  }

  const user = request?.user_id && typeof request.user_id === 'object' ? request.user_id : null
  const order = request?.order_id && typeof request.order_id === 'object' ? request.order_id : null
  const admin = request?.admin_id && typeof request.admin_id === 'object' ? request.admin_id : null
  const currency = order?.currency || 'AED'
  const cancelItems = request?.order_item_ids ?? []
  const timeline = request?.timeline ?? []
  const isPending = request?.status === 'pending'
  const refundStatusKey = (request?.refund_status || '').trim().toLowerCase().replace(/\s+/g, '_')
  const canUpdateRefund =
    request?.status === 'approved' &&
    Boolean(request?.refund_status) &&
    refundStatusKey !== 'not_required' &&
    refundStatusKey !== 'refunded'
  const address = (request?.shipping_address ?? null) as Record<string, unknown> | null
  const billingAddress = (request?.billing_address ?? null) as Record<string, unknown> | null
  const orderId = order?._id
  const tabby = String(order?.payment_method || '').toLowerCase() === 'tabby_installments'

  if (loading && !request) return <div className="page-loading">Loading...</div>

  return (
    <div className="order-details-page">
      <div className="order-details-topbar">
        <button
          type="button"
          className="btn btn-ghost order-details-back-link"
          onClick={() => navigate('/order-cancellations')}
        >
          <ArrowLeft size={16} />
          Back to cancellations
        </button>
      </div>

      <section className="card order-summary">
        <div className="order-summary__head">
          <div className="cancel-request-copy">
            <div className="order-summary__kicker">Cancellation request</div>
            <h1 className="order-summary__title">{request?.reason || 'Cancellation request'}</h1>
            <p className="order-summary__date">Requested {formatDate(request?.createdAt)}</p>
          </div>
          <div className="cancel-order-ref">
            <div>
              <div className="order-summary__kicker">Order</div>
              <strong className="order-summary__invoice-number">#{order?.order_number ?? '—'}</strong>
            </div>
            {orderId ? (
              <button type="button" className="btn btn-ghost cancel-order-ref__open" onClick={() => navigate(`/orders/${orderId}`)}>
                <Package size={15} />
                Open order
              </button>
            ) : null}
          </div>
        </div>
        <div className="order-summary__statuses cancel-summary-statuses">
          <div>
            <span className="order-summary__kicker">Request</span>
            <StatusChip status={request?.status} />
          </div>
          <div>
            <span className="order-summary__kicker">Refund</span>
            <StatusChip status={request?.refund_status} />
          </div>
          <div>
            <span className="order-summary__kicker">Order status</span>
            <StatusChip status={order?.status} />
          </div>
          <div>
            <span className="order-summary__kicker">Payment</span>
            <StatusChip status={order?.payment_status} />
          </div>
        </div>
        <div className="order-summary__statuses cancel-summary-facts">
          <div>
            <span className="order-summary__kicker">Refund amount</span>
            <strong>{money(currency, request?.refund_amount)}</strong>
          </div>
          <div>
            <span className="order-summary__kicker">Order total</span>
            <strong>{money(currency, order?.total_amount)}</strong>
          </div>
          <div>
            <span className="order-summary__kicker">Payment method</span>
            <strong>{displayMethod(order?.payment_method)}</strong>
          </div>
          <div>
            <span className="order-summary__kicker">Currency</span>
            <strong>{currency.toUpperCase()}</strong>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card order-items-card">
        <div className="order-info-card-header cancel-items-head">
          <h3>
            <Package size={16} />
            Requested items
          </h3>
          <span className="cancel-items-count">
            {cancelItems.length} item{cancelItems.length === 1 ? '' : 's'}
          </span>
        </div>
        {!cancelItems.length ? (
          <div className="order-info-card-body">
            <span style={{ color: 'var(--text-dim)' }}>No items</span>
          </div>
        ) : (
          <ItemTable items={cancelItems} currency={currency} />
        )}
      </div>

      <div className="order-details-info-grid cancel-info-grid">
        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <UserRound size={16} />
              Customer
            </h3>
          </div>
          <div className="order-info-card-body">
            <div className="order-field">
              <span className="order-field-label">Name</span>
              <span className="order-field-value">{user?.name || '—'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Email</span>
              <span className="order-field-value">{user?.email || '—'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Phone</span>
              <span className="order-field-value">{user?.phone_number || '—'}</span>
            </div>
          </div>
        </div>

        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <ShieldCheck size={16} />
              Request
            </h3>
          </div>
          <div className="order-info-card-body">
            <div className="order-field">
              <span className="order-field-label">Scope</span>
              <span className="order-field-value">
                {cancelItems.length} item{cancelItems.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Invoice number</span>
              <span className="order-field-value">{order?.invoice_number ? `#${order.invoice_number}` : '—'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Processed</span>
              <span className="order-field-value">{formatDate(request?.processed_at)}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Processed by</span>
              <span className="order-field-value">{admin?.name || '—'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Customer note</span>
              <span className="order-field-value">{request?.description || '—'}</span>
            </div>
            {request?.admin_note ? (
              <div className="order-field">
                <span className="order-field-label">Admin note</span>
                <span className="order-field-value">{request.admin_note}</span>
              </div>
            ) : null}
            {request?.refund_transaction_id ? (
              <div className="order-field">
                <span className="order-field-label">Refund reference</span>
                <span className="order-field-value">{request.refund_transaction_id}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <MapPin size={16} />
              Shipping address
            </h3>
          </div>
          {address ? (
            <AddressFields address={address} />
          ) : (
            <div className="order-info-card-body">
              <span style={{ color: 'var(--text-dim)' }}>No shipping address</span>
            </div>
          )}
        </div>

        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <Receipt size={16} />
              Billing address
            </h3>
          </div>
          {billingAddress ? (
            <AddressFields address={billingAddress} />
          ) : (
            <div className="order-info-card-body">
              <span style={{ color: 'var(--text-dim)' }}>No billing address</span>
            </div>
          )}
        </div>
      </div>

      <div className="order-details-lower-grid">
        <div className="card order-update-card">
          <div className="order-info-card-header">
            <h3>
              {isPending ? <ShieldCheck size={16} /> : <Wallet size={16} />}
              {isPending ? 'Decision' : 'Refund'}
            </h3>
          </div>

          {isPending && canEdit ? (
            <div className="order-update-form">
              <p className="cancel-hint">
                Approve cancels only the requested items and puts stock back. The customer is not refunded until you complete the refund step.
              </p>
              <label className="order-field-label" htmlFor="cancel-admin-note">Admin note</label>
              <textarea
                id="cancel-admin-note"
                className="textarea"
                rows={3}
                placeholder="Optional note for the customer and the timeline"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
              <div className="cancel-decision-actions">
                <button type="button" className="btn btn-danger" disabled={saving} onClick={() => decide('rejected')}>
                  {saving ? 'Saving...' : 'Reject'}
                </button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => decide('approved')}>
                  {saving ? 'Saving...' : 'Approve cancellation'}
                </button>
              </div>
            </div>
          ) : null}

          {canUpdateRefund && canEdit ? (
            <form className="order-update-form" onSubmit={updateRefund}>
              <p className="cancel-hint">
                {tabby
                  ? 'Choosing Refunded sends this amount to Tabby.'
                  : 'Record the refund here. Only Tabby payments are sent to the gateway automatically.'}
              </p>
              <div>
                <label className="order-field-label" htmlFor="refund-status">Refund status</label>
                <select
                  id="refund-status"
                  className="select"
                  value={refundStatus}
                  onChange={(e) => setRefundStatus(e.target.value)}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="pending">Pending</option>
                  <option value="initiating_refund">Initiating refund</option>
                  <option value="refund_initiated">Refund initiated</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div>
                <label className="order-field-label" htmlFor="refund-amount">Amount ({currency})</label>
                <input
                  id="refund-amount"
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="order-field-label" htmlFor="refund-ref">Transaction reference</label>
                <input
                  id="refund-ref"
                  className="input"
                  type="text"
                  placeholder="Gateway reference, if you have one"
                  value={refundTransactionId}
                  onChange={(e) => setRefundTransactionId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="order-field-label" htmlFor="refund-note">Admin note</label>
                <textarea
                  id="refund-note"
                  className="textarea"
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
              <div className="order-update-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Update refund'}
                </button>
              </div>
            </form>
          ) : null}

          {!isPending && !canUpdateRefund ? (
            <p className="order-locked-note">
              {request?.status === 'rejected'
                ? 'This request was rejected, so the refund status cannot be changed.'
                : ['cancelled', 'canceled'].includes(statusKey(request?.status))
                  ? 'This cancellation is cancelled, so the refund status cannot be changed.'
                  : refundStatusKey === 'not_required'
                    ? 'This order was not paid, so there is nothing to refund.'
                    : refundStatusKey === 'refunded'
                      ? `This refund is completed${request?.refund_amount != null ? ` for ${money(currency, request.refund_amount)}` : ''}, so it cannot be changed.`
                      : `This request is ${toTitleCase(request?.status).toLowerCase()}.`}
            </p>
          ) : null}
        </div>

        <div className="card order-timeline-card">
          <div className="order-info-card-header">
            <h3>
              <Clock size={16} />
              Timeline
            </h3>
          </div>
          {!timeline.length ? (
            <div className="order-info-card-body">
              <span style={{ color: 'var(--text-dim)' }}>No timeline yet</span>
            </div>
          ) : (
            <div className="order-timeline-list">
              {timeline.map((entry, index) => (
                <div key={`${entry.at}-${index}`} className={`order-timeline-item order-timeline-item--${timelineTone(entry.status)}`}>
                  <span className="order-timeline-dot" />
                  <div>
                    <div className="order-timeline-status">{toTitleCase(entry.status)}</div>
                    {entry.message ? <div className="order-timeline-message">{entry.message}</div> : null}
                    <div className="order-timeline-date">{formatDate(entry.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

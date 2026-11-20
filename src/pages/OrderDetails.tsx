import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useScrollToNotice } from '../hooks/useScrollToNotice'
import {
  ArrowLeft,
  Clock,
  Download,
  ChevronUp,
  CircleHelp,
  MapPin,
  Receipt,
  Package,
  Truck,
  UserRound,
} from 'lucide-react'
import { ordersApi } from '../api/endpoints'
import type { OrderDetail } from '../types/api'
import { getApiErrorMessage } from '../utils/apiError'
import { useModuleCan } from '../components/rbac/useModuleCan'

function normalizeDetail(payload: unknown): OrderDetail | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as OrderDetail
  return data ?? null
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

function OrderAttribution({ order }: { order: OrderDetail | null }) {
  const [open, setOpen] = useState(true)
  const origin = order?.origin?.trim() ? toTitleCase(order.origin) : 'Direct'
  const device = order?.device_type?.trim() ? toTitleCase(order.device_type) : '-'
  const views = order?.session_page_views
  const pageViews = views == null || !Number.isFinite(Number(views)) ? '-' : String(views)

  return (
    <div className="card order-attribution-card">
      <div className="order-attribution-card__head">
        <h3>Order attribution</h3>
        <button
          type="button"
          className="order-attribution-card__toggle"
          aria-expanded={open}
          aria-label={open ? 'Hide order attribution' : 'Show order attribution'}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronUp size={16} className={open ? '' : 'is-collapsed'} />
        </button>
      </div>
      {open && (
        <div className="order-attribution-card__body">
          <div>
            <div className="order-attribution-card__label">Origin</div>
            <div className="order-attribution-card__value">{origin}</div>
          </div>
          <div>
            <div className="order-attribution-card__label">Device type</div>
            <div className="order-attribution-card__value">{device}</div>
          </div>
          <div>
            <div className="order-attribution-card__label">
              Session page views
              <span className="order-attribution-card__help" title="Pages viewed in the session that led to this order.">
                <CircleHelp size={14} />
              </span>
            </div>
            <div className="order-attribution-card__value">{pageViews}</div>
          </div>
        </div>
      )}
    </div>
  )
}

const toTitleCase = (value?: string | null) => {
  if (!value) return '-'
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const formatMoney = (currency: string | undefined, amount: number) => {
  return `${currency || 'GBP'} ${amount.toFixed(2)}`
}

function storeProductUrl(slug?: string) {
  const origin =
    (import.meta.env.VITE_STORE_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://goodies-jade.vercel.app'
  const path = (slug || '').trim()
  if (!path) return ''
  return `${origin}/product/${encodeURIComponent(path)}`
}

const statusKey = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

const orderStatusClass = (value?: string | null) => {
  const key = statusKey(value)
  if (['completed', 'delivered'].includes(key)) return 'order-status order-status--success'
  if (['processing', 'shipped', 'packed'].includes(key)) return 'order-status order-status--info'
  if (['pending', 'on_hold'].includes(key)) return 'order-status order-status--warning'
  if (['cancelled', 'canceled', 'failed', 'returned'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

const timelineTone = (value?: string | null) => {
  const key = statusKey(value)
  if (['failed', 'cancelled', 'canceled', 'rejected', 'returned', 'tamara_p_canceled', 'tamara_p_failed'].includes(key)) return 'danger'
  if (['completed', 'delivered', 'paid', 'approved', 'success'].includes(key)) return 'success'
  if (['pending', 'on_hold', 'unpaid'].includes(key)) return 'warning'
  if (['processing', 'shipped', 'packed', 'refund_pending', 'refund_initiated', 'initiating_refund'].includes(key)) return 'info'
  if (key === 'refunded') return 'refunded'
  return 'neutral'
}

const paymentStatusClass = (value?: string | null) => {
  const key = statusKey(value)
  if (key === 'paid') return 'order-status order-status--success'
  if (['pending', 'unpaid'].includes(key)) return 'order-status order-status--warning'
  if (key === 'refund_pending') return 'order-status order-status--info'
  if (key === 'refunded') return 'order-status order-status--refunded'
  if (['failed', 'cancelled', 'canceled'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

const amountOf = (value: unknown) => {
  const amount = Number(value || 0)
  return Number.isFinite(amount) ? amount : 0
}

type BundleOrderItem = {
  product_id?: string | null
  title?: string | null
  sku?: string | null
  thumbnail?: string | null
  quantity?: number
  variant?: string | null
}

function OrderTotals({ order, currency }: { order: OrderDetail | null; currency: string }) {
  const subtotal = amountOf(order?.subtotal_amount)
  const shipping = amountOf(order?.shipping_amount)
  const tax = amountOf(order?.tax_amount)
  const cod = amountOf(order?.cod_amount)
  const discount = amountOf(order?.discount_amount)
  const bogo = amountOf(order?.bogo_discount)
  const bogoLabel = String(order?.bogo_label || '').trim() || 'Buy 2 Get 1 Free – Cheapest Item Free'
  const couponCode = String(order?.coupon_code || '').trim()
  const customerNote = String(order?.customer_note || '').trim()
  const orderTotal = amountOf(order?.total_amount)
  const placedCurrency = String(order?.placed_currency || '').trim().toUpperCase()
  const placedTotal = amountOf(order?.placed_grand_total)
  const paid = ['paid', 'completed', 'success'].includes(String(order?.payment_status || '').toLowerCase())
    ? orderTotal
    : 0
  const rows = [
    { label: 'Items Subtotal', value: formatMoney(currency, subtotal), emphasize: false },
    { label: 'Shipping', value: formatMoney(currency, shipping), emphasize: false },
    ...(cod > 0 ? [{ label: 'COD charge', value: formatMoney(currency, cod), emphasize: false }] : []),
    ...(tax > 0 ? [{ label: 'Tax', value: formatMoney(currency, tax), emphasize: false }] : []),
    ...(discount > 0 || couponCode
      ? [{
          label: couponCode ? `Discount (${couponCode})` : 'Discount',
          value: `− ${formatMoney(currency, discount)}`,
          emphasize: false,
        }]
      : []),
    ...(bogo > 0
      ? [{
          label: bogoLabel,
          value: `− ${formatMoney(currency, bogo)}`,
          emphasize: false,
        }]
      : []),
    ...(customerNote ? [{ label: 'Note', value: customerNote, emphasize: false, note: true }] : []),
    { label: 'Order Total', value: formatMoney(currency, orderTotal), emphasize: true },
  ]

  return (
    <div className="order-items-summary">
      {rows.map((row) => (
        <div
          key={row.label}
          className={[
            'order-items-summary__row',
            row.emphasize ? 'order-items-summary__total' : '',
            'note' in row && row.note ? 'order-items-summary__note' : '',
          ].filter(Boolean).join(' ')}
        >
          <span>{row.label}</span>
          <span>{row.value}</span>
        </div>
      ))}
      <div className="order-items-summary__paid">
        <span>Paid</span>
        <span>{formatMoney(currency, paid)}</span>
      </div>
      {placedCurrency ? (
        <div className="order-items-summary__placed">
          <span>Placed currency</span>
          <span>{formatMoney(placedCurrency, placedTotal)}</span>
        </div>
      ) : null}
    </div>
  )
}

function AddressFields({ address }: { address: Record<string, unknown> }) {
  const phone = address.country_code
    ? `${String(address.country_code)} ${String(address.phone_number || '')}`.trim()
    : String(address.phone_number || '-')

  return (
    <div className="order-info-card-body order-info-card-body-grid">
      <div className="order-field">
        <span className="order-field-label">Full Name</span>
        <span className="order-field-value">{String(address.full_name || '-')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Phone</span>
        <span className="order-field-value">{phone}</span>
      </div>
      <div className="order-field order-field--wide">
        <span className="order-field-label">Address</span>
        <span className="order-field-value order-address-value">{String(address.street_address || '-')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">State</span>
        <span className="order-field-value">{String(address.state || '-')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">City</span>
        <span className="order-field-value">{String(address.city || '-')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Postal Code</span>
        <span className="order-field-value">{String(address.postal_code || '-')}</span>
      </div>
      <div className="order-field">
        <span className="order-field-label">Country</span>
        <span className="order-field-value">{String(address.country || '-')}</span>
      </div>
      {address.email ? (
        <div className="order-field">
          <span className="order-field-label">Email</span>
          <span className="order-field-value">{String(address.email)}</span>
        </div>
      ) : null}
    </div>
  )
}

const getCancellationTone = (status?: string): 'warning' | 'success' | 'danger' | 'info' => {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '_')
  if (['approved', 'cancelled', 'refunded'].includes(key)) return 'danger'
  if (['rejected'].includes(key)) return 'info'
  if (['pending', 'cancel_order_request', 'requested'].includes(key)) return 'warning'
  return 'warning'
}

export function OrderDetails() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canEdit, canExport } = useModuleCan('orders')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || success, noticeRevision)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [status, setStatus] = useState('pending')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [message, setMessage] = useState('')
  const [sendEmail, setSendEmail] = useState('')
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)
  const orderStatuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'failed', label: 'Failed' },
  ]
  const statusOptions =
    status && !orderStatuses.some((option) => option.value === status)
      ? [{ value: status, label: toTitleCase(status) }, ...orderStatuses]
      : orderStatuses

  const load = () => {
    if (!id) return
    setLoading(true)
    setError('')
    ordersApi
      .getById(id)
      .then((res) => {
        const detail = normalizeDetail(res.data)
        setOrder(detail)
        setStatus(detail?.status || 'pending')
        setPaymentStatus(detail?.payment_status || '')
      })
      .catch(() => setError('Failed to load order details'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const updateStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || !id) return
    setSaving(true)
    setNoticeRevision((current) => current + 1)
    setError('')
    setSuccess('')
    try {
      const res = await ordersApi.updateStatus(id, {
        status,
        payment_status: paymentStatus || undefined,
        message: message || undefined,
        send_email: sendEmail || undefined,
      })
      setSendEmail('')
      const notice = res.data?.message || 'Order saved'
      if (/could not be sent|no customer email|turned off|no recipients/i.test(notice)) {
        setError(notice)
      } else {
        setSuccess(notice)
      }
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update status'))
    } finally {
      setSaving(false)
    }
  }

  const downloadInvoice = async () => {
    if (!canExport || !id) return
    setDownloadingInvoice(true)
    setNoticeRevision((current) => current + 1)
    setError('')
    try {
      const res = await ordersApi.downloadInvoice(id)
      const contentType = String(res.headers['content-type'] || '')
      if (!contentType.includes('pdf')) {
        setError('Failed to download invoice')
        return
      }
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const invoiceNumber = (order as { invoice_number?: number | string } | null)?.invoice_number
      link.href = url
      link.download = `invoice-${invoiceNumber || order?.order_number || id}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download invoice')
    } finally {
      setDownloadingInvoice(false)
    }
  }

  const invoiceNumber = (order as { invoice_number?: number | string } | null)?.invoice_number
  const items = useMemo(() => (Array.isArray(order?.items) ? order?.items : []), [order?.items])
  const currentStatusKey = statusKey(order?.status)
  const wholeOrderCancelled =
    items.length > 0 &&
    items.every((item) => {
      const row = item as { cancelled?: boolean; cancellation?: { status?: string } | null }
      if (row.cancelled) return true
      return statusKey(row.cancellation?.status) === 'approved'
    })
  const statusLocked =
    ['completed', 'delivered', 'cancelled', 'canceled', 'failed', 'payment_failed', 'returned', 'refunded', 'initiating_refund', 'refund_initiated'].includes(currentStatusKey) ||
    wholeOrderCancelled
  const statusLockMessage = ['completed', 'delivered'].includes(currentStatusKey)
    ? 'This order is completed, so its status cannot be changed.'
    : ['cancelled', 'canceled'].includes(currentStatusKey) || wholeOrderCancelled
      ? 'This order is cancelled, so its status cannot be changed.'
      : ['failed', 'payment_failed'].includes(currentStatusKey)
        ? 'This order has failed, so its status cannot be changed.'
        : 'This order status cannot be changed.'
  const timeline = useMemo(() => (Array.isArray(order?.timeline) ? order?.timeline : []), [order?.timeline])
  const shippingAddress = (order?.shipping_address ?? null) as Record<string, unknown> | null
  const billingAddress = (order?.billing_address ?? null) as Record<string, unknown> | null
  const currency = order?.currency || 'GBP'

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="order-details-page">
      <div className="order-details-topbar">
        <button type="button" className="btn btn-ghost order-details-back-link" onClick={() => navigate('/orders')}>
          <ArrowLeft size={16} />
          Back to Orders
        </button>
        {/* <button type="button" className="btn btn-ghost order-details-back-btn" onClick={() => navigate('/orders')}>
          <ArrowLeft size={16} />
          Back
        </button> */}
      </div>

      <section className="card order-summary">
        <div className="order-summary__head">
          <div>
            <div className="order-summary__kicker">Order</div>
            <h1 className="order-summary__title">{order?.order_code || `#LXR-${order?.order_number ?? '-'}`}</h1>
            <p className="order-summary__date">{formatDate(order?.createdAt)}</p>
          </div>
          <div className="order-summary__invoice">
            <div className="order-summary__kicker">Invoice number</div>
            <div className="order-summary__invoice-row">
              <strong className="order-summary__invoice-number">
                {invoiceNumber != null && invoiceNumber !== '' ? `#${invoiceNumber}` : '-'}
              </strong>
              {canExport && (
              <button
                type="button"
                className="order-details-invoice-btn"
                onClick={downloadInvoice}
                disabled={downloadingInvoice || !id}
                title="Download invoice"
                aria-label="Download invoice"
              >
                <Download size={15} />
              </button>
              )}
            </div>
          </div>
        </div>
        <div className="order-summary__statuses">
          <div>
            <span className="order-summary__kicker">Payment status</span>
            <span className={paymentStatusClass(order?.payment_status)}>
              <span className="order-status__dot" />
              {toTitleCase(order?.payment_status)}
            </span>
          </div>
          <div>
            <span className="order-summary__kicker">Order status</span>
            <span className={orderStatusClass(order?.status)}>
              <span className="order-status__dot" />
              {toTitleCase(order?.status)}
            </span>
          </div>
          <div>
            <span className="order-summary__kicker">Payment method</span>
            <strong>{toTitleCase(order?.payment_method)}</strong>
          </div>
          <div>
            <span className="order-summary__kicker">Currency</span>
            <strong>{order?.currency ? String(order.currency).toUpperCase() : '-'}</strong>
          </div>
          <div>
            <span className="order-summary__kicker">Transaction ID</span>
            <strong className="order-summary__mono">{(order as { transaction_id?: string } | null)?.transaction_id || '-'}</strong>
          </div>
        </div>
      </section>

      {(error || success) ? (
        <div ref={noticeRef}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
        </div>
      ) : null}

      <div className="card order-items-card">
        <div className="order-info-card-header">
          <h3>
            <Package size={16} />
            Order Items
          </h3>
        </div>
        {!items.length ? (
          <div className="order-info-card-body">
            <span style={{ color: 'var(--text-dim)' }}>No items</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table order-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Variant</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const product = (item as { product_id?: { _id?: string; title?: string; slug?: string; thumbnail?: string; images?: string[] } }).product_id
                  const storeUrl = storeProductUrl(product?.slug)
                  const productName = product?.title || (item as { product_name?: string }).product_name || '-'
                  const quantity = Number((item as { quantity?: number }).quantity || 0)
                  const unitPrice = Number((item as { single_price?: number; selling_price?: number; price?: number }).single_price
                    || (item as { single_price?: number; selling_price?: number; price?: number }).selling_price
                    || (item as { single_price?: number; selling_price?: number; price?: number }).price
                    || 0)
                  const rowTotal = Number((item as { total?: number; total_amount?: number }).total
                    || (item as { total?: number; total_amount?: number }).total_amount
                    || quantity * unitPrice)
                  const variantSku = (item as { variant_sku?: string }).variant_sku
                  const selectedColor = (item as { selected_color?: string }).selected_color
                  const selectedSize = (item as { selected_size?: string }).selected_size
                  const previewImage = product?.thumbnail || product?.images?.[0]
                  const cancellation = (item as { cancellation?: { request_id?: string; status?: string; refund_status?: string; full_order?: boolean } | null }).cancellation
                  const bundleItems = Array.isArray((item as { bundle_items?: BundleOrderItem[] }).bundle_items)
                    ? (item as { bundle_items?: BundleOrderItem[] }).bundle_items || []
                    : []
                  const freeQuantity = Number((item as { bogo_free_quantity?: number }).bogo_free_quantity || 0)
                  const freeLabel = freeQuantity > 0
                    ? freeQuantity >= quantity
                      ? 'Free'
                      : `${freeQuantity} free`
                    : ''
                  return (
                    <tr key={`${idx}-${productName}`}>
                      <td>
                        <div className="order-item-product">
                          {previewImage ? (
                            <img src={previewImage} alt={productName} className="order-item-product-image" />
                          ) : null}
                          <div>
                            <span className="order-item-product-title">{productName}</span>
                            <div className="order-item-product-title-row">
                              {freeLabel ? <span className="order-item-free-chip">{freeLabel}</span> : null}
                              {bundleItems.length > 0 ? <span className="order-item-bundle-chip">Bundle</span> : null}
                              {cancellation ? (
                                <button
                                  type="button"
                                  className={`order-item-status-chip order-item-status-${getCancellationTone(cancellation.status)}`}
                                  onClick={() =>
                                    cancellation.request_id
                                      ? navigate(`/order-cancellations/${cancellation.request_id}`)
                                      : undefined
                                  }
                                  title={cancellation.full_order ? 'Full order cancellation' : 'Item cancelled'}
                                >
                                  Cancellation: {toTitleCase(cancellation.status)}
                                  {cancellation.refund_status ? ` (${toTitleCase(cancellation.refund_status)})` : ''}
                                </button>
                              ) : null}
                            </div>
                            {storeUrl ? (
                              <a
                                href={storeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="order-item-product-link"
                              >
                                View product
                              </a>
                            ) : null}
                            {bundleItems.length > 0 ? (
                              <div className="order-bundle-items">
                                <div className="order-bundle-items__label">In this bundle</div>
                                <ul>
                                  {bundleItems.map((child, childIndex) => (
                                    <li key={`${child.product_id || child.title || 'item'}-${childIndex}`}>
                                      {child.thumbnail ? (
                                        <img src={child.thumbnail} alt="" />
                                      ) : (
                                        <span className="order-bundle-items__thumb" />
                                      )}
                                      <span>
                                        {child.title || 'Product'}
                                        {child.variant ? ` · ${child.variant}` : ''}
                                        {child.sku ? ` · ${child.sku}` : ''}
                                      </span>
                                      <span className="order-bundle-items__qty">× {child.quantity || 1}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>{variantSku || '-'}</td>
                      <td>{[selectedColor, selectedSize].filter(Boolean).join(' / ') || '-'}</td>
                      <td>{quantity}</td>
                      <td>{formatMoney(currency, unitPrice)}</td>
                      <td>
                        {formatMoney(currency, rowTotal)}
                        {freeLabel ? <span className="order-item-free-note">{freeLabel}</span> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <OrderTotals order={order} currency={currency} />
      </div>

      <div className="order-details-info-grid">
        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <UserRound size={16} />
              Customer Details
            </h3>
          </div>
          <div className="order-info-card-body">
            <div className="order-field">
              <span className="order-field-label">Name</span>
              <span className="order-field-value">{order?.customer?.name || '-'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Email</span>
              <span className="order-field-value">{order?.customer?.email || '-'}</span>
            </div>
            <div className="order-field">
              <span className="order-field-label">Phone</span>
              <span className="order-field-value">
                {order?.customer?.phone_number
                  ? `+${order.customer.phone_number.slice(0, 2)} ${order.customer.phone_number.slice(2)}`
                  : '-'}
              </span>
            </div>
          </div>
          <div className="customer-history">
            <p className="customer-history__title">All orders from this customer</p>
            <div>
              <div className="customer-history__label">Orders placed</div>
              <div className="customer-history__value">{order?.customer_history?.total_orders ?? 0}</div>
            </div>
            <div>
              <div className="customer-history__label">Amount spent</div>
              <div className="customer-history__value">
                {formatMoney(currency, Number(order?.customer_history?.total_revenue || 0))}
              </div>
            </div>
            <div>
              <div className="customer-history__label">Average per order</div>
              <div className="customer-history__value">
                {formatMoney(currency, Number(order?.customer_history?.average_order_value || 0))}
              </div>
            </div>
          </div>
        </div>

        <div className="card order-info-card">
          <div className="order-info-card-header">
            <h3>
              <MapPin size={16} />
              Shipping Address
            </h3>
          </div>
          {shippingAddress ? (
            <AddressFields address={shippingAddress} />
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
              <Truck size={16} />
              Update Order Status
            </h3>
          </div>
          {statusLocked ? (
            <p className="order-locked-note">{statusLockMessage}</p>
          ) : canEdit ? (
          <form onSubmit={updateStatus} className="order-update-form">
            <div className="form-row">
              <label className="order-update-field">
                <span>Order status</span>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} required>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="order-update-field">
                <span>Payment status</span>
                <select
                  className="select"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="">Leave unchanged</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </label>
            </div>
            <label className="order-update-field">
              <span>Status message</span>
              <textarea
                className="textarea"
                rows={3}
                placeholder="Optional note sent with the status update"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <label className="order-update-field">
              <span>Send order email</span>
              <select className="select" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)}>
                <option value="">Choose an email to send...</option>
                <option value="new_order">New order</option>
                <option value="processing_order">Processing order</option>
                <option value="completed_order">Completed order</option>
                <option value="order_details">Order details</option>
              </select>
            </label>
            <div className="order-update-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save order and send mail'}
              </button>
            </div>
          </form>
          ) : null}
        </div>

        <div className="order-details-side-stack">
        <OrderAttribution order={order} />
        <div className="card order-timeline-card">
          <div className="order-info-card-header">
            <h3>
              <Clock size={16} />
              Order Timeline
            </h3>
          </div>
          {!timeline.length ? (
            <div className="order-info-card-body">
              <span style={{ color: 'var(--text-dim)' }}>No timeline data</span>
            </div>
          ) : (
            <div className="order-timeline-list">
              {timeline.map((entry, idx) => (
                <div key={`${idx}-${String((entry as { status?: string }).status || '')}`} className={`order-timeline-item order-timeline-item--${timelineTone((entry as { status?: string }).status)}`}>
                  <span className="order-timeline-dot" />
                  <div>
                    <div className="order-timeline-status">{toTitleCase((entry as { status?: string }).status || '-')}</div>
                    <div className="order-timeline-date">{formatDate((entry as { createdAt?: string }).createdAt)}</div>
                    {(entry as { message?: string }).message ? (
                      <div className="order-timeline-message">{(entry as { message?: string }).message}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

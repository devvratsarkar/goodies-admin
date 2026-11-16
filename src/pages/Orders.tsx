import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GridColDef, GridSortModel } from '@mui/x-data-grid'
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Package,
  Pause,
  Printer,
  Search,
  type LucideIcon,
} from 'lucide-react'
import Tooltip from '@mui/material/Tooltip'
import moment from 'moment'
import Select, { type StylesConfig } from 'react-select'
import AsyncSelect from 'react-select/async'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ordersApi } from '../api/endpoints'
import type { OrderCustomerOption, OrderListItem } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { countrySelectStyles } from '../utils/countrySelectStyles'
import { getDateFilterError, todayIso } from './dashboard/components/dashboardSeries'
import { isoDateParam } from '../utils/dateQuery'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { useModuleCan } from '../components/rbac/useModuleCan'

type OrdersResult = {
  orders: OrderListItem[]
  pagination: { totalItems: number; currentPage: number; itemsPerPage: number }
  statusCounts: Record<string, number>
}

function extractOrders(payload: unknown): OrdersResult {
  const fallback: OrdersResult = {
    orders: [],
    pagination: { totalItems: 0, currentPage: 1, itemsPerPage: 50 },
    statusCounts: {},
  }
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as {
    orders?: unknown
    pagination?: { totalItems?: number; currentPage?: number; itemsPerPage?: number }
    status_counts?: Record<string, number>
  }
  return {
    orders: Array.isArray(data.orders) ? (data.orders as OrderListItem[]) : [],
    pagination: {
      totalItems: Number(data.pagination?.totalItems ?? 0),
      currentPage: Number(data.pagination?.currentPage ?? 1),
      itemsPerPage: Number(data.pagination?.itemsPerPage ?? 50),
    },
    statusCounts: data.status_counts && typeof data.status_counts === 'object' ? data.status_counts : {},
  }
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

const formatTimeAgo = (value?: string) => {
  if (!value) return ''
  const date = moment(value)
  return date.isValid() ? date.fromNow() : ''
}

const getOrderDisplayCode = (row: OrderListItem) =>
  row.order_code || (row.order_number != null ? `#${row.order_number}` : '')

function CopyOrderEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className="order-mail">
      <button
        type="button"
        className="order-mail__copy"
        onClick={(event) => {
          event.stopPropagation()
          void copy()
        }}
        aria-label={copied ? 'Email copied' : 'Copy email'}
        title={copied ? 'Copied' : 'Copy email'}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <span className="order-mail__text">{email}</span>
    </span>
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

const normalizeStatus = (value?: string | null) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')

const TERMINAL_ORDER_STATUSES = new Set([
  'delivered',
  'completed',
  'returned',
  'cancelled',
  'canceled',
  'refunded',
  'initiating_refund',
  'refund_initiated',
])

const orderStatusClass = (value?: string | null) => {
  const key = normalizeStatus(value).replace(/-/g, '_')
  if (['completed', 'delivered'].includes(key)) return 'order-status order-status--success'
  if (['processing', 'shipped', 'packed'].includes(key)) return 'order-status order-status--info'
  if (['pending', 'on_hold'].includes(key)) return 'order-status order-status--warning'
  if (['cancelled', 'canceled', 'failed', 'returned', 'tamara_p_canceled', 'tamara_p_failed'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

const paymentStatusClass = (value?: string | null) => {
  const key = normalizeStatus(value).replace(/-/g, '_')
  if (key === 'paid') return 'order-status order-status--success'
  if (key === 'pending') return 'order-status order-status--warning'
  if (key === 'refund_pending') return 'order-status order-status--info'
  if (key === 'refunded') return 'order-status order-status--refunded'
  if (['failed', 'cancelled', 'canceled'].includes(key)) return 'order-status order-status--danger'
  return 'order-status order-status--neutral'
}

function ActionTip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Tooltip title={title} arrow placement="top" enterDelay={250}>
      <span className="table-action-tip">{children}</span>
    </Tooltip>
  )
}

type BulkActionOption = {
  value: 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'csv' | 'invoice' | 'packing-slip' | 'slip'
  label: string
  icon: LucideIcon
}

const BULK_ACTIONS: BulkActionOption[] = [
  { value: 'processing', label: 'Change status to processing', icon: LoaderCircle },
  { value: 'on-hold', label: 'Change status to on-hold', icon: Pause },
  { value: 'completed', label: 'Change status to completed', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Change status to cancelled', icon: Ban },
  { value: 'csv', label: 'Export as CSV', icon: FileSpreadsheet },
  { value: 'invoice', label: 'PDF Invoice', icon: FileText },
  { value: 'packing-slip', label: 'PDF Packing Slip', icon: Package },
  { value: 'slip', label: 'Print 80mm slip', icon: Printer },
]

type BulkAction = BulkActionOption['value'] | ''

const STATUS_BULK_ACTIONS = new Set<BulkAction>(['processing', 'on-hold', 'completed', 'cancelled'])

function PageSelectBox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="order-select"
      checked={checked}
      disabled={disabled}
      aria-label="Select all orders on this page"
      onClick={(event) => event.stopPropagation()}
      onChange={onChange}
    />
  )
}

async function blobErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // The response was not JSON.
    }
  }
  return getApiErrorMessage(err, fallback)
}

function saveBlob(data: BlobPart, fileName: string, type: string) {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

type StatusOption = { value: string; label: string }
const ALL_STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'paid_pending', label: 'Paid Orders Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'processing', label: 'Processing' },
  { value: 'tamara_p_canceled', label: 'Tamara Payment Cancelled' },
  { value: 'tamara_p_failed', label: 'Tamara Payment Failed' },
]

type AppliedFilters = { status: string; fromDate: string; toDate: string }
const EMPTY_FILTERS: AppliedFilters = { status: 'all', fromDate: '', toDate: '' }
const DEFAULT_ORDER_SORT: GridSortModel = [{ field: 'createdAt', sort: 'desc' }]

type CustomerOption = { value: string; label: string }

function extractCustomerOptions(payload: unknown): CustomerOption[] {
  const root = (payload && typeof payload === 'object' ? payload : {}) as { data?: unknown; customers?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as { customers?: unknown }
  if (!Array.isArray(data.customers)) return []
  return (data.customers as OrderCustomerOption[]).map((customer) => {
    const name = customer.name || 'Unnamed customer'
    const contact = customer.email || customer.phone_number
    return { value: customer._id, label: contact ? `${name} (${contact})` : name }
  })
}

export function Orders() {
  const navigate = useNavigate()
  const { canEdit, canExport } = useModuleCan('orders')
  const [searchParams, setSearchParams] = useSearchParams()
  const customerId = searchParams.get('customerId') || ''
  const statusParam = searchParams.get('status') || ''
  const initialStatus = ALL_STATUS_OPTIONS.some((option) => option.value === statusParam) ? statusParam : 'all'
  const initialFromDate = isoDateParam(searchParams.get('fromDate'))
  const initialToDate = isoDateParam(searchParams.get('toDate'))
  const [rows, setRows] = useState<OrderListItem[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusInput, setStatusInput] = useState(initialStatus)
  const [fromDateInput, setFromDateInput] = useState(initialFromDate)
  const [toDateInput, setToDateInput] = useState(initialToDate)
  const [customerInput, setCustomerInput] = useState<CustomerOption | null>(null)
  const [appliedCustomer, setAppliedCustomer] = useState<CustomerOption | null>(null)
  const customerSearchTimer = useRef<number | undefined>(undefined)
  const pendingCustomerSearch = useRef<((options: CustomerOption[]) => void) | null>(null)
  const [applied, setApplied] = useState<AppliedFilters>({
    status: initialStatus,
    fromDate: initialFromDate,
    toDate: initialToDate,
  })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)
  const [sortModel, setSortModel] = useState<GridSortModel>(DEFAULT_ORDER_SORT)
  const sortModelRef = useRef(sortModel)
  sortModelRef.current = sortModel
  const [downloadingKey, setDownloadingKey] = useState('')
  const [updatingStatusKey, setUpdatingStatusKey] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<BulkAction>('')
  const [bulkWorking, setBulkWorking] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = (
    targetPageIndex = pageIndex,
    targetPageSize = pageSize,
    filters = applied,
    sort = sortModelRef.current,
  ) => {
    setLoading(true)
    setError('')
    const query = debouncedSearch.trim()
    const activeSort = sort[0]
    ordersApi
      .getAll({
        status: filters.status !== 'all' ? filters.status : undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        search: query || undefined,
        customerId: customerId || undefined,
        page: targetPageIndex + 1,
        limit: targetPageSize,
        sortBy: activeSort?.field,
        sortOrder: activeSort?.sort || undefined,
      })
      .then((res) => {
        const parsed = extractOrders(res.data)
        setRows(parsed.orders)
        setStatusCounts(parsed.statusCounts)
        setTotalCount(parsed.pagination.totalItems)
        setPageIndex(Math.max((parsed.pagination.currentPage || 1) - 1, 0))
        setPageSize(parsed.pagination.itemsPerPage || targetPageSize)
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => {
        setLoading(false)
        setInitialLoading(false)
      })
  }

  useEffect(() => {
    setPageIndex(0)
    load(0, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, customerId])

  useEffect(() => {
    if (!customerId) {
      setAppliedCustomer(null)
      setCustomerInput(null)
      return
    }
    if (appliedCustomer?.value === customerId) return
    let cancelled = false
    ordersApi
      .searchCustomers({ id: customerId })
      .then((res) => {
        if (cancelled) return
        const option = extractCustomerOptions(res.data)[0] || { value: customerId, label: 'Selected customer' }
        setAppliedCustomer(option)
        setCustomerInput(option)
      })
      .catch(() => {
        if (cancelled) return
        const option = { value: customerId, label: 'Selected customer' }
        setAppliedCustomer(option)
        setCustomerInput(option)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(
    () => () => {
      window.clearTimeout(customerSearchTimer.current)
      pendingCustomerSearch.current?.([])
    },
    [],
  )

  const loadCustomerOptions = (input: string) =>
    new Promise<CustomerOption[]>((resolve) => {
      window.clearTimeout(customerSearchTimer.current)
      pendingCustomerSearch.current?.([])
      pendingCustomerSearch.current = resolve
      const term = input.trim()
      if (term.length < 2) {
        resolve([])
        return
      }
      customerSearchTimer.current = window.setTimeout(() => {
        ordersApi
          .searchCustomers({ search: term })
          .then((res) => resolve(extractCustomerOptions(res.data)))
          .catch(() => resolve([]))
      }, 300)
    })

  const setCustomerParam = (option: CustomerOption | null) => {
    const next = new URLSearchParams(searchParams)
    if (option) next.set('customerId', option.value)
    else next.delete('customerId')
    setAppliedCustomer(option)
    setCustomerInput(option)
    setSearchParams(next)
  }

  const today = todayIso()
  const dateError = getDateFilterError(fromDateInput, toDateInput)
  const toIsBound = Boolean(toDateInput) && !getDateFilterError('', toDateInput)
  const fromIsBound = Boolean(fromDateInput) && !getDateFilterError(fromDateInput, '')
  const fromMax = toIsBound ? toDateInput : today
  const toMin = fromIsBound ? fromDateInput : undefined

  const applyFilters = () => {
    if (dateError) return
    const next = { status: statusInput, fromDate: fromDateInput, toDate: toDateInput }
    setApplied(next)
    setPageIndex(0)
    const params = new URLSearchParams(searchParams)
    if (next.status !== 'all') params.set('status', next.status)
    else params.delete('status')
    if (next.fromDate) params.set('fromDate', next.fromDate)
    else params.delete('fromDate')
    if (next.toDate) params.set('toDate', next.toDate)
    else params.delete('toDate')
    const nextCustomer = customerInput?.value || ''
    if (nextCustomer !== customerId) {
      if (nextCustomer) params.set('customerId', nextCustomer)
      else params.delete('customerId')
      setAppliedCustomer(customerInput)
      setCustomerInput(customerInput)
      setSearchParams(params)
      return
    }
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true })
    }
    load(0, pageSize, next)
  }

  const clearFilters = () => {
    setStatusInput('all')
    setFromDateInput('')
    setToDateInput('')
    setCustomerInput(null)
    setApplied(EMPTY_FILTERS)
    setPageIndex(0)
    const params = new URLSearchParams(searchParams)
    params.delete('status')
    params.delete('fromDate')
    params.delete('toDate')
    if (customerId) {
      params.delete('customerId')
      setAppliedCustomer(null)
      setSearchParams(params)
      return
    }
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true })
    load(0, pageSize, EMPTY_FILTERS)
  }

  const hasActiveFilters =
    applied.status !== 'all' || Boolean(applied.fromDate) || Boolean(applied.toDate) ||
    statusInput !== 'all' || Boolean(fromDateInput) || Boolean(toDateInput) ||
    Boolean(customerId) || Boolean(customerInput)

  const statusOptions = useMemo(
    () =>
      ALL_STATUS_OPTIONS.map((option) => ({
        ...option,
        label: `${option.label} (${(statusCounts[option.value] ?? 0).toLocaleString()})`,
      })),
    [statusCounts],
  )

  const downloadPdf = async (
    order: OrderListItem,
    kind: 'invoice' | 'packing-slip',
  ) => {
    const id = order._id
    if (!canExport || !id) return
    const key = `${id}-${kind}`
    setDownloadingKey(key)
    setError('')
    try {
      const res =
        kind === 'invoice' ? await ordersApi.downloadInvoice(id) : await ordersApi.downloadPackingSlip(id)
      const contentType = String(res.headers['content-type'] || '')
      if (!contentType.includes('pdf')) {
        setError(kind === 'invoice' ? 'Failed to download invoice' : 'Failed to download packing slip')
        return
      }
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const label = order.order_code || order.order_number || id
      link.href = url
      link.download = `${kind}-${label}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(kind === 'invoice' ? 'Failed to download invoice' : 'Failed to download packing slip')
    } finally {
      setDownloadingKey('')
    }
  }

  const printOrderSlip = async (order: OrderListItem) => {
    const id = order._id
    if (!canExport || !id) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('Allow pop-ups to print the 80mm slip')
      return
    }
    setDownloadingKey(`${id}-slip`)
    setError('')
    try {
      const res = await ordersApi.downloadOrderSlip(id)
      const contentType = String(res.headers['content-type'] || '')
      if (!contentType.includes('pdf')) {
        printWindow.close()
        setError('Failed to print 80mm slip')
        return
      }
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      printWindow.location.replace(url)
      window.setTimeout(() => {
        if (printWindow.closed) return
        try {
          printWindow.focus()
          printWindow.print()
        } catch {
          // The slip stays open so it can still be printed from the browser.
        }
      }, 800)
      window.setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch {
      printWindow.close()
      setError('Failed to print 80mm slip')
    } finally {
      setDownloadingKey('')
    }
  }

  const updateOrderStatus = async (order: OrderListItem, status: 'processing' | 'completed') => {
    if (!canEdit) return
    const id = order._id
    if (!id) return
    const current = normalizeStatus(order.status)
    const label = status === 'processing' ? 'Processing' : 'Completed'
    if (current === status) {
      setError(`Order is already ${label.toLowerCase()}`)
      return
    }
    if (TERMINAL_ORDER_STATUSES.has(current)) {
      setError(`Order status cannot be changed because it is already "${toTitleCase(order.status)}"`)
      return
    }
    const confirmed = await adminConfirm(`Mark this order as ${label}?`, {
      title: `Set status to ${label}`,
      confirmText: `Mark ${label}`,
    })
    if (!confirmed) return

    const key = `${id}-${status}`
    setUpdatingStatusKey(key)
    setError('')
    setSuccess('')
    try {
      await ordersApi.updateStatus(id, {
        status,
        message: `Order status updated to ${status}`,
      })
      setSuccess(`Order marked as ${label.toLowerCase()}`)
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update status'))
    } finally {
      setUpdatingStatusKey('')
    }
  }

  const pageIds = rows.map((row) => row._id).filter(Boolean)
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id))
  const somePageSelected = pageIds.some((id) => selectedSet.has(id))

  const toggleRow = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const togglePage = () => {
    setSelectedIds((current) => {
      if (pageIds.every((id) => current.includes(id))) return current.filter((id) => !pageIds.includes(id))
      return [...new Set([...current, ...pageIds])]
    })
  }

  const applyBulk = async () => {
    if (!bulkAction) {
      setError('Choose a bulk action')
      return
    }
    if (!selectedIds.length) {
      setError('Select at least one order')
      return
    }
    const isStatusAction = STATUS_BULK_ACTIONS.has(bulkAction)
    if (isStatusAction && !canEdit) return
    if (!isStatusAction && !canExport) return
    if (selectedIds.length > 50) {
      setError('Select up to 50 orders at a time')
      return
    }
    const actionLabel = BULK_ACTIONS.find((item) => item.value === bulkAction)?.label || 'This action'
    if (STATUS_BULK_ACTIONS.has(bulkAction)) {
      const confirmed = await adminConfirm(
        `${actionLabel} for ${selectedIds.length} order${selectedIds.length === 1 ? '' : 's'}?`,
      )
      if (!confirmed) return
    }

    const printWindow = bulkAction === 'slip' ? window.open('', '_blank') : null
    if (bulkAction === 'slip' && !printWindow) {
      setError('Allow pop-ups to print the 80mm slip')
      return
    }

    setBulkWorking(true)
    setError('')
    setSuccess('')
    try {
      if (STATUS_BULK_ACTIONS.has(bulkAction)) {
        const res = await ordersApi.bulkUpdateStatus(selectedIds, bulkAction)
        setSuccess(res.data?.message || 'Orders updated')
        setSelectedIds([])
        setBulkAction('')
        load()
        return
      }

      const res =
        bulkAction === 'csv'
          ? await ordersApi.bulkExportCsv(selectedIds)
          : bulkAction === 'invoice'
            ? await ordersApi.bulkInvoices(selectedIds)
            : bulkAction === 'slip'
              ? await ordersApi.bulkOrderSlips(selectedIds)
              : await ordersApi.bulkPackingSlips(selectedIds)
      const contentType = String(res.headers['content-type'] || '')
      const isCsv = bulkAction === 'csv'
      if (isCsv && !contentType.includes('csv') && !contentType.includes('text')) {
        setError('Failed to export CSV')
        return
      }
      if (!isCsv && !contentType.includes('pdf')) {
        printWindow?.close()
        setError(
          bulkAction === 'invoice'
            ? 'Failed to download invoices'
            : bulkAction === 'slip'
              ? 'Failed to print 80mm slips'
              : 'Failed to download packing slips',
        )
        return
      }
      if (bulkAction === 'slip' && printWindow) {
        const blob = new Blob([res.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        printWindow.location.replace(url)
        window.setTimeout(() => {
          if (printWindow.closed) return
          try {
            printWindow.focus()
            printWindow.print()
          } catch {
            // The slips stay open so they can still be printed from the browser.
          }
        }, 800)
        window.setTimeout(() => URL.revokeObjectURL(url), 120000)
        setSuccess(`Opened 80mm slips for ${selectedIds.length} orders`)
        return
      }
      const stamp = new Date().toISOString().slice(0, 10)
      const fileName = isCsv
        ? `orders-${stamp}.csv`
        : bulkAction === 'invoice'
          ? `invoices-${stamp}.pdf`
          : `packing-slips-${stamp}.pdf`
      saveBlob(res.data, fileName, contentType || (isCsv ? 'text/csv' : 'application/pdf'))
      setSuccess(
        isCsv
          ? `Exported ${selectedIds.length} orders`
          : bulkAction === 'invoice'
            ? `Downloaded invoices for ${selectedIds.length} orders`
            : `Downloaded packing slips for ${selectedIds.length} orders`,
      )
    } catch (err) {
      printWindow?.close()
      setError(await blobErrorMessage(err, 'Bulk action failed'))
    } finally {
      setBulkWorking(false)
    }
  }

  const columns: GridColDef<OrderListItem>[] = useMemo(
    () => [
      ...(canEdit || canExport ? [{
        field: 'select',
        headerName: '',
        width: 44,
        minWidth: 44,
        maxWidth: 44,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderHeader: () => (
          <PageSelectBox
            checked={allPageSelected}
            indeterminate={!allPageSelected && somePageSelected}
            disabled={bulkWorking || pageIds.length === 0}
            onChange={togglePage}
          />
        ),
        renderCell: ({ row }: { row: OrderListItem }) => (
          <input
            type="checkbox"
            className="order-select"
            checked={selectedSet.has(row._id)}
            disabled={bulkWorking}
            aria-label={`Select order ${getOrderDisplayCode(row) || row._id}`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleRow(row._id)}
          />
        ),
      }] : []),
      {
        field: 'actions',
        headerName: 'Actions',
        width: 186,
        minWidth: 186,
        maxWidth: 186,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        cellClassName: 'products-actions-cell',
        renderCell: ({ row }) => {
          const order = row
          const invoiceBusy = downloadingKey === `${order._id}-invoice`
          const slipBusy = downloadingKey === `${order._id}-packing-slip`
          const printBusy = downloadingKey === `${order._id}-slip`
          const currentStatus = normalizeStatus(order.status)
          const busy = Boolean(downloadingKey || updatingStatusKey)
          const statusLocked = TERMINAL_ORDER_STATUSES.has(currentStatus)
          const showProcessing = !statusLocked && currentStatus !== 'processing'
          const showCompleted = !statusLocked
          return (
            <div className="table-actions orders-actions">
              <ActionTip title="View order">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => navigate(`/orders/${order._id}`)}
                  aria-label="View order"
                >
                  <Eye size={16} />
                </button>
              </ActionTip>
              {canExport && (
              <ActionTip title="Download invoice">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => downloadPdf(order, 'invoice')}
                  disabled={busy}
                  aria-label="Download invoice"
                >
                  {invoiceBusy ? <Download size={16} /> : <FileText size={16} />}
                </button>
              </ActionTip>
              )}
              {canExport && (
              <ActionTip title="Download packing slip">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => downloadPdf(order, 'packing-slip')}
                  disabled={busy}
                  aria-label="Download packing slip"
                >
                  {slipBusy ? <Download size={16} /> : <Package size={16} />}
                </button>
              </ActionTip>
              )}
              {canExport && (
              <ActionTip title="Print 80mm slip">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => printOrderSlip(order)}
                  disabled={busy}
                  aria-label="Print 80mm slip"
                >
                  {printBusy ? <Download size={16} /> : <Printer size={16} />}
                </button>
              </ActionTip>
              )}
              {canEdit && showProcessing && (
                <ActionTip title="Mark as processing">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => updateOrderStatus(order, 'processing')}
                    disabled={busy}
                    aria-label="Mark as processing"
                  >
                    <LoaderCircle size={16} />
                  </button>
                </ActionTip>
              )}
              {canEdit && showCompleted && (
                <ActionTip title="Mark as completed">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => updateOrderStatus(order, 'completed')}
                    disabled={busy}
                    aria-label="Mark as completed"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                </ActionTip>
              )}
            </div>
          )
        },
      },
      // {
      //   header: 'Items',
      //   accessorKey: 'preview_images',
      //   cell: ({ row }) => {
      //     const imgs = row.original.preview_images ?? []
      //     if (!imgs.length) return <span style={{ color: 'var(--text-dim)' }}>No image</span>
      //     return (
      //       <div style={{ display: 'flex', gap: 6 }}>
      //         {imgs.slice(0, 3).map((img, i) => (
      //           <img
      //             key={`${img}-${i}`}
      //             src={img}
      //             alt={`order-preview-${i}`}
      //             style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }}
      //           />
      //         ))}
      //       </div>
      //     )
      //   },
      // },
      {
        field: 'order',
        headerName: 'Order ID',
        flex: 0.7,
        minWidth: 92,
        valueGetter: (_, row) => getOrderDisplayCode(row),
        renderCell: ({ row, value }) => {
          const label = String(value || '-')
          const id = row._id
          if (!id || label === '-') return label
          return (
            <Link to={`/orders/${id}`} className="product-cell__title product-cell__link">
              {label}
            </Link>
          )
        },
      },
      {
        field: 'customer',
        headerName: 'Customer',
        flex: 1.4,
        minWidth: 120,
        valueGetter: (_, row) => [row.customer?.name, row.customer?.email].filter(Boolean).join(' '),
        renderCell: ({ row }) => {
          const customer = row.customer
          const name = customer?.name || '—'
          const email = customer?.email
          const customerIdValue = customer?._id || ''
          return (
            <div className="product-cell__text" title={email ? `${name}\n${email}` : name}>
              {customerIdValue ? (
                <button
                  type="button"
                  className="product-cell__title product-cell__link"
                  onClick={() =>
                    setCustomerParam({
                      value: customerIdValue,
                      label: email ? `${name} (${email})` : name,
                    })
                  }
                >
                  <span>{name}</span>
                </button>
              ) : (
                <span className="product-cell__title">{name}</span>
              )}
              {email ? <CopyOrderEmail email={email} /> : null}
            </div>
          )
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        flex: 0.85,
        minWidth: 118,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => {
          const value = row.status
          if (!value) return '—'
          return (
            <span className={orderStatusClass(value)}>
              <span className="order-status__dot" aria-hidden="true" />
              {toTitleCase(value)}
            </span>
          )
        },
      },
      {
        field: 'item_count',
        headerName: 'Items',
        flex: 0.4,
        minWidth: 72,
        renderCell: ({ row }) => row.item_count ?? 0,
      },
      {
        field: 'total_amount',
        headerName: 'Total',
        flex: 0.6,
        minWidth: 96,
        renderCell: ({ row }) => `AED ${Number(row.aed_total || 0).toFixed(2)}`,
      },
      {
        field: 'createdAt',
        headerName: 'Date',
        flex: 0.85,
        minWidth: 118,
        renderCell: ({ row }) => {
          const date = row.createdAt && moment(row.createdAt).isValid()
            ? moment(row.createdAt).format('D MMM, h:mm A')
            : formatDate(row.createdAt)
          const ago = formatTimeAgo(row.createdAt)
          if (date === '-') return '-'
          return (
            <div className="product-cell__text" title={formatDate(row.createdAt)}>
              <span className="product-cell__title">{date}</span>
              {ago ? <span className="product-cell__meta">{ago}</span> : null}
            </div>
          )
        },
      },
      {
        field: 'payment_status',
        headerName: 'Payment',
        flex: 1,
        minWidth: 200,
        width: 200,
        align: 'center',
        headerAlign: 'center',
        renderCell: ({ row }) => {
          const value = row.payment_status
          if (!value) return '—'
          return (
            <span className={paymentStatusClass(value)}>
              <span className="order-status__dot" aria-hidden="true" />
              {toTitleCase(value)}
            </span>
          )
        },
      },
      {
        field: 'origin',
        headerName: 'Origin',
        flex: 0.9,
        minWidth: 156,
        renderCell: ({ row }) => {
          const label = toTitleCase(row.origin)
          if (label === '-') return label
          return (
            <span className="orders-origin" title={label}>
              {label}
            </span>
          )
        },
      },

   
    ],
    [canEdit, canExport, navigate, downloadingKey, updatingStatusKey, selectedSet, allPageSelected, somePageSelected, pageIds, bulkWorking, setCustomerParam],
  )

  if (initialLoading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">View customer orders and order status.</p>
        </div>
      </div>

      {customerId && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>
            Showing orders for <strong>{appliedCustomer?.label || 'the selected customer'}</strong>.
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setCustomerInput(null)
              setCustomerParam(null)
            }}
          >
            Clear
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="orders-table-filters">
          <div className="orders-table-filters__status">
            <Select
              options={statusOptions}
              value={statusOptions.find((s) => s.value === statusInput) || null}
              onChange={(selected) => setStatusInput((selected as StatusOption | null)?.value || 'all')}
              placeholder="Filter status..."
              isSearchable
              menuPortalTarget={document.body}
              menuPosition="fixed"
              maxMenuHeight={260}
              styles={countrySelectStyles as never}
            />
          </div>
          <div className="orders-table-filters__customer">
            <AsyncSelect<CustomerOption>
              cacheOptions
              isClearable
              loadOptions={loadCustomerOptions}
              value={customerInput}
              onChange={(selected) => setCustomerInput(selected)}
              placeholder="Search customer by name, email"
              aria-label="Customer filter"
              noOptionsMessage={({ inputValue }) =>
                inputValue.trim().length < 2 ? 'Type at least 2 characters' : 'No customers found'
              }
              loadingMessage={() => 'Searching customers...'}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              maxMenuHeight={260}
              styles={{
                ...(countrySelectStyles as object),
                valueContainer: (base) => ({
                  ...base,
                  flexWrap: 'nowrap',
                }),
                placeholder: (base, state) => ({
                  ...(countrySelectStyles.placeholder?.(base, state as never) ?? base),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }),
                singleValue: (base, state) => ({
                  ...(countrySelectStyles.singleValue?.(base, state as never) ?? base),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }),
              }}
            />
          </div>
          <div className="orders-table-filters__dates">
            <label className="orders-table-filters__date">
              <span>From</span>
              <input
                type="date"
                className={`input${dateError?.from ? ' is-invalid' : ''}`}
                aria-label="From date"
                aria-invalid={dateError?.from || undefined}
                value={fromDateInput}
                max={fromMax}
                onChange={(event) => setFromDateInput(event.target.value)}
              />
            </label>
            <span className="orders-table-filters__dates-sep" aria-hidden="true" />
            <label className="orders-table-filters__date">
              <span>To</span>
              <input
                type="date"
                className={`input${dateError?.to ? ' is-invalid' : ''}`}
                aria-label="To date"
                aria-invalid={dateError?.to || undefined}
                value={toDateInput}
                min={toMin}
                max={today}
                onChange={(event) => setToDateInput(event.target.value)}
              />
            </label>
          </div>
          <div className="orders-table-filters__actions">
            <button type="button" className="btn btn-primary" onClick={applyFilters} disabled={loading || Boolean(dateError)}>
              Apply Filter
            </button>
            {hasActiveFilters && (
              <button type="button" className="btn btn-ghost" onClick={clearFilters} disabled={loading}>
                Clear
              </button>
            )}
          </div>
          {dateError ? (
            <p className="orders-date-alert" role="alert">
              <AlertCircle size={15} aria-hidden />
              <span>{dateError.message}</span>
            </p>
          ) : null}
        </div>
        <div className="table-toolbar">
          <div className="table-search">
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search order, customer, email, payment..."
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setPageIndex(0)
              }}
              style={{ paddingLeft: 40 }}
            />
          </div>
          {(canEdit || canExport) && (
          <div className="bulk-actions orders-table-bulk">
            <div className="orders-bulk-select">
              <Select<BulkActionOption, false>
                options={BULK_ACTIONS.filter((action) =>
                  STATUS_BULK_ACTIONS.has(action.value) ? canEdit : canExport,
                )}
                value={BULK_ACTIONS.find((action) => action.value === bulkAction) || null}
                onChange={(selected) => setBulkAction(selected?.value || '')}
                placeholder="Bulk actions"
                aria-label="Bulk actions"
                isDisabled={bulkWorking}
                isClearable
                isSearchable={false}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                maxMenuHeight={420}
                formatOptionLabel={(option) => {
                  const Icon = option.icon
                  return (
                    <span className={`orders-bulk-option orders-bulk-option--${option.value}`}>
                      <Icon size={16} />
                      <span>{option.label}</span>
                    </span>
                  )
                }}
                styles={{
                  ...(countrySelectStyles as unknown as StylesConfig<BulkActionOption, false>),
                  menu: (base) => ({
                    ...base,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow)',
                    width: 'max-content',
                    minWidth: '100%',
                  }),
                  option: (base, state) => ({
                    ...base,
                    background: state.isSelected
                      ? 'var(--accent-muted)'
                      : state.isFocused
                        ? 'var(--bg-hover)'
                        : 'var(--bg-card)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    padding: '8px 12px',
                  }),
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void applyBulk()}
              disabled={bulkWorking || !bulkAction || selectedIds.length === 0}
            >
              {bulkWorking ? 'Applying…' : 'Apply'}
            </button>
            {selectedIds.length > 0 && (
              <span className="bulk-actions__count">
                {selectedIds.length} selected
              </span>
            )}
          </div>
          )}
        </div>
        <div className="table-wrap orders-grid">
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
            pageSizeOptions={[50, 100, 200, 300, 400,500]}
            density="compact"
            sortingMode="server"
            sortModel={sortModel}
            sortingOrder={['asc', 'desc']}
            onSortModelChange={(model) => {
              const next = model[0]?.sort ? [model[0]] : DEFAULT_ORDER_SORT
              sortModelRef.current = next
              setSortModel(next)
              setPageIndex(0)
              load(0, pageSize, applied, next)
            }}
          />
        </div>
      </div>
    </>
  )
}

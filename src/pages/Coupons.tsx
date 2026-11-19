import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, History, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { couponsApi } from '../api/endpoints'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useScrollToNotice } from '../hooks/useScrollToNotice'
import { adminConfirm, confirmDeleteItem } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { isoDateParam } from '../utils/dateQuery'
import type { Coupon } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { useModuleCan } from '../components/rbac/useModuleCan'

type CreateFormState = {
  coupon_code: string
  description: string
  coupon_type: 'Percentage' | 'Fixed'
  value: number
  no_coupon: number
  start_date: string
  expiry_date: string
  minimum_cart_value: number
  status: boolean
  is_auto_apply: boolean
}

type UpdateFormState = {
  coupon_code: string
  description: string
  coupon_type: 'Percentage' | 'Fixed'
  value: number
  no_coupon: number
  start_date: string
  expiry_date: string
  minimum_cart_value: number
  status: boolean
  is_auto_apply: boolean
}

const initialCreateForm: CreateFormState = {
  coupon_code: '',
  description: '',
  coupon_type: 'Percentage',
  value: 0,
  no_coupon: 0,
  start_date: '',
  expiry_date: '',
  minimum_cart_value: 0,
  status: true,
  is_auto_apply: false,
}

type AmountErrors = {
  value?: string
  no_coupon?: string
  minimum_cart_value?: string
}

const AMOUNT_ERROR = 'Enter some amount'

function amountErrors(form: { value: number; no_coupon: number; minimum_cart_value: number }): AmountErrors {
  const errors: AmountErrors = {}
  if (!(Number(form.value) > 0)) errors.value = AMOUNT_ERROR
  if (!(Number(form.no_coupon) > 0)) errors.no_coupon = AMOUNT_ERROR
  if (!(Number(form.minimum_cart_value) > 0)) errors.minimum_cart_value = AMOUNT_ERROR
  return errors
}

const initialUpdateForm: UpdateFormState = {
  coupon_code: '',
  description: '',
  coupon_type: 'Percentage',
  value: 0,
  no_coupon: 0,
  start_date: '',
  expiry_date: '',
  minimum_cart_value: 0,
  status: true,
  is_auto_apply: false,
}

const formatAed = (value: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDate = (value?: string) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function parseCouponList(body: unknown): Coupon[] {
  const payload = body as
    | { data?: Coupon[] | { list?: Coupon[] } }
    | { coupons?: Coupon[] }
    | { list?: Coupon[] }
  if (Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: Coupon[] }).data
  const nested = (payload as { data?: { list?: Coupon[] } }).data
  if (nested && typeof nested === 'object' && Array.isArray(nested.list)) return nested.list
  if (Array.isArray((payload as { coupons?: Coupon[] }).coupons)) return (payload as { coupons: Coupon[] }).coupons
  if (Array.isArray((payload as { list?: Coupon[] }).list)) return (payload as { list: Coupon[] }).list
  return []
}

const dayStart = (value: string) => new Date(`${value}T00:00:00`).getTime()
const dayEnd = (value: string) => new Date(`${value}T23:59:59.999`).getTime()

const matchesStartDate = (value: string | undefined, from: string, to: string) => {
  if (!from && !to) return true
  if (!value) return false
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return false
  if (from && time < dayStart(from)) return false
  if (to && time > dayEnd(to)) return false
  return true
}

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const downloadCouponsCsv = (rows: Coupon[]) => {
  const headers = ['Code', 'Description', 'Auto apply', 'Type', 'Value', 'Min cart', 'No of coupons', 'Start', 'Expiry', 'No of uses', 'Status', 'Created at']
  const lines = rows.map((row) => {
    const type = String(row.coupon_type || '').toLowerCase() === 'flat' ? 'Fixed' : row.coupon_type || ''
    const value = row.coupon_type === 'Percentage' ? `${Number(row.value ?? 0)}%` : Number(row.value ?? 0)
    return [
      row.coupon_code,
      row.description || '',
      row.is_auto_apply ? 'Yes' : 'No',
      type,
      value,
      Number(row.minimum_cart_value ?? 0),
      Number(row.no_coupon ?? 0),
      formatDate(row.start_date),
      formatDate(row.expiry_date),
      Number(row.used_count ?? 0),
      row.status ? 'Active' : 'Inactive',
      formatDate(row.createdAt),
    ].map(csvCell).join(',')
  })
  const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'coupons.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function SelectAllCoupons({
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
      className="table-select"
      checked={checked}
      disabled={disabled}
      aria-label="Select all coupons"
      onChange={onChange}
    />
  )
}

type StatusFilter = 'all' | 'active' | 'inactive'
type TypeFilter = 'all' | 'Percentage' | 'Fixed'
type ViewFilter = 'all' | 'published' | 'auto_apply'
type BulkAction = '' | 'trash' | 'csv'

const nextCouponCode = (code: string, existing: string[]) => {
  const taken = new Set(existing.map((item) => item.trim().toUpperCase()).filter(Boolean))
  const base = `${(code || 'COUPON').trim().toUpperCase()}-COPY`
  if (!taken.has(base)) return base
  let count = 2
  while (taken.has(`${base}-${count}`)) count += 1
  return `${base}-${count}`
}

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const offsetMs = parsed.getTimezoneOffset() * 60_000
  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function Coupons({ trash = false }: { trash?: boolean }) {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete, canExport } = useModuleCan('coupons')
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<Coupon[]>([])
  const [catalog, setCatalog] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)
  const loadSeq = useRef(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [successTone, setSuccessTone] = useState<'success' | 'error'>('success')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm)
  const [updateForm, setUpdateForm] = useState<UpdateFormState>(initialUpdateForm)
  const [amountFieldErrors, setAmountFieldErrors] = useState<AmountErrors>({})
  const [formError, setFormError] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const formNotice =
    formError ||
    (amountFieldErrors.value || amountFieldErrors.no_coupon || amountFieldErrors.minimum_cart_value
      ? AMOUNT_ERROR
      : '')
  const formNoticeRef = useScrollToNotice(formNotice, noticeRevision)
  const [togglingId, setTogglingId] = useState('')
  const [restoringId, setRestoringId] = useState('')
  const discountFrom = isoDateParam(searchParams.get('fromDate'))
  const discountTo = isoDateParam(searchParams.get('toDate'))
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<BulkAction>('')
  const [bulkWorking, setBulkWorking] = useState(false)

  const showSuccess = (message: string, tone: 'success' | 'error' = 'success') => {
    setSuccessTone(tone)
    setSuccess(message)
  }

  const load = () => {
    const seq = ++loadSeq.current
    const searchValue = debouncedSearch.trim() || undefined
    setLoading(true)
    setError('')
    const request = trash
      ? couponsApi.getTrash(searchValue ? { search: searchValue } : undefined)
      : couponsApi.getAll({
          ...(searchValue ? { search: searchValue } : {}),
          ...(discountFrom ? { fromDate: discountFrom } : {}),
          ...(discountTo ? { toDate: discountTo } : {}),
        })
    const dateParams = {
      ...(discountFrom ? { fromDate: discountFrom } : {}),
      ...(discountTo ? { toDate: discountTo } : {}),
    }
    const catalogRequest = !trash && searchValue ? couponsApi.getAll(dateParams) : null
    Promise.all([request, catalogRequest ?? request])
      .then(([listRes, catalogRes]) => {
        if (seq !== loadSeq.current) return
        setData(parseCouponList(listRes.data))
        if (!trash) setCatalog(parseCouponList(catalogRes.data))
      })
      .catch(() => {
        if (seq !== loadSeq.current) return
        setError(trash ? 'Failed to load trashed coupons' : 'Failed to load coupons')
      })
      .finally(() => {
        if (seq !== loadSeq.current) return
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trash, debouncedSearch, discountFrom, discountTo])

  const openEdit = (row: Coupon) => {
    setEditingId(row._id)
    setUpdateForm({
      coupon_code: String(row.coupon_code ?? ''),
      description: String(row.description ?? ''),
      coupon_type: String(row.coupon_type || '').toLowerCase() === 'percentage' ? 'Percentage' : 'Fixed',
      value: Number(row.value ?? 0),
      no_coupon: Number(row.no_coupon ?? 0),
      start_date: toDateTimeLocalValue(row.start_date),
      expiry_date: toDateTimeLocalValue(row.expiry_date),
      minimum_cart_value: Number(row.minimum_cart_value ?? 0),
      status: Boolean(row.status),
      is_auto_apply: Boolean(row.is_auto_apply),
    })
    setAmountFieldErrors({})
    setFormError('')
    setModal('edit')
  }

  const openDuplicate = (row: Coupon) => {
    setCreateForm({
      coupon_code: nextCouponCode(String(row.coupon_code ?? ''), data.map((item) => item.coupon_code || '')),
      description: String(row.description ?? ''),
      coupon_type: String(row.coupon_type || '').toLowerCase() === 'percentage' ? 'Percentage' : 'Fixed',
      value: Number(row.value ?? 0),
      no_coupon: Number(row.no_coupon ?? 0),
      start_date: toDateTimeLocalValue(row.start_date),
      expiry_date: toDateTimeLocalValue(row.expiry_date),
      minimum_cart_value: Number(row.minimum_cart_value ?? 0),
      status: Boolean(row.status),
      is_auto_apply: Boolean(row.is_auto_apply),
    })
    setAmountFieldErrors({})
    setFormError('')
    setDuplicating(true)
    setModal('create')
  }

  const closeModal = () => {
    setModal(null)
    setDuplicating(false)
    setEditingId(null)
    setCreateForm(initialCreateForm)
    setUpdateForm(initialUpdateForm)
    setAmountFieldErrors({})
    setFormError('')
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors = amountErrors(createForm)
    if (Object.keys(errors).length > 0) {
      setAmountFieldErrors(errors)
      setNoticeRevision((current) => current + 1)
      return
    }
    setAmountFieldErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await couponsApi.create({
        coupon_code: createForm.coupon_code,
        description: createForm.description.trim(),
        coupon_type: createForm.coupon_type,
        value: Number(createForm.value),
        no_coupon: Number(createForm.no_coupon),
        start_date: new Date(createForm.start_date).toISOString(),
        expiry_date: new Date(createForm.expiry_date).toISOString(),
        minimum_cart_value: Number(createForm.minimum_cart_value),
        status: createForm.status,
        is_auto_apply: createForm.is_auto_apply,
      })
      showSuccess(duplicating ? 'Coupon duplicated' : 'Coupon created')
      closeModal()
      load()
    } catch (err) {
      setFormError(getApiErrorMessage(err, duplicating ? 'Duplicate failed' : 'Create failed'))
      setNoticeRevision((current) => current + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    const errors = amountErrors(updateForm)
    if (Object.keys(errors).length > 0) {
      setAmountFieldErrors(errors)
      setNoticeRevision((current) => current + 1)
      return
    }
    setAmountFieldErrors({})
    setFormError('')
    setSubmitting(true)
    try {
      await couponsApi.update(editingId, {
        coupon_code: updateForm.coupon_code,
        description: updateForm.description.trim(),
        coupon_type: updateForm.coupon_type,
        value: Number(updateForm.value),
        no_coupon: Number(updateForm.no_coupon),
        start_date: new Date(updateForm.start_date).toISOString(),
        expiry_date: new Date(updateForm.expiry_date).toISOString(),
        minimum_cart_value: Number(updateForm.minimum_cart_value),
        status: updateForm.status,
        is_auto_apply: updateForm.is_auto_apply,
      })
      await couponsApi.updateStatus(editingId, updateForm.status)
      showSuccess('Coupon updated')
      closeModal()
      load()
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Update failed'))
      setNoticeRevision((current) => current + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const patchCouponStatus = (id: string, status: boolean) => {
    const apply = (current: Coupon[]) => current.map((item) => (item._id === id ? { ...item, status } : item))
    setData(apply)
    setCatalog(apply)
  }

  const toggleStatus = async (row: Coupon, next: boolean) => {
    if (!canEdit) return
    setTogglingId(row._id)
    setError('')
    patchCouponStatus(row._id, next)
    try {
      await couponsApi.updateStatus(row._id, next)
      showSuccess(next ? 'Coupon activated' : 'Coupon deactivated', next ? 'success' : 'error')
    } catch (err) {
      patchCouponStatus(row._id, !next)
      setError(getApiErrorMessage(err, 'Failed to update status'))
    } finally {
      setTogglingId('')
    }
  }

  const handleDelete = async (id: string, code?: string) => {
    if (!canDelete) return
    if (!(await confirmDeleteItem(code))) return
    try {
      await couponsApi.delete(id)
      showSuccess('Coupon moved to trash')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Delete failed'))
    }
  }

  
  const handleRestore = async (row: Coupon) => {
    if (!canEdit) return
    if (!(await adminConfirm(`Are you sure you want to restore “${row.coupon_code}”?`))) return
    setRestoringId(row._id)
    setError('')
    try {
      await couponsApi.restore(row._id)
      showSuccess('Coupon restored')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Restore failed'))
    } finally {
      setRestoringId('')
    }
  }

  const openUsage = (row: Coupon) => {
    navigate(
      `/coupon-usage?couponId=${encodeURIComponent(row._id)}&code=${encodeURIComponent(row.coupon_code || '')}`,
    )
  }

  const columns: ColumnDef<Coupon>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) =>
        trash ? (
          <div className="table-actions">
            {canEdit && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              title="Restore coupon"
              aria-label="Restore coupon"
              disabled={restoringId === row.original._id}
              onClick={() => handleRestore(row.original)}
            >
              <RotateCcw size={16} />
            </button>
            )}
          </div>
        ) : (
          <div className="table-actions">
            {canEdit && (
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)} title="Edit coupon" aria-label="Edit coupon">
              <Pencil size={16} />
            </button>
            )}
            {canCreate && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => openDuplicate(row.original)}
              title="Duplicate coupon"
              aria-label="Duplicate coupon"
            >
              <Copy size={16} />
            </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              title="View usage"
              aria-label="View coupon usage"
              onClick={() => openUsage(row.original)}
            >
              <History size={16} />
            </button>
            {canDelete && (
            <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, row.original.coupon_code)} title="Move to trash" aria-label="Move coupon to trash">
              <Trash2 size={16} />
            </button>
            )}
          </div>
        ),
    },
    ...(trash
      ? []
      : [
    {
      header: 'Status',
      accessorKey: 'status',
      enableSorting: false,
      cell: ({ row }) => {
        const active = Boolean(row.original.status)
        const busy = togglingId === row.original._id
        return (
          <label className="toggle-switch toggle-switch--sm" style={{ cursor: !canEdit ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: !canEdit || busy ? 0.7 : 1, paddingTop: 0 }}>
            <input
              type="checkbox"
              checked={active}
              aria-label={active ? 'Deactivate coupon' : 'Activate coupon'}
              disabled={!canEdit || busy}
              onChange={() => toggleStatus(row.original, !active)}
            />
            <span className="toggle-switch-track" aria-hidden>
              <span className="toggle-switch-thumb" />
            </span>
          </label>
        )
      },
    } satisfies ColumnDef<Coupon>,
      ]),
    { header: 'Code', accessorKey: 'coupon_code' },
    {
      header: 'Auto apply',
      accessorKey: 'is_auto_apply',
      enableSorting: false,
      cell: ({ row }) => (row.original.is_auto_apply ? 'Yes' : 'No'),
    },
    { header: 'Type', accessorKey: 'coupon_type', cell: ({ getValue }) => (String(getValue() || '').toLowerCase() === 'flat' ? 'Fixed' : getValue() || '-') },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: ({ row }) => {
        const value = Number(row.original.value ?? 0)
        return row.original.coupon_type === 'Percentage' ? `${value}%` : value
      },
    },
    {
      header: 'Min Cart',
      accessorKey: 'minimum_cart_value',
      cell: ({ row }) => Number(row.original.minimum_cart_value ?? 0),
    },
    {
      header: 'No of coupons',
      accessorKey: 'no_coupon',
      cell: ({ row }) => Number(row.original.no_coupon ?? 0),
    },
    {
      header: 'Start',
      accessorKey: 'start_date',
      cell: ({ row }) => formatDate(row.original.start_date),
    },
    {
      header: 'Coupon Discount',
      accessorKey: 'coupon_discount',
      cell: ({ row }) => Number(row.original?.discount_given ?? 0),
    },
    {
      header: 'Expiry',
      accessorKey: 'expiry_date',
      cell: ({ row }) => formatDate(row.original.expiry_date),
    },
    {
      header: 'No of uses',
      accessorKey: 'used_coupons',
      cell: ({ row }) => {
        const count = Number(row.original.used_count ?? 0)
        const code = row.original.coupon_code || 'this coupon'
        return (
          <button
            type="button"
            className="cat-count cat-count--link"
            title={`View usage for ${code}`}
            onClick={() => openUsage(row.original)}
          >
            {count}
          </button>
        )
      },
    },
  
    {
      header: trash ? 'Deleted' : 'Created At',
      accessorKey: trash ? 'deletedAt' : 'createdAt',
      cell: ({ row }) => formatDate(trash ? row.original.deletedAt ?? undefined : row.original.createdAt),
    },
   
  ]

  const totalCouponDiscount = useMemo(() => {
    const rows = !trash && debouncedSearch.trim() ? catalog : data
    return rows.reduce((sum, row) => sum + Number(row.discount_given ?? 0), 0)
  }, [trash, data, catalog, debouncedSearch])

  const viewCounts = useMemo(
    () => ({
      all: catalog.length,
      published: catalog.filter((row) => Boolean(row.status)).length,
      auto_apply: catalog.filter((row) => Boolean(row.is_auto_apply)).length,
    }),
    [catalog],
  )

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        if (!matchesStartDate(row.start_date, fromDate, toDate)) return false
        if (viewFilter === 'published' && !row.status) return false
        if (viewFilter === 'auto_apply' && !row.is_auto_apply) return false
        if (viewFilter === 'all') {
          if (statusFilter === 'active' && !row.status) return false
          if (statusFilter === 'inactive' && row.status) return false
        }
        if (typeFilter === 'Fixed') {
          const type = String(row.coupon_type || '').toLowerCase()
          if (type !== 'fixed' && type !== 'flat') return false
        } else if (typeFilter !== 'all' && row.coupon_type !== typeFilter) return false
        return true
      }),
    [data, fromDate, toDate, statusFilter, typeFilter, viewFilter],
  )

  const applyViewFilter = (next: ViewFilter) => {
    setViewFilter(next)
    if (next === 'published') setStatusFilter('active')
    else if (next === 'all') setStatusFilter('all')
  }

  const filteredIds = useMemo(() => filteredData.map((row) => row._id), [filteredData])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id))
  const someFilteredSelected = filteredIds.some((id) => selectedSet.has(id)) && !allFilteredSelected

  useEffect(() => {
    const visible = new Set(filteredIds)
    setSelectedIds((current) => {
      const next = current.filter((id) => visible.has(id))
      return next.length === current.length ? current : next
    })
  }, [filteredIds])

  const toggleAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? [] : filteredIds)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const applyBulk = async () => {
    const selected = filteredData.filter((row) => selectedSet.has(row._id))
    if (!bulkAction) {
      setError('Choose a bulk action')
      return
    }
    if (!selected.length) {
      setError('Select at least one coupon')
      return
    }
    setError('')
    setSuccess('')
    if (bulkAction === 'csv') {
      if (!canExport) return
      downloadCouponsCsv(selected)
      showSuccess(`Exported ${selected.length} coupon${selected.length === 1 ? '' : 's'}`)
      return
    }
    if (!canDelete) return
    const codes = selected.map((row) => row.coupon_code).filter(Boolean)
    const confirmed = await confirmDeleteItem(
      codes.length <= 3 ? codes.join(', ') : `${selected.length} coupons`,
    )
    if (!confirmed) return
    setBulkWorking(true)
    const results = await Promise.allSettled(selected.map((row) => couponsApi.delete(row._id)))
    const failed = selected.filter((_, index) => results[index]?.status === 'rejected')
    const moved = selected.length - failed.length
    setBulkWorking(false)
    setSelectedIds([])
    if (moved) {
      showSuccess(`Moved ${moved} coupon${moved === 1 ? '' : 's'} to trash`)
      load()
    }
    if (failed.length) {
      setError(`Could not move ${failed.map((row) => row.coupon_code || 'a coupon').join(', ')} to trash`)
    }
  }

  const selectColumn: ColumnDef<Coupon> = {
    id: 'select',
    enableSorting: false,
    header: () => (
      <SelectAllCoupons
        checked={allFilteredSelected}
        indeterminate={someFilteredSelected}
        disabled={bulkWorking || filteredIds.length === 0}
        onChange={toggleAllFiltered}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="table-select"
        checked={selectedSet.has(row.original._id)}
        disabled={bulkWorking}
        aria-label={`Select ${row.original.coupon_code || 'coupon'}`}
        onChange={() => toggleRow(row.original._id)}
      />
    ),
  }

  if (loading && data.length === 0 && catalog.length === 0) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{trash ? 'Coupon trash' : 'Coupons'}</h1>
          <p className="page-subtitle">
            {trash ? 'Soft-deleted coupons. Restore one to put it back.' : 'Get, add, update and delete coupons.'}
          </p>
        </div>
        {trash ? (
          <button type="button" className="btn" onClick={() => navigate('/coupons')}>
            Back to coupons
          </button>
        ) : (canDelete || canCreate) ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canDelete && (
            <button type="button" className="btn" onClick={() => navigate('/coupons/trash')}>
              <Trash2 size={18} /> Trash
            </button>
            )}
            {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setDuplicating(false)
                setCreateForm(initialCreateForm)
                setAmountFieldErrors({})
                setFormError('')
                setModal('create')
              }}
            >
              <Plus size={18} /> Add Coupon
            </button>
            )}
          </div>
        ) : null}
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className={`alert ${successTone === 'error' ? 'alert-error' : 'alert-success'}`}>{success}</div>}
      {!trash && (
        <div className="coupon-view-counts" role="group" aria-label="Coupon views">
          <button
            type="button"
            className={`coupon-view-count${viewFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => applyViewFilter('all')}
          >
            All <span>({viewCounts.all})</span>
          </button>
          <span className="coupon-view-count__sep" aria-hidden="true">|</span>
          <button
            type="button"
            className={`coupon-view-count${viewFilter === 'published' ? ' is-active' : ''}`}
            onClick={() => applyViewFilter('published')}
          >
            Published <span>({viewCounts.published})</span>
          </button>
          <span className="coupon-view-count__sep" aria-hidden="true">|</span>
          <button
            type="button"
            className={`coupon-view-count${viewFilter === 'auto_apply' ? ' is-active' : ''}`}
            onClick={() => applyViewFilter('auto_apply')}
          >
            Auto-apply coupons <span>({viewCounts.auto_apply})</span>
          </button>
          <p className="coupon-discount-total">
            <span>Total coupon discount</span>
            {formatAed(totalCouponDiscount)}
          </p>
        </div>
      )}
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Start date </div>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>End date </div>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Status</div>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as StatusFilter
                setStatusFilter(next)
                setViewFilter(next === 'active' ? 'published' : 'all')
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Type</div>
            <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <option value="all">All types</option>
              <option value="Percentage">Percentage</option>
              <option value="Fixed">Fixed</option>
            </select>
          </div>
        </div>
      </div>
      <DataTable
        data={filteredData}
        columns={trash || (!canDelete && !canExport) ? columns : [selectColumn, ...columns]}
        searchPlaceholder="Search coupons..."
        serverSearch={{ value: search, onChange: setSearch }}
        headerRight={
          trash || (!canDelete && !canExport) ? undefined : (
            <div className="bulk-actions coupon-bulk-actions">
              <select
                className="select"
                aria-label="Bulk actions"
                value={bulkAction}
                disabled={bulkWorking}
                onChange={(e) => setBulkAction(e.target.value as BulkAction)}
              >
                <option value="">Bulk actions</option>
                {canDelete && <option value="trash">Move to trash</option>}
                {canExport && <option value="csv">Export CSV</option>}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void applyBulk()}
                disabled={bulkWorking || !bulkAction || selectedIds.length === 0}
              >
                {bulkWorking ? 'Applying...' : 'Apply action'}
              </button>
              {selectedIds.length > 0 && (
                <span className="bulk-actions__count">
                  {selectedIds.length} selected
                </span>
              )}
            </div>
          )
        }
      />

      {!trash && modal === 'create' && (
        <Modal title={duplicating ? 'Duplicate coupon' : 'Create Coupon'} onClose={closeModal}>
          <form onSubmit={handleCreate}>
            {(formError || amountFieldErrors.value || amountFieldErrors.no_coupon || amountFieldErrors.minimum_cart_value) && (
              <div ref={formNoticeRef}>
                {formError && <div className="alert alert-error">{formError}</div>}
                {(amountFieldErrors.value || amountFieldErrors.no_coupon || amountFieldErrors.minimum_cart_value) && (
                  <div className="alert alert-error">{AMOUNT_ERROR}</div>
                )}
              </div>
            )}
            <FormField label="Coupon Code" required>
              <input
                className="input"
                value={createForm.coupon_code}
                onChange={(e) => setCreateForm((p) => ({ ...p, coupon_code: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Description">
              <textarea
                className="textarea"
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this coupon is for"
              />
            </FormField>
            <FormField label="Coupon Type" required>
              <select
                className="select"
                value={createForm.coupon_type}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, coupon_type: e.target.value as 'Percentage' | 'Fixed' }))
                }
                required
              >
                <option value="Percentage">Percentage</option>
                <option value="Fixed">Fixed</option>
              </select>
            </FormField>
            <FormField label="Value" required error={amountFieldErrors.value}>
              <input
                type="number"
                min={0}
                step="any"
                className={`input${amountFieldErrors.value ? ' is-invalid' : ''}`}
                value={createForm.value}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, value: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, value: undefined }))
                }}
                required
              />
            </FormField>
            <FormField label="Number of coupons" required error={amountFieldErrors.no_coupon}>
              <input
                type="number"
                min={0}
                step={1}
                className={`input${amountFieldErrors.no_coupon ? ' is-invalid' : ''}`}
                value={createForm.no_coupon}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, no_coupon: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, no_coupon: undefined }))
                }}
                required
              />
            </FormField>
            <FormField label="Start Date" required>
              <input
                type="datetime-local"
                className="input"
                value={createForm.start_date}
                onChange={(e) => setCreateForm((p) => ({ ...p, start_date: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Expiry Date" required>
              <input
                type="datetime-local"
                className="input"
                value={createForm.expiry_date}
                onChange={(e) => setCreateForm((p) => ({ ...p, expiry_date: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Minimum Cart Value -AED" required error={amountFieldErrors.minimum_cart_value}>
              <input
                type="number"
                min={0}
                step="any"
                className={`input${amountFieldErrors.minimum_cart_value ? ' is-invalid' : ''}`}
                value={createForm.minimum_cart_value}
                onChange={(e) => {
                  setCreateForm((p) => ({ ...p, minimum_cart_value: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, minimum_cart_value: undefined }))
                }}
                required
              />
            </FormField>
            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={createForm.status}
                onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.checked }))}
              />
              Active
            </label>
            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={createForm.is_auto_apply}
                onChange={(e) => setCreateForm((p) => ({ ...p, is_auto_apply: e.target.checked }))}
              />
              Auto apply
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : duplicating ? 'Duplicate' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {!trash && modal === 'edit' && (
        <Modal title="Update Coupon" onClose={closeModal}>
          <form onSubmit={handleUpdate}>
            {(formError || amountFieldErrors.value || amountFieldErrors.no_coupon || amountFieldErrors.minimum_cart_value) && (
              <div ref={formNoticeRef}>
                {formError && <div className="alert alert-error">{formError}</div>}
                {(amountFieldErrors.value || amountFieldErrors.no_coupon || amountFieldErrors.minimum_cart_value) && (
                  <div className="alert alert-error">{AMOUNT_ERROR}</div>
                )}
              </div>
            )}
            <FormField label="Coupon Code" required>
              <input
                className="input"
                value={updateForm.coupon_code}
                onChange={(e) => setUpdateForm((p) => ({ ...p, coupon_code: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Description">
              <textarea
                className="textarea"
                rows={3}
                value={updateForm.description}
                onChange={(e) => setUpdateForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this coupon is for"
              />
            </FormField>
            <FormField label="Coupon Type" required>
              <select
                className="select"
                value={updateForm.coupon_type}
                onChange={(e) =>
                  setUpdateForm((p) => ({ ...p, coupon_type: e.target.value as 'Percentage' | 'Fixed' }))
                }
                required
              >
                <option value="Percentage">Percentage</option>
                <option value="Fixed">Fixed</option>
              </select>
            </FormField>
            <FormField label="Value" required error={amountFieldErrors.value}>
              <input
                type="number"
                min={0}
                step="any"
                className={`input${amountFieldErrors.value ? ' is-invalid' : ''}`}
                value={updateForm.value}
                onChange={(e) => {
                  setUpdateForm((p) => ({ ...p, value: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, value: undefined }))
                }}
                required
              />
            </FormField>
            <FormField label="Number of coupons" required error={amountFieldErrors.no_coupon}>
              <input
                type="number"
                min={0}
                step={1}
                className={`input${amountFieldErrors.no_coupon ? ' is-invalid' : ''}`}
                value={updateForm.no_coupon}
                onChange={(e) => {
                  setUpdateForm((p) => ({ ...p, no_coupon: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, no_coupon: undefined }))
                }}
                required
              />
            </FormField>
            <FormField label="Start Date" required>
              <input
                type="datetime-local"
                className="input"
                value={updateForm.start_date}
                onChange={(e) => setUpdateForm((p) => ({ ...p, start_date: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Expiry Date" required>
              <input
                type="datetime-local"
                className="input"
                value={updateForm.expiry_date}
                onChange={(e) => setUpdateForm((p) => ({ ...p, expiry_date: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Minimum Cart Value -AED" required error={amountFieldErrors.minimum_cart_value}>
              <input
                type="number"
                min={0}
                step="any"
                className={`input${amountFieldErrors.minimum_cart_value ? ' is-invalid' : ''}`}
                value={updateForm.minimum_cart_value}
                onChange={(e) => {
                  setUpdateForm((p) => ({ ...p, minimum_cart_value: Number(e.target.value) }))
                  setAmountFieldErrors((p) => ({ ...p, minimum_cart_value: undefined }))
                }}
                required
              />
            </FormField>
            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={updateForm.status}
                onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.checked }))}
              />
              Active
            </label>
            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={updateForm.is_auto_apply}
                onChange={(e) => setUpdateForm((p) => ({ ...p, is_auto_apply: e.target.checked }))}
              />
              Auto apply
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

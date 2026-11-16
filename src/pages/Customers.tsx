import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, Copy, Eye, EyeOff, FileSpreadsheet, ImageOff, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, customersApi } from '../api/endpoints'
import { getProfileImageUrl } from '../api/client'
import type { CustomerUser } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { ImageSourceField, imageFieldValue } from '../components/media/ImageSourceField'
import { adminConfirm, confirmDeleteItem } from '../utils/adminConfirm'
import { getCountryNameOptions, matchCountryName } from '../utils/country'
import { isoDateParam } from '../utils/dateQuery'
import { useModuleCan } from '../components/rbac/useModuleCan'

const COUNTRY_OPTIONS = getCountryNameOptions()

function CopyEmail({ email }: { email: string }) {
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
    <span className="payment-email">
      <span className="payment-email__text">{email}</span>
      <button
        type="button"
        className="payment-email__copy"
        onClick={() => void copy()}
        aria-label={copied ? 'Email copied' : 'Copy email'}
        title={copied ? 'Copied' : 'Copy email'}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  )
}

type CustomerForm = {
  name: string
  email: string
  phone_number: string
  country: string
  postal_code: string
  password: string
  password_confirmation: string
  status: boolean
}

const initialForm: CustomerForm = {
  name: '',
  email: '',
  phone_number: '',
  country: '',
  postal_code: '',
  password: '',
  password_confirmation: '',
  status: true,
}

function toArray(payload: unknown): CustomerUser[] {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as CustomerUser[]
  if (root.data && typeof root.data === 'object' && 'data' in root.data) {
    const users = (root.data as { data?: unknown[] }).data
    return Array.isArray(users) ? (users as CustomerUser[]) : []
  }
  if (root.data && typeof root.data === 'object' && 'users' in root.data) {
    const users = (root.data as { users?: unknown[] }).users
    return Array.isArray(users) ? (users as CustomerUser[]) : []
  }
  return []
}

const formatAed = (value?: number | null) => `AED ${Number(value || 0).toFixed(2)}`

const formatSummaryMoney = (value: number) => `${value.toFixed(2)} د.إ`

function CustomerSummary({ rows }: { rows: CustomerUser[] }) {
  const customers = rows.length
  const orders = rows.reduce((sum, row) => sum + Number(row.purchases || 0), 0)
  const spend = rows.reduce((sum, row) => sum + Number(row.total_spend || 0), 0)
  const spendOrders = rows.reduce((sum, row) => {
    if (row.spend_orders != null) return sum + Number(row.spend_orders || 0)
    const aov = Number(row.aov || 0)
    const total = Number(row.total_spend || 0)
    return sum + (aov > 0 ? total / aov : 0)
  }, 0)
  const averageOrders = customers ? orders / customers : 0
  const averageLifetime = customers ? spend / customers : 0
  const averageOrderValue = spendOrders ? spend / spendOrders : 0
  const stats = [
    { value: customers.toLocaleString('en-US'), label: 'customers' },
    { value: averageOrders.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }), label: 'Average orders' },
    { value: formatSummaryMoney(averageLifetime), label: 'Average lifetime spend' },
    { value: formatSummaryMoney(averageOrderValue), label: 'Average order value' },
  ]

  return (
    <div className="customer-summary">
      {stats.map((stat) => (
        <div key={stat.label} className="customer-summary__item">
          <span className="customer-summary__value">{stat.value}</span>
          <span className="customer-summary__label">{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

const apiMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === 'object' && 'response' in err) {
    const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (message) return message
  }
  return fallback
}

function CustomerThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = src ? getProfileImageUrl(src) : undefined

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!resolved || failed) {
    return (
      <span className="customer-avatar-fallback" aria-hidden>
        <ImageOff size={16} />
      </span>
    )
  }

  return <img src={resolved} alt={alt} className="customer-avatar" onError={() => setFailed(true)} />
}

export function Customers() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete, canExport } = useModuleCan('customers')
  const [searchParams] = useSearchParams()
  const initialFromDate = isoDateParam(searchParams.get('fromDate'))
  const initialToDate = isoDateParam(searchParams.get('toDate'))
  const [rows, setRows] = useState<CustomerUser[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sendingResetId, setSendingResetId] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<CustomerForm>(initialForm)
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [existingProfilePic, setExistingProfilePic] = useState('')
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)
  const [appliedFromDate, setAppliedFromDate] = useState(initialFromDate)
  const [appliedToDate, setAppliedToDate] = useState(initialToDate)
  const [countryFilter, setCountryFilter] = useState('')
  const [appliedCountry, setAppliedCountry] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const load = (fromOverride = appliedFromDate, toOverride = appliedToDate) => {
    setLoading(true)
    setError('')
    customersApi
      .getAll({
        fromDate: fromOverride || undefined,
        toDate: toOverride || undefined,
      })
      .then((res) => setRows(toArray(res.data)))
      .catch(() => setError('Failed to load customers'))
      .finally(() => {
        setLoading(false)
        setInitialLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyJoinDateFilter = () => {
    setAppliedFromDate(fromDate)
    setAppliedToDate(toDate)
    setAppliedCountry(countryFilter)
    load(fromDate, toDate)
  }

  const clearJoinDateFilter = () => {
    setFromDate('')
    setToDate('')
    setAppliedFromDate('')
    setAppliedToDate('')
    setCountryFilter('')
    setAppliedCountry('')
    load('', '')
  }

  const filteredRows = useMemo(() => {
    if (!appliedCountry) return rows
    const selected = matchCountryName(appliedCountry).toLowerCase()
    return rows.filter((row) => matchCountryName(row.country).toLowerCase() === selected)
  }, [rows, appliedCountry])

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
    setProfileFile(null)
    setProfileUrl('')
    setExistingProfilePic('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const openCreate = () => {
    setForm(initialForm)
    setEditingId(null)
    setProfileFile(null)
    setProfileUrl('')
    setExistingProfilePic('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setModal('create')
  }

  const openEdit = (row: CustomerUser) => {
    setEditingId(row._id)
    setForm({
      name: row.name || '',
      email: row.email || '',
      phone_number: row.phone_number || '',
      country: matchCountryName(row.country),
      postal_code: row.postal_code || '',
      password: '',
      password_confirmation: '',
      status: row.status !== 'suspended',
    })
    setProfileFile(null)
    setProfileUrl('')
    setExistingProfilePic(row.profile_pic || '')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setModal('edit')
  }

  const handleExport = async () => {
    if (!canExport) return
    try {
      setExporting(true)
      setError('')
      const res = await authApi.exportUsers()
      const blob = new Blob([res.data], {
        type: res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export customers')
    } finally {
      setExporting(false)
    }
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (form.password !== form.password_confirmation) {
      setError('Password confirmation does not match')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = new FormData()
      payload.append('name', form.name.trim())
      payload.append('email', form.email.trim())
      payload.append('phone_number', form.phone_number.trim())
      payload.append('country', form.country.trim())
      payload.append('postal_code', form.postal_code.trim())
      payload.append('password', form.password)
      payload.append('password_confirmation', form.password_confirmation)
      payload.append('status', String(form.status))
      if (profileFile) payload.append('profile_pic', profileFile)
      else if (profileUrl.trim()) payload.append('profile_pic', imageFieldValue(profileUrl))
      await customersApi.create(payload)
      setSuccess('Customer created')
      closeModal()
      load()
    } catch (err) {
      setError(apiMessage(err, 'Failed to create customer'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    if (form.password && form.password !== form.password_confirmation) {
      setError('Password confirmation does not match')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload = new FormData()
      payload.append('name', form.name.trim())
      payload.append('email', form.email.trim())
      payload.append('phone_number', form.phone_number.trim())
      payload.append('country', form.country.trim())
      payload.append('postal_code', form.postal_code.trim())
      payload.append('status', String(form.status))
      if (form.password) {
        payload.append('password', form.password)
        payload.append('password_confirmation', form.password_confirmation)
      }
      if (profileFile) payload.append('profile_pic', profileFile)
      else if (profileUrl.trim()) payload.append('profile_pic', imageFieldValue(profileUrl))
      await customersApi.update(editingId, payload)
      setSuccess('Customer updated')
      closeModal()
      load()
    } catch (err) {
      setError(apiMessage(err, 'Failed to update customer'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReset = async (customer: CustomerUser) => {
    if (!canEdit) return
    const email = customer.email?.trim()
    if (!email) {
      setError('This customer has no email address')
      return
    }
    if (!(await adminConfirm(`Send a password reset link to ${email}? They can use it to choose a new password.`))) return
    setSendingResetId(customer._id)
    setError('')
    setSuccess('')
    try {
      const res = await customersApi.sendPasswordReset(customer._id)
      setSuccess(res.data?.message || `Password reset link sent to ${email}`)
    } catch (err) {
      setError(apiMessage(err, 'Failed to send password reset'))
    } finally {
      setSendingResetId(null)
    }
  }

  const handleDelete = async (id: string, name?: string) => {
    if (!canDelete) return
    if (!(await confirmDeleteItem(name))) return
    try {
      setError('')
      await customersApi.delete(id)
      setSuccess('Customer deleted')
      load()
    } catch (err) {
      setError(apiMessage(err, 'Failed to delete customer'))
    }
  }

  const columns: ColumnDef<CustomerUser>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon--reset"
            title="Send password reset"
            aria-label="Send password reset"
            disabled={sendingResetId === row.original._id}
            onClick={() => handleSendReset(row.original)}
          >
            <KeyRound size={16} />
          </button>
          )}
          {canEdit && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)}>
            <Pencil size={16} />
          </button>
          )}
          {canDelete && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, [row.original.name, row.original.last_name].filter(Boolean).join(' ') || row.original.email)}>
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    { header: '#', id: 'rowNum', cell: ({ row }) => row.index + 1 },
    {
      header: 'Photo',
      id: 'profile_pic',
      enableSorting: false,
      cell: ({ row }) => (
        <CustomerThumb
          src={row.original.profile_pic}
          alt={`${row.original.name || 'Customer'} photo`}
        />
      ),
    },
    {
      header: 'Name',
      id: 'name',
      accessorFn: (row) => `${row.name || ''} ${row.last_name || ''}`.trim(),
      cell: ({ getValue }) => (getValue() as string) || '-',
    },
    {
      header: 'Email',
      accessorKey: 'email',
      cell: ({ getValue }) => {
        const email = String(getValue() || '').trim()
        return email ? <CopyEmail email={email} /> : '-'
      },
    },
    {
      header: 'Phone',
      id: 'phone',
      accessorFn: (row) => row.phone_number || '',
      cell: ({ getValue }) => (getValue() as string) || '-',
    },

    {
      header: 'Role',
      id: 'role',
      accessorFn: (row) =>
        row.role && typeof row.role === 'object' && row.role.name === 'User' ? 'Customer' : '',
      cell: ({ getValue }) => (getValue() as string) || '-',
    },

    {
      header: 'Country',
      id: 'country',
      accessorFn: (row) => row.country || '',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: 'State',
      id: 'state',
      accessorFn: (row) => row.state || '',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: 'Postal code',
      id: 'postal_code',
      accessorFn: (row) => row.postal_code || '',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: 'Total spend',
      accessorKey: 'total_spend',
      cell: ({ row }) => formatAed(row.original.total_spend),
    },
    {
      header: 'AOV',
      accessorKey: 'aov',
      cell: ({ row }) => formatAed(row.original.aov),
    },
    {
      header: 'Verified',
      accessorKey: 'is_verified',
      cell: ({ getValue }) =>
        getValue() ? <span className="badge badge-success">Yes</span> : <span className="badge badge-warning">No</span>,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const value = String(getValue() || '-')
        return value === 'active' ? (
          <span className="badge badge-success">Active</span>
        ) : value === 'suspended' ? (
          <span className="badge badge-danger">Suspended</span>
        ) : (
          value
        )
      },
    },
    {
      header: 'Orders',
      accessorKey: 'purchases',
      cell: ({ row }) => {
        const count = Number(row.original.purchases || 0)
        return (
          <button
            type="button"
            className="cat-count cat-count--link"
            title={`View orders for ${row.original.name || 'this customer'}`}
            onClick={() => navigate(`/orders?customerId=${encodeURIComponent(row.original._id)}`)}
          >
            {count}
          </button>
        )
      },
    },
 
    {
      header: 'Join Date',
      id: 'joinDate',
      cell: ({ row }) => formatDate(row.original.joinDate || row.original.createdAt),
    },
 
  ]

  if (initialLoading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Add, update and delete customer accounts.</p>
        </div>
        {canCreate && (
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Add Customer
        </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Joined from</div>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Joined to</div>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Country</div>
            <select className="select" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
              <option value="">All countries</option>
              {COUNTRY_OPTIONS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={applyJoinDateFilter} disabled={loading}>
              Apply Filter
            </button>
            {(appliedFromDate || appliedToDate || appliedCountry) && (
              <button type="button" className="btn btn-ghost" onClick={clearJoinDateFilter} disabled={loading}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        data={filteredRows}
        columns={columns}
        pageSize={50}
        pageSizeOptions={[50, 100, 200, 500]}
        searchPlaceholder="Search customers..."
        summary={(list) => <CustomerSummary rows={list} />}
        headerRight={canExport ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting}>
            <FileSpreadsheet size={16} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        ) : undefined}
      />

      {modal && (
        <Modal title={modal === 'create' ? 'Add Customer' : 'Update Customer'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <FormField label="Name" required>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Email" required>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </FormField>
            <div className="form-row">
              <FormField label="Phone">
                <input
                  className="input"
                  value={form.phone_number}
                  onChange={(e) => setForm((p) => ({ ...p, phone_number: e.target.value }))}
                />
              </FormField>
              <FormField label="Country">
                <select
                  className="select"
                  value={form.country}
                  onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                >
                  <option value="">Select country</option>
                  {form.country && !COUNTRY_OPTIONS.includes(form.country) ? (
                    <option value={form.country}>{form.country}</option>
                  ) : null}
                  {COUNTRY_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Postal code">
              <input
                className="input"
                value={form.postal_code}
                onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))}
                placeholder="Postal code"
                autoComplete="postal-code"
              />
            </FormField>
            <ImageSourceField
              label="Profile picture"
              hint={existingProfilePic && !profileFile && !profileUrl ? 'Leave empty to keep the current photo' : 'Optional'}
              file={profileFile}
              url={profileUrl}
              existing={existingProfilePic}
              onFileChange={setProfileFile}
              onUrlChange={setProfileUrl}
            />
            <div className="form-row">
              <FormField
                label="Password"
                required={modal === 'create'}
                hint={modal === 'edit' ? 'Leave blank to keep the current password' : undefined}
              >
                <div className="password-input-wrap">
                  <input
                    className="input password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    required={modal === 'create'}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </FormField>
              <FormField label="Confirm password" required={modal === 'create'}>
                <div className="password-input-wrap">
                  <input
                    className="input password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.password_confirmation}
                    onChange={(e) => setForm((p) => ({ ...p, password_confirmation: e.target.value }))}
                    required={modal === 'create' || Boolean(form.password)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </FormField>
            </div>
            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))}
              />
              Active
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : modal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

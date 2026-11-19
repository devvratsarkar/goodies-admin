import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, RefreshCw } from 'lucide-react'
import { exchangeRatesApi } from '../api/endpoints'
import type { ExchangeRate } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { useModuleCan } from '../components/rbac/useModuleCan'

const BASE_CURRENCY = 'AED'

type FormState = {
  currency: string
  rate: string
  status: boolean
}

const initialForm: FormState = {
  currency: BASE_CURRENCY,
  rate: '',
  status: true,
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } }
  return err?.response?.data?.message || fallback
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

export function ExchangeRates() {
  const { canEdit } = useModuleCan('exchange-rates')
  const [data, setData] = useState<ExchangeRate[]>([])
  const [base, setBase] = useState(BASE_CURRENCY)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [modalError, setModalError] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  const load = (term = debouncedSearch) => {
    setLoading(true)
    setError('')
    exchangeRatesApi
      .getAll({ search: term.trim() || undefined })
      .then((res) => {
        const payload = res.data?.data
        const rows = Array.isArray(payload?.rates) ? payload.rates : []
        setData(rows)
        setBase(payload?.base || BASE_CURRENCY)
        setLastSyncedAt(payload?.last_synced_at || null)
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load exchange rates')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const openEdit = (row: ExchangeRate) => {
    setEditingId(row._id)
    setForm({
      currency: String(row.currency || '').toUpperCase(),
      rate: String(row.rate ?? ''),
      status: row.status !== false,
    })
    setModalError('')
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setEditingId(null)
    setForm(initialForm)
    setModalError('')
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    setModalError('')
    setError('')
    try {
      const rate = Number(form.rate)
      if (!Number.isFinite(rate) || rate <= 0) {
        setModalError('Rate must be a number greater than 0')
        setSubmitting(false)
        return
      }
      await exchangeRatesApi.update(editingId, {
        rate,
        status: form.status,
      })
      setSuccess('Exchange rate updated')
      closeModal()
      load()
    } catch (err) {
      setModalError(getErrorMessage(err, 'Update failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (row: ExchangeRate, next: boolean) => {
    if (!canEdit) return
    setTogglingId(row._id)
    setError('')
    setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: next } : item)))
    try {
      await exchangeRatesApi.update(row._id, { status: next })
      setSuccess(next ? `${row.currency} activated` : `${row.currency} deactivated`)
    } catch (err) {
      setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: !next } : item)))
      setError(getErrorMessage(err, 'Failed to update status'))
    } finally {
      setTogglingId('')
    }
  }

  const handleSync = async () => {
    if (!canEdit) return
    setSyncing(true)
    setError('')
    setSuccess('')
    try {
      const res = await exchangeRatesApi.sync(true)
      setSuccess(res.data?.message || 'Exchange rates synced')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  const columns: ColumnDef<ExchangeRate>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)}>
            <Pencil size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      enableSorting: false,
      cell: ({ row }) => {
        const active = row.original.status !== false
        const busy = togglingId === row.original._id
        return (
          <label className="toggle-switch toggle-switch--sm" style={{ cursor: !canEdit ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: !canEdit || busy ? 0.7 : 1, paddingTop: 0 }}>
            <input
              type="checkbox"
              checked={active}
              aria-label={active ? `Deactivate ${row.original.currency}` : `Activate ${row.original.currency}`}
              disabled={!canEdit || busy}
              onChange={() => toggleStatus(row.original, !active)}
            />
            <span className="toggle-switch-track" aria-hidden>
              <span className="toggle-switch-thumb" />
            </span>
          </label>
        )
      },
    },
    {
      header: 'Base Currency',
      accessorKey: 'base',
      cell: "AED",
    },
    {
      header: 'Currency',
      accessorKey: 'currency',
      cell: ({ getValue }) => {
        const code = String(getValue() || '').toUpperCase()
        return   code ;
      },
    },
    {
      header: `Rate (1 ${base} =)`,
      accessorKey: 'rate',
      cell: ({ getValue }) => Number(getValue() || 0).toFixed(6),
    },
    {
      header: 'Source',
      accessorKey: 'source',
      cell: ({ getValue }) => (getValue() === 'manual' ? 'Manual' : 'Open Exchange Rates'),
    },
    {
      header: 'Last synced',
      accessorKey: 'last_synced_at',
      cell: ({ getValue }) => formatDate(getValue() as string | null),
    },
  
   
  ]

  if (loading && data.length === 0 && !search) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exchange Rates</h1>
          <p className="page-subtitle">
            Base currency is {base}. Rates show how much 1 {base} converts to. Last sync {formatDate(lastSyncedAt)}.
          </p>
        </div>
        {canEdit && (
        <div className="table-actions">
          <button type="button" className="btn btn-primary" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={18} />
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search currency..."
        serverSearch={{ value: search, onChange: setSearch }}
      />

      {modal && (
        <Modal title="Update Exchange Rate" onClose={closeModal}>
          <form onSubmit={handleUpdate}>
            {modalError && (
              <div className="alert alert-error" style={{ marginBottom: 12 }}>
                {modalError}
              </div>
            )}

            <FormField label="Currency" required>
              <input type="text" className="input" value={form.currency} readOnly />
            </FormField>

            <FormField label={`Rate (1 ${base} =)`} required>
              <input
                type="number"
                min={0}
                step="0.000001"
                className="input"
                value={form.rate}
                onChange={(e) => setForm((prev) => ({ ...prev, rate: e.target.value }))}
                required
              />
            </FormField>

            <label className="form-check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
              />
              Active
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

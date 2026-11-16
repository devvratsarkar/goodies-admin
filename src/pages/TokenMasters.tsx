import { useState, useEffect } from 'react'
import { tokenMastersApi } from '../api/endpoints'
import { confirmDeleteItem } from '../utils/adminConfirm'
import type { TokenMaster } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Coins } from 'lucide-react'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const

type TokenFormState = {
  name: string
  credits: number
  bonus_credits: number
  price: number
  currency: string
  per_credit_price: number
  is_most_popular: boolean
  sort_order: number
  status: 'ACTIVE' | 'INACTIVE'
}

const initialForm: TokenFormState = {
  name: '',
  credits: 100,
  bonus_credits: 0,
  price: 9.99,
  currency: 'USD',
  per_credit_price: 0,
  is_most_popular: false,
  sort_order: 1,
  status: 'ACTIVE',
}

export function TokenMasters() {
  const [data, setData] = useState<TokenMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)

  const load = () => {
    setLoading(true)
    setError('')
    tokenMastersApi
      .getAll()
      .then((res) => {
        const d = (res.data as { data?: TokenMaster[] | { list?: TokenMaster[] } })?.data
        const list = Array.isArray(d) ? d : (d && typeof d === 'object' && 'list' in d ? (d as { list?: TokenMaster[] }).list ?? [] : [])
        setData(Array.isArray(list) ? list : [])
      })
      .catch(() => setError('Failed to load token packs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  useEffect(() => {
    if (form.credits > 0 && form.price > 0) {
      setForm((f) => ({ ...f, per_credit_price: Math.round((f.price / f.credits) * 100) / 100 }))
    }
  }, [form.credits, form.price])

  const openEdit = (row: TokenMaster) => {
    setEditingId(row._id)
    setForm({
      name: row.name,
      credits: row.credits,
      bonus_credits: row.bonus_credits ?? 0,
      price: row.price,
      currency: row.currency ?? 'USD',
      per_credit_price: row.per_credit_price ?? 0,
      is_most_popular: row.is_most_popular ?? false,
      sort_order: row.sort_order ?? 1,
      status: row.status,
    })
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await tokenMastersApi.create(form)
      setSuccess('Token pack created')
      closeModal()
      load()
    } catch {
      setError('Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    setError('')
    try {
      await tokenMastersApi.update(editingId, form)
      setSuccess('Token pack updated')
      closeModal()
      load()
    } catch {
      setError('Failed to update')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name?: string) => {
    if (!(await confirmDeleteItem(name))) return
    try {
      await tokenMastersApi.delete(id)
      setSuccess('Deleted')
      load()
    } catch {
      setError('Delete failed')
    }
  }

  const columns: ColumnDef<TokenMaster, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Credits', accessorKey: 'credits' },
    { header: 'Bonus', accessorKey: 'bonus_credits', cell: ({ getValue }) => getValue() ?? 0 },
    {
      header: 'Most Popular',
      accessorKey: 'is_most_popular',
      cell: ({ getValue }) => {
        const v = Boolean(getValue())
        return v ? <span className="badge badge-success">Yes</span> : <span className="badge">No</span>
      },
    },
    {
      header: 'Price',
      accessorKey: 'price',
      cell: ({ row }) => `${row.original.currency ?? 'USD'} ${(row.original.price as number).toFixed(2)}`,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return <span className={v === 'ACTIVE' ? 'badge badge-success' : 'badge badge-danger'}>{v}</span>
      },
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)} title="Edit">
            <Pencil size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, row.original.name)} title="Delete">
            <Trash2 size={16} />
          </button>
 
        </div>
      ),
    },
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Token Masters</h1>
          <p className="page-subtitle">Manage token packs and pricing.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={18} /> Add Token Pack
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <DataTable data={data} columns={columns} searchPlaceholder="Search token packs..." />

      {modal && (
        <Modal title={modal === 'create' ? 'Create Token Pack' : 'Edit Token Pack'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <FormField label="Name" required>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Starter Pack"
                required
              />
            </FormField>

            <div className="form-row">
              <FormField label="Credits" hint="Base credits included" required>
                <input
                  type="number"
                  className="input"
                  min={1}
                  value={form.credits}
                  onChange={(e) => setForm((f) => ({ ...f, credits: Number(e.target.value) || 0 }))}
                  required
                />
              </FormField>
              <FormField label="Bonus Credits" hint="Optional extra credits">
                <input
                  type="number"
                  className="input"
                  min={0}
                  value={form.bonus_credits}
                  onChange={(e) => setForm((f) => ({ ...f, bonus_credits: Number(e.target.value) || 0 }))}
                />
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="Price" required>
                <input
                  type="number"
                  className="input"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                  required
                />
              </FormField>
              <FormField label="Currency">
                <select
                  className="select"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="Sort Order" hint="Lower = first">
                <input
                  type="number"
                  className="input"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
                />
              </FormField>
              <FormField label="Status">
                <select
                  className="select"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="">
              <label className="form-check">
                <input
                  type="checkbox"
                  checked={form.is_most_popular}
                  onChange={(e) => setForm((f) => ({ ...f, is_most_popular: e.target.checked }))}
                />
                Mark as Most Popular
              </label>
            </FormField>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Coins size={18} /> {submitting ? 'Saving...' : modal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

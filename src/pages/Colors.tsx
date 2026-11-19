import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { colorsApi } from '../api/endpoints'
import { confirmDeleteItem } from '../utils/adminConfirm'
import type { Color } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'

type FormState = { name: string; code: string; status: boolean }
const initialForm: FormState = { name: '', code: '#000000', status: true }

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message
  }
  return fallback
}

export function Colors() {
  const [data, setData] = useState<Color[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [modalError, setModalError] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  const load = (term = debouncedSearch) => {
    setLoading(true)
    setError('')
    colorsApi
      .getAll({ search: term.trim() || undefined })
      .then((res) => {
        const body = res.data as { data?: Color[] | { list?: Color[] } }
        const list = Array.isArray(body.data)
          ? body.data
          : body.data && typeof body.data === 'object' && 'list' in body.data
            ? body.data.list ?? []
            : []
        setData(list)
      })
      .catch(() => setError('Failed to load colors'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const openEdit = (row: Color) => {
    setModalError('')
    setEditingId(row._id)
    setForm({ name: row.name, code: row.code || '#000000', status: Boolean(row.status) })
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
    setModalError('')
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setModalError('')
    try {
      await colorsApi.create({ name: form.name, code: form.code, status: form.status })
      setSuccess('Color created')
      closeModal()
      load()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Create failed')
      setError(msg)
      setModalError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    setSubmitting(true)
    setError('')
    setModalError('')
    try {
      await colorsApi.update(editingId, { name: form.name, code: form.code, status: form.status })
      setSuccess('Color updated')
      closeModal()
      load()
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Update failed')
      setError(msg)
      setModalError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name?: string) => {
    if (!(await confirmDeleteItem(name))) return
    try {
      await colorsApi.delete(id)
      setSuccess('Color deleted')
      load()
    } catch {
      setError('Delete failed')
    }
  }

  const columns: ColumnDef<Color>[] = [
    { header: 'Name', accessorKey: 'name', cell: ({ getValue }) => (getValue() as string).toUpperCase() },
    {
      header: 'Color',
      id: 'color_swatch',
      cell: ({ row }) => (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: '1px solid var(--border)',
            backgroundColor: row.original.code || '#000000',
            display: 'inline-block',
          }}
        />
      ),
    },
    {
      header: 'Code',
      accessorKey: 'code',
      cell: ({ row }) => (
        <span style={{ fontFamily: 'var(--font-mono)' }}>{row.original.code || '-'}</span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) =>
        getValue() ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)}>
            <Pencil size={16} />
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, (row.original.name || '').toUpperCase())}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ]

  if (loading && data.length === 0 && !search) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Colors</h1>
          <p className="page-subtitle">Get, add, update and delete colors.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={18} /> Add Color
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search colors..."
        serverSearch={{ value: search, onChange: setSearch }}
      />

      {modal && (
        <Modal title={modal === 'create' ? 'Create Color' : 'Update Color'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <FormField label="Name" required>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Pick color" required>
              <input
                type="color"
                className="input"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Color code">
              <div
                className="input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 42,
                  background: 'var(--bg-elevated)',
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    backgroundColor: form.code || '#000000',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{form.code || '-'}</span>
              </div>
            </FormField>
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

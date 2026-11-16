import { useState, useEffect } from 'react'
import { testimonialMastersApi } from '../api/endpoints'
import { confirmDeleteItem } from '../utils/adminConfirm'
import type { TestimonialMaster } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const

type TestimonialFormState = {
  name: string
  designation: string
  message: string
  rating: number
  status: 'ACTIVE' | 'INACTIVE'
}

const initialForm: TestimonialFormState = {
  name: '',
  designation: '',
  message: '',
  rating: 5,
  status: 'ACTIVE',
}

export function Testimonials() {
  const [data, setData] = useState<TestimonialMaster[]>([])
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
    testimonialMastersApi
      .getAll()
      .then((res) => {
        const d = (res.data as { data?: TestimonialMaster[] | { list?: TestimonialMaster[] } })?.data
        const list = Array.isArray(d) ? d : (d && typeof d === 'object' && 'list' in d ? (d as { list?: TestimonialMaster[] }).list ?? [] : [])
        setData(Array.isArray(list) ? list : [])
      })
      .catch(() => setError('Failed to load testimonials'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const openEdit = (row: TestimonialMaster) => {
    setEditingId(row._id)
    setForm({
      name: row.name,
      designation: row.designation ?? '',
      message: row.message,
      rating: row.rating,
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
      await testimonialMastersApi.create(form)
      setSuccess('Testimonial created')
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
      await testimonialMastersApi.update(editingId, form)
      setSuccess('Testimonial updated')
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
      await testimonialMastersApi.delete(id)
      setSuccess('Deleted')
      load()
    } catch {
      setError('Delete failed')
    }
  }

  const columns: ColumnDef<TestimonialMaster, unknown>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Designation', accessorKey: 'designation', cell: ({ getValue }) => (getValue() as string) || '—' },
    {
      header: 'Message',
      accessorKey: 'message',
      cell: ({ getValue }) => (
        <span style={{ maxWidth: 280 }}>{(getValue() as string)?.slice(0, 60)}{(getValue() as string)?.length > 60 ? '...' : ''}</span>
      ),
    },
    {
      header: 'Rating',
      accessorKey: 'rating',
      cell: ({ getValue }) => (
        <span className="rating-badge">
          <Star size={14} fill="currentColor" /> {(getValue() as number) ?? 0}
        </span>
      ),
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
          {/* <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleRestore(row.original._id)} title="Restore">
            <RotateCcw size={16} />
          </button> */}
        </div>
      ),
    },
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Testimonials</h1>
          <p className="page-subtitle">Manage customer testimonials and reviews.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={18} /> Add Testimonial
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <DataTable data={data} columns={columns} searchPlaceholder="Search testimonials..." />

      {modal && (
        <Modal title={modal === 'create' ? 'Create Testimonial' : 'Edit Testimonial'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <FormField label="Name" required>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Customer name"
                required
              />
            </FormField>

            <FormField label="Designation" hint="e.g. CEO, Manager, Customer">
              <input
                type="text"
                className="input"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                placeholder="Designation or job title"
              />
            </FormField>

            <FormField label="Message" required>
              <textarea
                className="textarea"
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Share the testimonial text..."
                required
              />
            </FormField>

            <div className="form-row">
              <FormField label="Rating" hint="1–5 stars" required>
                <select
                  className="select"
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
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

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Star size={18} /> {submitting ? 'Saving...' : modal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

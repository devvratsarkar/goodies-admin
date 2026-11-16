import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'

import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { questionsApi, serviceCategoriesApi } from '../api/endpoints'
import { adminConfirm, confirmDeleteItem } from '../utils/adminConfirm'
import type { ServiceCategory, ServiceQuestion, ServiceQuestionType } from '../types/api'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const
const TYPE_OPTIONS: Array<{ value: ServiceQuestionType; label: string }> = [
  { value: 'text', label: 'text' },
  { value: 'textarea', label: 'textarea' },
  { value: 'number', label: 'number' },
  { value: 'dropdown', label: 'dropdown' },
  { value: 'radio', label: 'radio' },
  { value: 'checkbox', label: 'checkbox' },
  { value: 'date', label: 'date' },
  { value: 'time', label: 'time' },
  { value: 'datetime', label: 'date & t ime' },
  { value: 'file', label: 'file' },
]

type QuestionFormState = {
  label: string
  key: string
  type: ServiceQuestionType
  service_id: string
  step: number
  order: number
  is_required: boolean
  is_multiple: boolean
  placeholder: string
  status: 'ACTIVE' | 'INACTIVE'
  optionsText: string
}

const initialForm: QuestionFormState = {
  label: '',
  key: '',
  type: 'text',
  service_id: '',
  step: 1,
  order: 0,
  is_required: true,
  is_multiple: false,
  placeholder: '',
  status: 'ACTIVE',
  optionsText: '',
}

function slugifyValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseOptions(text: string): Array<{ label: string; value: string }> {
  const lines = text
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)

  const out: Array<{ label: string; value: string }> = []
  const seen = new Set<string>()

  for (const line of lines) {
    // Allow "Label = value" or "Label: value" or "Label|value"
    const parts = line.split(/\s*(=|:|\|)\s*/).filter((p) => p !== '=' && p !== ':' && p !== '|')
    const label = (parts[0] ?? '').trim()
    if (!label) continue
    const value = (parts[1] ?? '').trim() || slugifyValue(label)
    if (!value) continue
    if (seen.has(value)) continue
    seen.add(value)
    out.push({ label, value })
  }

  return out
}

function formatOptions(options: unknown): string {
  if (!Array.isArray(options)) return ''
  // Support both legacy string[] and new {label,value}[]
  if (options.every((o) => typeof o === 'string')) return (options as string[]).join('\n')
  return (options as Array<{ label?: unknown; value?: unknown }>)
    .map((o) => {
      const label = String(o?.label ?? '').trim()
      const value = String(o?.value ?? '').trim()
      if (!label && !value) return ''
      if (!value || slugifyValue(label) === value) return label || value
      return `${label} = ${value}`
    })
    .filter(Boolean)
    .join('\n')
}

export function ServiceQuestions() {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [serviceId, setServiceId] = useState('')

  const [data, setData] = useState<ServiceQuestion[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<ServiceQuestion | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<QuestionFormState>(initialForm)

  const serviceTitle = useMemo(() => {
    if (!serviceId) return '—'
    return categories.find((c) => c._id === serviceId)?.title ?? serviceId
  }, [categories, serviceId])

  const loadCategories = async () => {
    try {
      const res = await serviceCategoriesApi.getAll({ page: 1, limit: 1000 })
      const body = res.data as { data?: { list?: ServiceCategory[] } | ServiceCategory[] }
      const dataNode = body?.data
      const list = Array.isArray(dataNode)
        ? dataNode
        : (dataNode as { list?: ServiceCategory[] } | undefined)?.list ?? []
      setCategories(Array.isArray(list) ? list : [])
    } catch {
      setCategories([])
    }
  }

  const fetchQuestions = async (opts: { service_id: string; page: number; limit: number }) => {
    setLoading(true)
    setError('')
    try {
      const res = await questionsApi.getAll({ service_id: opts.service_id, page: opts.page, limit: opts.limit })
      const body = res.data as { data?: { list?: ServiceQuestion[]; pagination?: { total?: number; page?: number; limit?: number } } }
      const list = body?.data?.list ?? []
      const pagination = body?.data?.pagination
      setData(Array.isArray(list) ? list : [])
      setTotalCount(pagination?.total ?? (Array.isArray(list) ? list.length : 0))
      setPageIndex(Math.max(0, (pagination?.page ?? opts.page) - 1))
      setPageSize(pagination?.limit ?? opts.limit)
    } catch {
      setError('Failed to load questions')
      setData([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (!serviceId) return
    fetchQuestions({ service_id: serviceId, page: 1, limit: pageSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId])

  const openCreate = () => {
    setEditing(null)
    setForm((f) => ({ ...initialForm, service_id: serviceId || f.service_id }))
    setModal('create')
  }

  const openEdit = (q: ServiceQuestion) => {
    setEditing(q)
    const sid = typeof q.service_id === 'object' && q.service_id
      ? (q.service_id as { _id?: string })._id ?? ''
      : String(q.service_id ?? '')
    setForm({
      label: q.label ?? '',
      key: q.key ?? '',
      type: (q.type ?? 'text') as ServiceQuestionType,
      service_id: sid || serviceId,
      step: Number(q.step ?? 1),
      order: Number(q.order ?? 0),
      is_required: Boolean(q.is_required ?? true),
      is_multiple: Boolean(q.is_multiple ?? false),
      placeholder: q.placeholder ?? '',
      status: (q.status ?? 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
      optionsText: formatOptions(q.options),
    })
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditing(null)
    setForm(initialForm)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.service_id) {
      setError('Please select a service')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload: Partial<ServiceQuestion> & { service_id: string } = {
        label: form.label,
        key: form.key,
        type: form.type,
        service_id: form.service_id,
        step: form.step,
        order: form.order,
        is_required: form.is_required,
        is_multiple: form.is_multiple,
        placeholder: form.placeholder || undefined,
        status: form.status,
        options: ['dropdown', 'radio', 'checkbox'].includes(form.type) ? parseOptions(form.optionsText) : [],
      }
      await questionsApi.create(payload)
      setSuccess('Question created')
      closeModal()
      fetchQuestions({ service_id: form.service_id, page: pageIndex + 1, limit: pageSize })
    } catch {
      setError('Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing?._id) return
    setSubmitting(true)
    setError('')
    try {
      const payload: Partial<ServiceQuestion> = {
        label: form.label,
        key: form.key,
        type: form.type,
        step: form.step,
        order: form.order,
        is_required: form.is_required,
        is_multiple: form.is_multiple,
        placeholder: form.placeholder || undefined,
        status: form.status,
        options: ['dropdown', 'radio', 'checkbox'].includes(form.type) ? parseOptions(form.optionsText) : [],
      }
      await questionsApi.update(editing._id, payload)
      setSuccess('Question updated')
      closeModal()
      fetchQuestions({ service_id: serviceId, page: pageIndex + 1, limit: pageSize })
    } catch {
      setError('Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, label?: string) => {
    if (!(await confirmDeleteItem(label))) return
    setError('')
    try {
      await questionsApi.delete(id)
      setSuccess('Deleted')
      fetchQuestions({ service_id: serviceId, page: pageIndex + 1, limit: pageSize })
    } catch {
      setError('Delete failed')
    }
  }

  const handleRestore = async (row: ServiceQuestion) => {
    if (!(await adminConfirm(`Are you sure you want to restore “${row.label || 'this question'}”?`))) return
    setError('')
    try {
      await questionsApi.restore(row._id)
      setSuccess('Restored')
      fetchQuestions({ service_id: serviceId, page: pageIndex + 1, limit: pageSize })
    } catch {
      setError('Restore failed')
    }
  }

  const columns: ColumnDef<ServiceQuestion, unknown>[] = [
    { header: 'Label', accessorKey: 'label' },
    { header: 'Key', accessorKey: 'key' },
    { header: 'Type', accessorKey: 'type' },
    {
      header: 'Options',
      id: 'optionsCount',
      accessorFn: (row) => (Array.isArray(row.options) ? row.options.length : 0),
      cell: ({ getValue }) => String((getValue() as number) ?? 0),
    },
    { header: 'Step', accessorKey: 'step', cell: ({ getValue }) => (getValue() as number) ?? 1 },
    { header: 'Order', accessorKey: 'order', cell: ({ getValue }) => (getValue() as number) ?? 0 },
    {
      header: 'Required',
      accessorKey: 'is_required',
      cell: ({ getValue }) => (getValue() ? <span className="badge badge-success">Yes</span> : <span className="badge badge-danger">No</span>),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const v = (getValue() as string) || '—'
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
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, row.original.label)} title="Delete">
            <Trash2 size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleRestore(row.original)} title="Restore">
            <RotateCcw size={16} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Questions</h1>
          <p className="page-subtitle">Create and manage questions per service.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!serviceId}>
          <Plus size={18} /> Create Question
        </button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <FormField label="Service (Category)" required>
          <select
            className="select"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value)
              setPageIndex(0)
            }}
          >
            <option value="">Select service...</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        </FormField>
      </div>

      {serviceId && loading && <div className="page-loading">Loading...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {serviceId ? (
        <DataTable
          data={data}
          columns={columns}
          searchPlaceholder="Search questions..."
          pageSize={pageSize}
          serverPagination={{
            pageIndex,
            pageSize,
            totalCount,
            onPageChange: (newPageIndex, newPageSize) => {
              fetchQuestions({ service_id: serviceId, page: newPageIndex + 1, limit: newPageSize })
            },
          }}
          headerRight={
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Service: <strong>{serviceTitle}</strong>
            </div>
          }
        />
      ) : (
        <div className="empty-state card" style={{ padding: 24 }}>
          <p>Select a service to view/create questions.</p>
        </div>
      )}

      {modal && (
        <Modal
          title={modal === 'create' ? 'Create Question' : 'Edit Question'}
          onClose={closeModal}
        >
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <FormField label="Service" required>
              <select
                className="select"
                value={form.service_id}
                onChange={(e) => setForm((f) => ({ ...f, service_id: e.target.value }))}
                required
              >
                <option value="">Select service...</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Label" required>
              <input
                type="text"
                className="input"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Company Name"
                required
              />
            </FormField>

            <div className="form-row">
              <FormField label="Key" required hint="Unique field key (snake_case)">
                <input
                  type="text"
                  className="input"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="company_name"
                  required
                />
              </FormField>
              <FormField label="Type" required hint="text | textarea | number | dropdown | radio | checkbox | date | time | date & time | file">
                <select
                  className="select"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ServiceQuestionType }))}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="Step">
                <input
                  type="number"
                  className="input"
                  min={1}
                  value={form.step}
                  onChange={(e) => setForm((f) => ({ ...f, step: Number(e.target.value) || 1 }))}
                />
              </FormField>
              <FormField label="Order" hint="Lower shows first">
                <input
                  type="number"
                  className="input"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
                />
              </FormField>
            </div>

            <FormField label="Placeholder" hint="Optional">
              <input
                type="text"
                className="input"
                value={form.placeholder}
                onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))}
                placeholder="Enter company name"
              />
            </FormField>

            {['dropdown', 'radio', 'checkbox'].includes(form.type) && (
              <FormField label="Options" hint="One per line. Formats: Label OR Label = value">
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                  placeholder={'AC = ac\nMusic System = music\nGPS = gps'}
                />
              </FormField>
            )}

            <div className="form-row">
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
              <FormField label="">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6 }}>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      checked={form.is_required}
                      onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                    />
                    Required
                  </label>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      checked={form.is_multiple}
                      onChange={(e) => setForm((f) => ({ ...f, is_multiple: e.target.checked }))}
                    />
                    Multiple allowed
                  </label>
                </div>
              </FormField>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
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


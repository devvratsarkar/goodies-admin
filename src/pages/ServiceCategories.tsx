import { useState, useEffect, useCallback } from 'react'
import { serviceCategoriesApi } from '../api/endpoints'
import { confirmDeleteItem } from '../utils/adminConfirm'
import type { ServiceCategory } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react'

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE'] as const

type ServiceCategoryFormState = {
  title: string
  description: string
  status: 'ACTIVE' | 'INACTIVE'
  parent_category: string
  individual_credit: string
  company_credit: string
}

const initialForm: ServiceCategoryFormState = {
  title: '',
  description: '',
  status: 'ACTIVE',
  parent_category: '',
  individual_credit: '',
  company_credit: '',
}

export function ServiceCategories() {
  const [data, setData] = useState<ServiceCategory[]>([])
  const [allCategories, setAllCategories] = useState<ServiceCategory[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)

  const fetchPage = useCallback((opts: { page: number; limit: number; search: string }) => {
    const { page: p, limit, search: q } = opts
    setLoading(true)
    setError('')
    serviceCategoriesApi
      .getAll({ page: p, limit, search: q || undefined })
      .then((res) => {
        const body = res.data as {
          data?: {
            list?: ServiceCategory[]
            pagination?: { total?: number; page?: number; limit?: number; totalPages?: number }
          }
        }
        const list = body?.data?.list ?? []
        const pagination = body?.data?.pagination
        setData(Array.isArray(list) ? list : [])
        setTotalCount(pagination?.total ?? list.length)
        setPageIndex(Math.max(0, p - 1))
        setPageSize(limit)
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPage({ page: 1, limit: pageSize, search })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Server-side search (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      fetchPage({ page: 1, limit: pageSize, search })
    }, 350)
    return () => clearTimeout(t)
  }, [search, pageSize, fetchPage])

  const loadAllCategoriesForParent = useCallback(async () => {
    try {
      // Best-effort: load a large chunk so parent dropdown works even with pagination.
      const res = await serviceCategoriesApi.getAll({ page: 1, limit: 1000 })
      const body = res.data as { data?: { list?: ServiceCategory[] } }
      const list = body?.data?.list ?? []
      setAllCategories(Array.isArray(list) ? list : [])
    } catch {
      // If this fails, we fall back to current page's data.
      setAllCategories([])
    }
  }, [])

  const parentOptionsSource = allCategories.length ? allCategories : data
  const parentOptions = parentOptionsSource.filter((c) => c._id !== editingId)

  const openEdit = (row: ServiceCategory) => {
    setEditingId(row._id)
    const parentId = typeof row.parent_category === 'object'
      ? row.parent_category?._id ?? ''
      : (row.parent_category ?? '')
    loadAllCategoriesForParent()
    setForm({
      title: row.title,
      description: row.description ?? '',
      status: row.status,
      parent_category: parentId,
      individual_credit: (() => {
        const r = row as unknown as { credit?: string | number }
        return r.credit != null ? String(r.credit) : ''
      })(),
      company_credit: (() => {
        const r = row as unknown as { company_credit?: string | number }
        return r.company_credit != null ? String(r.company_credit) : ''
      })(),
    })
    setModal('edit')
  }

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
  }

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      individual_credit: form.individual_credit || undefined,
      company_credit: form.company_credit || undefined,
    }
    if (form.parent_category) payload.parent_category = form.parent_category
    return payload
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await serviceCategoriesApi.create(buildPayload() as Partial<ServiceCategory> & { image?: File })
      setSuccess('Category created')
      closeModal()
      fetchPage({ page: pageIndex + 1, limit: pageSize, search })
    } catch {
      setError('Create failed')
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
      await serviceCategoriesApi.update(editingId, buildPayload() as Partial<ServiceCategory> & { image?: File })
      setSuccess('Category updated')
      closeModal()
      fetchPage({ page: pageIndex + 1, limit: pageSize, search })
    } catch {
      setError('Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, title?: string) => {
    if (!(await confirmDeleteItem(title))) return
    try {
      await serviceCategoriesApi.delete(id)
      setSuccess('Deleted')
      fetchPage({ page: pageIndex + 1, limit: pageSize, search })
    } catch {
      setError('Delete failed')
    }
  }

  const getParentTitle = (val: unknown) => {
    if (typeof val === 'object' && val && 'title' in val) return (val as { title?: string }).title ?? '—'
    const id = val as string
    return data.find((c) => c._id === id)?.title ?? id ?? '—'
  }

  const columns: ColumnDef<ServiceCategory, unknown>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)} title="Edit">
            <Pencil size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, row.original.title)} title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
    { header: 'Title', accessorKey: 'title' },
    {
      header: 'Description',
      accessorKey: 'description',
      cell: ({ getValue }) => {
        const v = (getValue() as string) ?? ''
        return <span style={{ maxWidth: 200 }}>{v.slice(0, 50)}{v.length > 50 ? '...' : ''}</span>
      },
    },
    {
      header: 'Parent',
      accessorKey: 'parent_category',
      cell: ({ getValue }) => getParentTitle(getValue()),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return <span className={v === 'ACTIVE' ? 'badge badge-success' : 'badge badge-danger'}>{v}</span>
      },
    },
  
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Categories</h1>
          <p className="page-subtitle">Manage service categories and their options.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            loadAllCategoriesForParent()
            setModal('create')
          }}
        >
          <Plus size={18} /> Add Category
        </button>
      </div>

      {loading && <div className="page-loading">Loading...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search categories..."
        pageSize={pageSize}
        serverSearch={{ value: search, onChange: setSearch }}
        serverPagination={{
          pageIndex,
          pageSize,
          totalCount,
          onPageChange: (newPageIndex, newPageSize) => {
            fetchPage({ page: newPageIndex + 1, limit: newPageSize, search })
          },
        }}
      />

      {modal && (
        <Modal title={modal === 'create' ? 'Create Category' : 'Edit Category'} onClose={closeModal}>
          <form onSubmit={modal === 'create' ? handleCreate : handleUpdate}>
            <FormField label="Title" required>
              <input
                type="text"
                className="input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Category title"
                required
              />
            </FormField>

            <FormField label="Description">
              <textarea
                className="textarea"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Category description"
              />
            </FormField>

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
              <FormField label="Parent Category">
                <select
                  className="select"
                  value={form.parent_category}
                  onChange={(e) => setForm((f) => ({ ...f, parent_category: e.target.value }))}
                >
                  <option value="">None (root category)</option>
                  {parentOptions.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-row">
              <FormField label="Individual Credit" hint="Optional">
                <input
                  type="text"
                  className="input"
                  value={form.individual_credit}
                  onChange={(e) => setForm((f) => ({ ...f, individual_credit: e.target.value }))}
                  placeholder="Individual credit value"
                />
              </FormField>
              <FormField label="Company Credit" hint="Optional">
                <input
                  type="text"
                  className="input"
                  value={form.company_credit}
                  onChange={(e) => setForm((f) => ({ ...f, company_credit: e.target.value }))}
                  placeholder="Company credit value"
                />
              </FormField>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <FolderTree size={18} /> {submitting ? 'Saving...' : modal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import { Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { sizesApi } from '../api/endpoints'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { slugify } from '../utils/slugify'
import type { Size } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useModuleCan } from '../components/rbac/useModuleCan'

type FormState = { name: string; slug: string; status: boolean }
type StatusFilter = 'all' | 'active' | 'inactive'

const initialForm: FormState = { name: '', slug: '', status: true }

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

function formatDateLabel(value?: string | null) {
  if (!value) return null
  const date = moment(value)
  return date.isValid() ? date.format('D MMM YYYY, h:mm A') : null
}

function sizeLabel(name?: string) {
  return (name ?? '').trim().toUpperCase()
}

function parseSizeList(payload: unknown): Size[] {
  const body = payload as { data?: Size[] | { list?: Size[] }; list?: Size[] }
  if (Array.isArray(body?.data)) return body.data
  if (body?.data && typeof body.data === 'object' && 'list' in body.data) return body.data.list ?? []
  if (Array.isArray(body?.list)) return body.list
  return []
}

export function Sizes({ trash = false }: { trash?: boolean }) {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModuleCan('sizes')
  const [data, setData] = useState<Size[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({})
  const [modalError, setModalError] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [togglingId, setTogglingId] = useState('')
  const [restoringId, setRestoringId] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)

  const load = useCallback(() => {
    const searchValue = debouncedSearch.trim() || undefined
    const statusValue = trash || statusFilter === 'all' ? undefined : statusFilter

    setLoading(true)
    setError('')
    const request = trash
      ? sizesApi.getTrash({ search: searchValue })
      : sizesApi.getAll({ search: searchValue, status: statusValue })
    request
      .then((res) => setData(parseSizeList(res.data)))
      .catch(() => setError(trash ? 'Failed to load trashed sizes' : 'Failed to load sizes'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, statusFilter, trash])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, statusFilter, trash])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), 3200)
    return () => window.clearTimeout(timer)
  }, [success])

  const openEdit = useCallback((row: Size) => {
    setModalError('')
    setFieldErrors({})
    setEditingId(row._id)
    setForm({ name: sizeLabel(row.name), slug: row.slug ?? '', status: Boolean(row.status) })
    setSlugTouched(false)
    setModal('edit')
  }, [])

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
    setFieldErrors({})
    setModalError('')
    setSlugTouched(false)
  }

  const saveSize = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = sizeLabel(form.name)
    const slug = slugify(form.slug)
    const nextErrors: { name?: string; slug?: string } = {}
    if (!name) nextErrors.name = 'Enter a size name.'
    if (!slug) nextErrors.slug = 'Enter a slug.'
    setFieldErrors(nextErrors)
    setModalError('')
    if (nextErrors.name || nextErrors.slug) {
      document.getElementById(nextErrors.name ? 'size-name' : 'size-slug')?.focus()
      return
    }
    if (modal === 'edit' && !editingId) return

    setSubmitting(true)
    setError('')
    try {
      const payload = { name, slug, status: form.status }
      if (modal === 'edit' && editingId) {
        await sizesApi.update(editingId, payload)
        setSuccess('Size updated')
      } else {
        await sizesApi.create(payload)
        setSuccess('Size created')
      }
      closeModal()
      load()
    } catch (err) {
      const message = getApiErrorMessage(err, modal === 'edit' ? 'Update failed' : 'Create failed')
      setError(message)
      setModalError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = useCallback(async (row: Size, next: boolean) => {
    if (!canEdit) return
    setTogglingId(row._id)
    setError('')
    setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: next } : item)))
    try {
      await sizesApi.update(row._id, { status: next })
      setSuccess(next ? 'Size activated' : 'Size deactivated')
    } catch (err) {
      setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: !next } : item)))
      setError(getApiErrorMessage(err, 'Failed to update status'))
    } finally {
      setTogglingId('')
    }
  }, [canEdit])

  const handleDelete = useCallback(async (id: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Move this size to trash? You can restore it from Size trash.'))) return
    try {
      await sizesApi.delete(id)
      setSuccess('Size moved to trash')
      load()
    } catch {
      setError('Delete failed')
    }
  }, [canDelete, load])

  const handleRestore = useCallback(async (row: Size) => {
    if (!canEdit) return
    if (!(await adminConfirm(`Are you sure you want to restore “${(row.name || '').toUpperCase()}”?`))) return
    setRestoringId(row._id)
    setError('')
    try {
      await sizesApi.restore(row._id)
      setSuccess('Size restored')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Restore failed'))
    } finally {
      setRestoringId('')
    }
  }, [canEdit, load])

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const columns: GridColDef<Size>[] = useMemo(
    () => [
      {
        field: 'actions',
        headerName: 'Actions',
        width: trash ? 72 : 96,
        minWidth: trash ? 72 : 96,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        cellClassName: 'products-actions-cell',
        renderCell: ({ row }) =>
          trash ? (
            <div className="table-actions" onClick={(event) => event.stopPropagation()}>
              {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                title="Restore size"
                aria-label="Restore size"
                disabled={restoringId === row._id}
                onClick={() => handleRestore(row)}
              >
                <RotateCcw size={16} />
              </button>
              )}
            </div>
          ) : (
            <div className="table-actions" onClick={(event) => event.stopPropagation()}>
              {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
                title="Edit size"
                aria-label="Edit size"
                onClick={() => openEdit(row)}
              >
                <Pencil size={16} />
              </button>
              )}
              {canDelete && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete"
                title="Move to trash"
                aria-label="Move to trash"
                onClick={() => handleDelete(row._id)}
              >
                <Trash2 size={16} />
              </button>
              )}
            </div>
          ),
      },
      {
        field: 'name',
        headerName: 'Size',
        flex: 1.6,
        minWidth: 180,
        valueGetter: (_, row) => sizeLabel(row.name),
        renderCell: ({ row }) => {
          const name = sizeLabel(row.name) || '—'
          return (
            <div className="product-cell" title={name}>
              <div className="product-cell__text">
                <span className="product-cell__title">{name}</span>
              </div>
            </div>
          )
        },
      },
      ...(trash
        ? []
        : ([
            {
              field: 'status',
              headerName: 'Status',
              width: 90,
              minWidth: 90,
              sortable: false,
              align: 'center',
              headerAlign: 'center',
              valueGetter: (_, row) => (row.status ? 'Active' : 'Inactive'),
              renderCell: ({ row }) => {
                const active = Boolean(row.status)
                const busy = togglingId === row._id
                return (
                  <Tooltip title={active ? 'Active (click to deactivate)' : 'Inactive (click to activate)'} arrow placement="top">
                    <label
                      className="toggle-switch toggle-switch--sm"
                      style={{ cursor: !canEdit ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: !canEdit || busy ? 0.7 : 1, paddingTop: 0, flex: 'none' }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        aria-label={active ? 'Deactivate size' : 'Activate size'}
                        disabled={!canEdit || busy}
                        onChange={() => toggleStatus(row, !active)}
                      />
                      <span className="toggle-switch-track" aria-hidden>
                        <span className="toggle-switch-thumb" />
                      </span>
                    </label>
                  </Tooltip>
                )
              },
            },
          ] satisfies GridColDef<Size>[])),
      {
        field: 'slug',
        headerName: 'Slug',
        flex: 1,
        minWidth: 140,
        renderCell: ({ row }) => (
          <span
            className="product-cell__meta"
            title={row.slug || undefined}
            style={{ display: 'block', width: '100%', minWidth: 0 }}
          >
            {row.slug || '—'}
          </span>
        ),
      },
      {
        field: 'totalProducts',
        headerName: 'Products',
        width: 100,
        minWidth: 100,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (_, row) => row.totalProducts ?? 0,
        renderCell: ({ row }) => {
          const count = row.totalProducts ?? 0
          const name = sizeLabel(row.name)
          return (
            <button
              type="button"
              className="cat-count cat-count--link"
              title={`View products in size ${name}`}
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/products?size=${encodeURIComponent(row.name)}`)
              }}
            >
              {count.toLocaleString()}
            </button>
          )
        },
      },
      ...(trash
        ? ([
            {
              field: 'deletedAt',
              headerName: 'Deleted',
              width: 190,
              minWidth: 160,
              valueGetter: (_, row) => row.deletedAt ?? '',
              renderCell: ({ row }) => {
                const label = formatDateLabel(row.deletedAt)
                if (!label) return <span className="product-cell__meta">—</span>
                return (
                  <div className="product-cell__text" title={label}>
                    <span className="product-cell__title" style={{ fontWeight: 500 }}>
                      {label}
                    </span>
                  </div>
                )
              },
            },
          ] satisfies GridColDef<Size>[])
        : []),
    ],
    [canDelete, canEdit, handleDelete, handleRestore, navigate, openEdit, restoringId, toggleStatus, togglingId, trash],
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{trash ? 'Size trash' : 'Sizes'}</h1>
          <p className="page-subtitle">
            {trash ? 'Soft-deleted sizes. Restore one to put it back in the catalog.' : 'Get, add, update and delete sizes.'}
          </p>
        </div>
        {trash ? (
          <button type="button" className="btn" onClick={() => navigate('/sizes')}>
            Back to sizes
          </button>
        ) : (canDelete || canCreate) ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canDelete && (
            <button type="button" className="btn" onClick={() => navigate('/sizes/trash')}>
              <Trash2 size={18} /> Trash
            </button>
            )}
            {canCreate && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setForm(initialForm)
                setFieldErrors({})
                setModalError('')
                setSlugTouched(false)
                setEditingId(null)
                setModal('create')
              }}
            >
              <Plus size={18} /> Add Size
            </button>
            )}
          </div>
        ) : null}
      </div>
      {error && (
        <div className="alert alert-error alert-row">
          <span>{error}</span>
          <button type="button" className="modal-close" onClick={() => setError('')} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-row">
          <span>{success}</span>
          <button type="button" className="modal-close" onClick={() => setSuccess('')} aria-label="Dismiss success">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="card">
        <div className="categories-toolbar">
          {!trash && (
            <div className="categories-toolbar__tabs" role="group" aria-label="Size status">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`categories-toolbar__tab${statusFilter === filter.id ? ' is-active' : ''}`}
                  aria-pressed={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
          <label className="categories-toolbar__search">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              placeholder="Search name or slug..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search name or slug"
            />
          </label>
        </div>
        <div className="table-wrap">
          <MuiDataTable
            rows={data}
            columns={columns}
            getRowId={(row) => String(row._id)}
            loading={loading}
            paginationMode="client"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={handlePageChange}
            pageSizeOptions={[10, 25, 50, 100]}
            density="compact"
            showIndex
          />
        </div>
      </div>

      {!trash && modal && (
        <Modal title={modal === 'create' ? 'Create Size' : 'Update Size'} onClose={closeModal}>
          <form noValidate className="modal-form" onSubmit={saveSize}>
            <p className="brand-form__lead">
              {modal === 'create'
                ? 'Add a size name. The slug fills in from the name until you edit it.'
                : 'Update the name, slug, and whether this size is shown in the store.'}
            </p>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <FormField label="Name" htmlFor="size-name" required error={fieldErrors.name}>
              <input
                id="size-name"
                className={`input${fieldErrors.name ? ' is-invalid' : ''}`}
                value={form.name}
                autoFocus
                onChange={(e) => {
                  const name = e.target.value.toUpperCase()
                  setFieldErrors((current) => ({ ...current, name: undefined }))
                  setForm((p) => ({
                    ...p,
                    name,
                    slug: slugTouched && p.slug.trim() ? p.slug : slugify(name),
                  }))
                }}
              />
            </FormField>
            <FormField
              label="Slug"
              htmlFor="size-slug"
              required
              hint="Used in store links. Change it only if you want a custom address."
              error={fieldErrors.slug}
            >
              <input
                id="size-slug"
                className={`input${fieldErrors.slug ? ' is-invalid' : ''}`}
                value={form.slug}
                onChange={(e) => {
                  const slug = slugify(e.target.value, { trim: false })
                  setSlugTouched(slug.trim().length > 0)
                  setFieldErrors((current) => ({ ...current, slug: undefined }))
                  setForm((p) => ({ ...p, slug }))
                }}
                onBlur={() => setForm((current) => ({ ...current, slug: slugify(current.slug) }))}
              />
            </FormField>
            <label className="categories-toggle-card">
              <span>Active</span>
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.status}
                  aria-label={form.status ? 'Deactivate size' : 'Activate size'}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))}
                />
                <span className="toggle-switch-track" aria-hidden>
                  <span className="toggle-switch-thumb" />
                </span>
              </span>
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>
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

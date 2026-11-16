import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import { Eye, ImageOff, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { categoriesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { getProfileImageUrl } from '../api/client'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import type { Category } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useModuleCan } from '../components/rbac/useModuleCan'

type StatusFilter = 'all' | 'active' | 'inactive'

const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

function splitBilingual(value?: string | null): { primary: string; secondary?: string } {
  const text = (value ?? '').trim()
  if (!text) return { primary: '—' }
  const firstArabic = text.search(ARABIC_SCRIPT)
  if (firstArabic > 0) {
    return {
      primary: text.slice(0, firstArabic).trim() || text,
      secondary: text.slice(firstArabic).trim() || undefined,
    }
  }
  return { primary: text }
}

function formatDateLabel(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function CategoryThumb({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  const resolved = src ? getProfileImageUrl(src) : undefined

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!resolved || failed) {
    return (
      <span className="product-cell__thumb product-cell__thumb--empty" aria-hidden>
        <ImageOff size={14} />
      </span>
    )
  }

  return <img src={resolved} alt={alt} className="product-cell__thumb" onError={() => setFailed(true)} />
}

function storeCategoryUrl(slug?: string) {
  const origin =
    (import.meta.env.VITE_STORE_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://goodies-jade.vercel.app'
  const path = (slug || '').trim()
  if (!path) return ''
  return `${origin}/product-category/${encodeURIComponent(path)}`
}

function parseCategoryList(payload: unknown): Category[] {
  const body = payload as { data?: Category[] | { list?: Category[] }; list?: Category[] }
  if (Array.isArray(body?.data)) return body.data
  if (body?.data && typeof body.data === 'object' && 'list' in body.data) return body.data.list ?? []
  if (Array.isArray(body?.list)) return body.list
  return []
}

export function Categories({ trash = false }: { trash?: boolean }) {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModuleCan('categories')
  const [data, setData] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [parentOptions, setParentOptions] = useState<Category[]>([])
  const [togglingKey, setTogglingKey] = useState('')
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
      ? categoriesApi.getTrash({ search: searchValue })
      : categoriesApi.getAllCategories({ search: searchValue, status: statusValue })
    request
      .then((res) => {
        const list = parseCategoryList(res.data)
        setData(list)
        if (!trash && !searchValue && !statusValue) setParentOptions(list)
      })
      .catch(() => setError(trash ? 'Failed to load trashed categories' : 'Failed to load categories'))
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

  const toggleCategory = useCallback(async (row: Category, field: 'status' | 'is_mega_menu', next: boolean) => {
    if (!canEdit) return
    const key = `${row._id}-${field}`
    setTogglingKey(key)
    setError('')
    setData((current) => current.map((item) => (item._id === row._id ? { ...item, [field]: next } : item)))
    try {
      await categoriesApi.update(row._id, { [field]: next })
      await revalidateStore([
        'categories',
        'home',
        'category',
        ...(row.slug ? [{ page: 'category' as const, slug: row.slug }] : []),
      ])
      setSuccess(
        field === 'status'
          ? next
            ? 'Category activated'
            : 'Category deactivated'
          : next
            ? 'Added to homepage'
            : 'Removed from homepage',
      )
    } catch {
      setData((current) => current.map((item) => (item._id === row._id ? { ...item, [field]: !next } : item)))
      setError(field === 'status' ? 'Failed to update status' : 'Failed to update homepage')
    } finally {
      setTogglingKey('')
    }
  }, [canEdit])

  const handleDelete = useCallback(async (id: string, slug?: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Move this category to trash? You can restore it from Category trash.'))) return
    try {
      await categoriesApi.delete(id)
      await revalidateStore([
        'categories',
        'home',
        'category',
        ...(slug ? [{ page: 'category' as const, slug }] : []),
      ])
      setSuccess('Category moved to trash')
      load()
    } catch {
      setError('Delete failed')
    }
  }, [canDelete, load])

  const handleRestore = useCallback(async (row: Category) => {
    if (!canEdit) return
    if (!(await adminConfirm(`Are you sure you want to restore “${splitBilingual(row.name).primary}”?`))) return
    setRestoringId(row._id)
    setError('')
    try {
      await categoriesApi.restore(row._id)
      await revalidateStore([
        'categories',
        'home',
        'category',
        ...(row.slug ? [{ page: 'category' as const, slug: row.slug }] : []),
      ])
      setSuccess('Category restored')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Restore failed'))
    } finally {
      setRestoringId('')
    }
  }, [canEdit, load])

  const parentName = useCallback(
    (row: Category) => {
      const parent = row.parent_category
      if (parent && typeof parent === 'object' && parent.name) return parent.name
      if (typeof parent === 'string' && parent) {
        return (parentOptions.length ? parentOptions : data).find((category) => category._id === parent)?.name ?? ''
      }
      return ''
    },
    [data, parentOptions],
  )

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const columns: GridColDef<Category>[] = useMemo(
    () => [
      {
        field: 'actions',
        headerName: 'Actions',
        width: trash ? 72 : 120,
        minWidth: trash ? 72 : 120,
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
                title="Restore category"
                aria-label="Restore category"
                disabled={restoringId === row._id}
                onClick={() => handleRestore(row)}
              >
                <RotateCcw size={16} />
              </button>
              )}
            </div>
          ) : (
            <div className="table-actions" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon action-icon action-icon--view"
                title="View on store"
                aria-label="View on store"
                disabled={!row.slug}
                onClick={() => {
                  const url = storeCategoryUrl(row.slug)
                  if (url) window.open(url, '_blank', 'noopener,noreferrer')
                }}
              >
                <Eye size={16} />
              </button>
              {canEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
                title="Edit category"
                aria-label="Edit category"
                onClick={() => navigate(`/categories/${row._id}/edit`)}
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
                onClick={() => handleDelete(row._id, row.slug)}
              >
                <Trash2 size={16} />
              </button>
              )}
            </div>
          ),
      },
      {
        field: 'name',
        headerName: 'Category',
        flex: 1.6,
        minWidth: 220,
        valueGetter: (_, row) => row.name,
        renderCell: ({ row }) => {
          const { primary, secondary } = splitBilingual(row.name)
          return (
            <div className="product-cell" title={secondary ? `${primary}\n${secondary}` : primary}>
              <CategoryThumb src={row.image ?? undefined} alt={primary} />
              <div className="product-cell__text">
                <span className="product-cell__title">{primary}</span>
                {secondary ? (
                  <span className="product-cell__meta" dir="rtl">
                    {secondary}
                  </span>
                ) : null}
              </div>
            </div>
          )
        },
      },
      ...(trash
        ? []
        : ([
            {
              field: 'is_mega_menu',
              headerName: 'Homepage',
              width: 110,
              minWidth: 110,
              sortable: false,
              align: 'center',
              headerAlign: 'center',
              valueGetter: (_, row) => (row.is_mega_menu ? 'Yes' : 'No'),
              renderCell: ({ row }) => {
                const onHome = Boolean(row.is_mega_menu)
                const busy = togglingKey === `${row._id}-is_mega_menu`
                return (
                  <Tooltip title={onHome ? 'On homepage (click to remove)' : 'Add to homepage'} arrow placement="top">
                    <label
                      className="toggle-switch toggle-switch--sm"
                      style={{ cursor: !canEdit ? 'not-allowed' : busy ? 'wait' : 'pointer', opacity: !canEdit || busy ? 0.7 : 1, paddingTop: 0, flex: 'none' }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={onHome}
                        aria-label={onHome ? 'Remove from homepage' : 'Add to homepage'}
                        disabled={!canEdit || busy}
                        onChange={() => toggleCategory(row, 'is_mega_menu', !onHome)}
                      />
                      <span className="toggle-switch-track" aria-hidden>
                        <span className="toggle-switch-thumb" />
                      </span>
                    </label>
                  </Tooltip>
                )
              },
            },
            {
              field: 'status',
              headerName: 'Status',
              width: 90,
              minWidth: 90,
              sortable: false,
              align: 'center',
              headerAlign: 'center',
              valueGetter: (_, row) => (row.status !== false ? 'Active' : 'Inactive'),
              renderCell: ({ row }) => {
                const active = row.status !== false
                const busy = togglingKey === `${row._id}-status`
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
                        aria-label={active ? 'Deactivate category' : 'Activate category'}
                        disabled={!canEdit || busy}
                        onChange={() => toggleCategory(row, 'status', !active)}
                      />
                      <span className="toggle-switch-track" aria-hidden>
                        <span className="toggle-switch-thumb" />
                      </span>
                    </label>
                  </Tooltip>
                )
              },
            },
          ] satisfies GridColDef<Category>[])),
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
        field: 'parent',
        headerName: 'Parent',
        flex: 0.8,
        minWidth: 120,
        sortable: false,
        valueGetter: (_, row) => parentName(row),
        renderCell: ({ row }) => {
          const name = parentName(row)
          if (!name) return <span className="product-cell__meta">—</span>
          const { primary, secondary } = splitBilingual(name)
          return (
            <span
              className="product-cell__title"
              title={secondary ? `${primary} ${secondary}` : primary}
              style={{ display: 'block', width: '100%', minWidth: 0, fontWeight: 500 }}
            >
              {primary}
            </span>
          )
        },
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
          return (
            <button
              type="button"
              className="cat-count cat-count--link"
              title={`View products in ${splitBilingual(row.name).primary}`}
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/products?categoryId=${encodeURIComponent(row._id)}`)
              }}
            >
              {count.toLocaleString()}
            </button>
          )
        },
      },
      {
        field: trash ? 'deletedAt' : 'createdAt',
        headerName: trash ? 'Deleted' : 'Created',
        width: 190,
        minWidth: 160,
        valueGetter: (_, row) => (trash ? row.deletedAt : row.createdAt) ?? '',
        renderCell: ({ row }) => {
          const label = formatDateLabel(trash ? row.deletedAt : row.createdAt)
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
    ],
    [canDelete, canEdit, handleDelete, handleRestore, navigate, parentName, restoringId, toggleCategory, togglingKey, trash],
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{trash ? 'Category trash' : 'Categories'}</h1>
          <p className="page-subtitle">
            {trash
              ? 'Soft-deleted categories. Restore one to put it back in the catalog.'
              : 'Organize catalog sections, images, and SEO.'}
          </p>
        </div>
        {trash ? (
          <button type="button" className="btn" onClick={() => navigate('/categories')}>
            Back to categories
          </button>
        ) : (canDelete || canCreate) ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canDelete && (
            <button type="button" className="btn" onClick={() => navigate('/categories/trash')}>
              <Trash2 size={18} /> Trash
            </button>
            )}
            {canCreate && (
            <button type="button" className="btn btn-primary" onClick={() => navigate('/categories/new')}>
              <Plus size={18} /> Add Category
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
            <div className="categories-toolbar__tabs" role="group" aria-label="Category status">
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
              placeholder="Search name, slug, or parent..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search name, slug, or parent"
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
    </>
  )
}

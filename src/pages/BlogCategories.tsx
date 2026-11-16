import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import Tooltip from '@mui/material/Tooltip'
import { Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { blogCategoriesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { slugify } from '../utils/slugify'
import type { BlogCategory } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { imageFieldValue } from '../components/media/ImageSourceField'
import { SearchAndSocialCard } from '../components/products/SearchAndSocialCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useModuleCan } from '../components/rbac/useModuleCan'

type StatusFilter = 'all' | 'active' | 'inactive'

type FormState = {
  name: string
  slug: string
  status: boolean
  canonical_url: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  og_title: string
  og_description: string
  og_type: string
  twitter_title: string
  twitter_description: string
  schema: string
}

const initialForm: FormState = {
  name: '',
  slug: '',
  status: true,
  canonical_url: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  og_type: '',
  twitter_title: '',
  twitter_description: '',
  schema: '',
}

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

function parseBlogCategoryList(payload: unknown): BlogCategory[] {
  const body = payload as { data?: BlogCategory[] | { list?: BlogCategory[] }; list?: BlogCategory[] }
  if (Array.isArray(body?.data)) return body.data
  if (body?.data && typeof body.data === 'object' && 'list' in body.data) return body.data.list ?? []
  if (Array.isArray(body?.list)) return body.list
  return []
}

function appendImage(data: FormData, key: string, file: File | null, url: string, existing: string, isEdit: boolean) {
  if (file) data.append(key, file)
  else if (url.trim()) data.append(key, imageFieldValue(url))
  else if (isEdit && existing.trim()) data.append(key, imageFieldValue(existing))
}

const formDataFrom = (
  form: FormState,
  images: {
    ogImage: File | null
    ogImageUrl: string
    existingOgImage: string
    twitterImage: File | null
    twitterImageUrl: string
    existingTwitterImage: string
  },
  isEdit: boolean,
) => {
  const data = new FormData()
  data.append('name', form.name)
  data.append('slug', form.slug)
  data.append('status', String(form.status))
  data.append('canonical_url', form.canonical_url)
  data.append('meta_title', form.meta_title)
  data.append('meta_description', form.meta_description)
  data.append('meta_keywords', form.meta_keywords)
  data.append('og_title', form.og_title)
  data.append('og_description', form.og_description)
  data.append('og_type', form.og_type)
  data.append('twitter_title', form.twitter_title)
  data.append('twitter_description', form.twitter_description)
  data.append('schema', form.schema)
  appendImage(data, 'og_image', images.ogImage, images.ogImageUrl, images.existingOgImage, isEdit)
  appendImage(data, 'twitter_image', images.twitterImage, images.twitterImageUrl, images.existingTwitterImage, isEdit)
  return data
}

export function BlogCategories({ trash = false }: { trash?: boolean }) {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModuleCan('blog-categories')
  const [data, setData] = useState<BlogCategory[]>([])
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
  const [slugTouched, setSlugTouched] = useState(false)
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const [ogImageUrl, setOgImageUrl] = useState('')
  const [existingOgImage, setExistingOgImage] = useState('')
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null)
  const [twitterImageUrl, setTwitterImageUrl] = useState('')
  const [existingTwitterImage, setExistingTwitterImage] = useState('')
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
      ? blogCategoriesApi.getTrash({ search: searchValue })
      : blogCategoriesApi.getAll({ search: searchValue, status: statusValue })
    request
      .then((res) => setData(parseBlogCategoryList(res.data)))
      .catch((err) => setError(getApiErrorMessage(err, trash ? 'Failed to load trashed blog categories' : 'Failed to load blog categories')))
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

  const openCreate = () => {
    setEditingId(null)
    setForm(initialForm)
    setFieldErrors({})
    setSlugTouched(false)
    setOgImageFile(null)
    setOgImageUrl('')
    setExistingOgImage('')
    setTwitterImageFile(null)
    setTwitterImageUrl('')
    setExistingTwitterImage('')
    setModal('create')
  }

  const openEdit = useCallback((row: BlogCategory) => {
    setEditingId(row._id)
    setForm({
      name: row.name,
      slug: row.slug,
      status: Boolean(row.status),
      canonical_url: row.canonical_url ?? '',
      meta_title: row.meta_title ?? '',
      meta_description: row.meta_description ?? '',
      meta_keywords: row.meta_keywords ?? '',
      og_title: row.og_title ?? '',
      og_description: row.og_description ?? '',
      og_type: row.og_type ?? '',
      twitter_title: row.twitter_title ?? '',
      twitter_description: row.twitter_description ?? '',
      schema: row.schema ?? '',
    })
    setFieldErrors({})
    setOgImageFile(null)
    setOgImageUrl('')
    setExistingOgImage(row.og_image || '')
    setTwitterImageFile(null)
    setTwitterImageUrl('')
    setExistingTwitterImage(row.twitter_image || '')
    setSlugTouched(false)
    setModal('edit')
  }, [])

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setForm(initialForm)
    setFieldErrors({})
    setSlugTouched(false)
    setOgImageFile(null)
    setOgImageUrl('')
    setExistingOgImage('')
    setTwitterImageFile(null)
    setTwitterImageUrl('')
    setExistingTwitterImage('')
  }

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = form.name.trim()
    const slug = slugify(form.slug)
    const nextErrors: { name?: string; slug?: string } = {}
    if (!name) nextErrors.name = 'Enter a category name.'
    if (!slug) nextErrors.slug = 'Enter a slug.'
    setFieldErrors(nextErrors)
    if (nextErrors.name || nextErrors.slug) {
      document.getElementById(nextErrors.name ? 'blog-category-name' : 'blog-category-slug')?.focus()
      return
    }
    if (modal === 'edit' && !editingId) return

    const payload = { ...form, name, slug }
    setSubmitting(true)
    setError('')
    try {
      if (modal === 'edit' && editingId) {
        const previousSlug = data.find((row) => row._id === editingId)?.slug ?? ''
        const slugs = [...new Set([previousSlug, slug].filter(Boolean))]
        await blogCategoriesApi.update(
          editingId,
          formDataFrom(
            payload,
            { ogImage: ogImageFile, ogImageUrl, existingOgImage, twitterImage: twitterImageFile, twitterImageUrl, existingTwitterImage },
            true,
          ),
        )
        await revalidateStore(['articles', ...slugs.map((item) => ({ page: 'blog-category' as const, slug: item }))])
        setSuccess('Blog category updated')
      } else {
        await blogCategoriesApi.create(
          formDataFrom(
            payload,
            { ogImage: ogImageFile, ogImageUrl, existingOgImage, twitterImage: twitterImageFile, twitterImageUrl, existingTwitterImage },
            false,
          ),
        )
        await revalidateStore(['articles', ...(slug ? [{ page: 'blog-category' as const, slug }] : [])])
        setSuccess('Blog category created')
      }
      closeModal()
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, modal === 'edit' ? 'Update failed' : 'Create failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = useCallback(async (id: string, slug?: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Move this blog category to trash? You can restore it from Blog category trash.'))) return
    try {
      await blogCategoriesApi.delete(id)
      await revalidateStore(['articles', ...(slug ? [{ page: 'blog-category' as const, slug }] : [])])
      setSuccess('Blog category moved to trash')
      load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Delete failed'))
    }
  }, [canDelete, load])

  const toggleStatus = useCallback(async (row: BlogCategory, next: boolean) => {
    if (!canEdit) return
    setTogglingId(row._id)
    setError('')
    setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: next } : item)))
    try {
      const payload = new FormData()
      payload.append('status', String(next))
      await blogCategoriesApi.update(row._id, payload)
      await revalidateStore(['articles', ...(row.slug ? [{ page: 'blog-category' as const, slug: row.slug }] : [])])
      setSuccess(next ? 'Blog category activated' : 'Blog category deactivated')
    } catch (err) {
      setData((current) => current.map((item) => (item._id === row._id ? { ...item, status: !next } : item)))
      setError(getApiErrorMessage(err, 'Failed to update status'))
    } finally {
      setTogglingId('')
    }
  }, [canEdit])

  const handleRestore = useCallback(async (row: BlogCategory) => {
    if (!canEdit) return
    if (!(await adminConfirm(`Are you sure you want to restore “${row.name}”?`))) return
    setRestoringId(row._id)
    setError('')
    try {
      await blogCategoriesApi.restore(row._id)
      await revalidateStore(['articles', ...(row.slug ? [{ page: 'blog-category' as const, slug: row.slug }] : [])])
      setSuccess('Blog category restored')
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

  const columns: GridColDef<BlogCategory>[] = useMemo(
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
                title="Restore blog category"
                aria-label="Restore blog category"
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
                title="Edit blog category"
                aria-label="Edit blog category"
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
        minWidth: 200,
        valueGetter: (_, row) => row.name,
        renderCell: ({ row }) => (
          <div className="product-cell" title={row.name}>
            <div className="product-cell__text">
              <span className="product-cell__title">{row.name || '—'}</span>
            </div>
          </div>
        ),
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
                        aria-label={active ? 'Deactivate blog category' : 'Activate blog category'}
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
          ] satisfies GridColDef<BlogCategory>[])),
      {
        field: 'slug',
        headerName: 'Slug',
        flex: 1,
        minWidth: 140,
        renderCell: ({ row }) => (
          <span className="product-cell__meta" title={row.slug || undefined} style={{ display: 'block', width: '100%', minWidth: 0 }}>
            {row.slug || '—'}
          </span>
        ),
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
    [canDelete, canEdit, handleDelete, handleRestore, openEdit, restoringId, toggleStatus, togglingId, trash],
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{trash ? 'Blog category trash' : 'Blog Categories'}</h1>
          <p className="page-subtitle">
            {trash ? 'Soft-deleted blog categories. Restore one to put it back.' : 'Add, update, and delete blog categories.'}
          </p>
        </div>
        {trash ? (
          <button type="button" className="btn" onClick={() => navigate('/blog-categories')}>
            Back to blog categories
          </button>
        ) : (canDelete || canCreate) ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canDelete && (
            <button type="button" className="btn" onClick={() => navigate('/blog-categories/trash')}>
              <Trash2 size={18} /> Trash
            </button>
            )}
            {canCreate && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
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
            <div className="categories-toolbar__tabs" role="group" aria-label="Blog category status">
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
        <Modal wide title={modal === 'create' ? 'Create Blog Category' : 'Update Blog Category'} onClose={closeModal}>
          <form noValidate className="modal-form" onSubmit={saveCategory}>
            <p className="brand-form__lead">
              {modal === 'create'
                ? 'Add a blog category. The slug fills in from the name until you edit it.'
                : 'Update the name, slug, status, and search details for this category.'}
            </p>
            <FormField label="Name" htmlFor="blog-category-name" required error={fieldErrors.name}>
              <input
                id="blog-category-name"
                className={`input${fieldErrors.name ? ' is-invalid' : ''}`}
                value={form.name}
                autoFocus
                onChange={(e) => {
                  const name = e.target.value
                  setFieldErrors((current) => ({ ...current, name: undefined }))
                  setForm((current) => ({
                    ...current,
                    name,
                    slug: slugTouched && current.slug.trim() ? current.slug : slugify(name),
                  }))
                }}
              />
            </FormField>
            <FormField
              label="Slug"
              htmlFor="blog-category-slug"
              required
              hint="Used in store links. Change it only if you want a custom address."
              error={fieldErrors.slug}
            >
              <input
                id="blog-category-slug"
                className={`input${fieldErrors.slug ? ' is-invalid' : ''}`}
                value={form.slug}
                onChange={(e) => {
                  const slug = slugify(e.target.value, { trim: false })
                  setSlugTouched(slug.trim().length > 0)
                  setFieldErrors((current) => ({ ...current, slug: undefined }))
                  setForm((current) => ({ ...current, slug }))
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
                  aria-label={form.status ? 'Deactivate blog category' : 'Activate blog category'}
                  onChange={(e) => setForm((current) => ({ ...current, status: e.target.checked }))}
                />
                <span className="toggle-switch-track" aria-hidden>
                  <span className="toggle-switch-thumb" />
                </span>
              </span>
            </label>
            <SearchAndSocialCard
              values={{
                meta_title: form.meta_title,
                meta_description: form.meta_description,
                meta_keywords: form.meta_keywords,
                og_title: form.og_title,
                og_description: form.og_description,
                twitter_title: form.twitter_title,
                twitter_description: form.twitter_description,
                json_ld: form.schema,
              }}
              onChange={(key, value) => setForm((current) => ({ ...current, [key === 'json_ld' ? 'schema' : key]: value }))}
              isEdit={modal === 'edit'}
              ogImageFile={ogImageFile}
              twitterImageFile={twitterImageFile}
              ogImageUrl={ogImageUrl}
              twitterImageUrl={twitterImageUrl}
              existingOgImage={existingOgImage}
              existingTwitterImage={existingTwitterImage}
              onOgImageChange={setOgImageFile}
              onTwitterImageChange={setTwitterImageFile}
              onOgImageUrlChange={setOgImageUrl}
              onTwitterImageUrlChange={setTwitterImageUrl}
              onExistingOgImageChange={setExistingOgImage}
              onExistingTwitterImageChange={setExistingTwitterImage}
            />
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

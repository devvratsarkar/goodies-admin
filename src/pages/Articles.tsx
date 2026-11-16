import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { ImageOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { articlesApi, blogCategoriesApi } from '../api/endpoints'
import { getProfileImageUrl } from '../api/client'
import { revalidateStore } from '../api/revalidateStore'
import { adminConfirm } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import type { Article, BlogCategory } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useModuleCan } from '../components/rbac/useModuleCan'

type StatusFilter = 'all' | 'true' | 'false'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'true', label: 'Active' },
  { id: 'false', label: 'Inactive' },
]

function formatDateLabel(value?: string | null) {
  if (!value) return null
  const date = moment(value)
  return date.isValid() ? date.format('D MMM YYYY, h:mm A') : null
}

function categoryLabel(category: Article['category']) {
  if (!category || typeof category === 'string') return ''
  return category.name || category.slug || ''
}

function categorySlug(category: Article['category']) {
  if (!category || typeof category === 'string') return undefined
  return category.slug
}

function extractArticlesList(payload: unknown): { articles: Article[]; totalCount: number } {
  const fallback = { articles: [] as Article[], totalCount: 0 }
  if (!payload || typeof payload !== 'object') return fallback
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) {
    const articles = root.data as Article[]
    return { articles, totalCount: articles.length }
  }
  const inner =
    root.data !== undefined && root.data !== null && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : (payload as Record<string, unknown>)

  let articles: Article[] = []
  if (Array.isArray(inner)) articles = inner as Article[]
  else if (Array.isArray(inner.articles)) articles = inner.articles as Article[]
  else if (Array.isArray(inner.list)) articles = inner.list as Article[]
  else if (Array.isArray(inner.data)) articles = inner.data as Article[]

  const pag = (inner.pagination || inner.meta) as Record<string, unknown> | undefined
  const totalCount = Number(pag?.totalItems ?? pag?.total ?? pag?.totalCount ?? inner.total ?? articles.length)
  return {
    articles,
    totalCount: Number.isFinite(totalCount) ? totalCount : articles.length,
  }
}

function ArticleThumb({ src }: { src?: string }) {
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

  return <img src={resolved} alt="" className="product-cell__thumb" onError={() => setFailed(true)} />
}

export function Articles() {
  const navigate = useNavigate()
  const { canCreate, canEdit, canDelete } = useModuleCan('articles')
  const [rows, setRows] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)
  const filterKey = `${debouncedSearch}|${statusFilter}|${categoryFilter}`
  const [seenFilter, setSeenFilter] = useState(filterKey)
  if (seenFilter !== filterKey) {
    setSeenFilter(filterKey)
    setPage(0)
  }

  const reload = useCallback(() => setReloadKey((current) => current + 1), [])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    articlesApi
      .getAll({
        page: page + 1,
        limit: pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: debouncedSearch.trim() || undefined,
        category: categoryFilter || undefined,
      })
      .then((res) => {
        if (ignore) return
        const parsed = extractArticlesList(res.data)
        setRows(parsed.articles)
        setTotalCount(parsed.totalCount)
      })
      .catch((err) => {
        if (!ignore) setError(getApiErrorMessage(err, 'Failed to load blogs'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [page, pageSize, debouncedSearch, statusFilter, categoryFilter, reloadKey])

  useEffect(() => {
    blogCategoriesApi
      .getAll()
      .then((res) => {
        const body = res.data as { data?: BlogCategory[] | { list?: BlogCategory[] } }
        const list = Array.isArray(body.data)
          ? body.data
          : body.data && typeof body.data === 'object' && 'list' in body.data
            ? body.data.list ?? []
            : []
        setCategories(list)
      })
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(''), 3200)
    return () => window.clearTimeout(timer)
  }, [success])

  const handleDelete = useCallback(async (row: Article) => {
    if (!canDelete) return
    if (!(await adminConfirm('Are you sure you want to delete this blog?'))) return
    try {
      await articlesApi.delete(row._id)
      await revalidateStore([
        'articles',
        ...(row.slug ? [{ page: 'article' as const, slug: row.slug }] : []),
        ...(categorySlug(row.category) ? [{ page: 'blog-category' as const, slug: categorySlug(row.category)! }] : []),
      ])
      setSuccess('Blog deleted')
      reload()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Delete failed'))
    }
  }, [canDelete, reload])

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const columns: GridColDef<Article>[] = useMemo(
    () => [
      {
        field: 'actions',
        headerName: 'Actions',
        width: 96,
        minWidth: 96,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        cellClassName: 'products-actions-cell',
        renderCell: ({ row }) => (
          <div className="table-actions" onClick={(event) => event.stopPropagation()}>
            {canEdit && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
              title="Edit blog"
              aria-label="Edit blog"
              onClick={() => navigate(`/articles/${row._id}/edit`)}
            >
              <Pencil size={16} />
            </button>
            )}
            {canDelete && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete"
              title="Delete blog"
              aria-label="Delete blog"
              onClick={() => handleDelete(row)}
            >
              <Trash2 size={16} />
            </button>
            )}
          </div>
        ),
      },
      {
        field: 'title',
        headerName: 'Blog',
        flex: 1.8,
        minWidth: 260,
        valueGetter: (_, row) => row.title,
        renderCell: ({ row }) => (
          <div className="product-cell" title={row.title}>
            <ArticleThumb src={row.image} />
            <div className="product-cell__text">
              <span className="product-cell__title">{row.title || '—'}</span>
              {row.slug ? <span className="product-cell__meta">{row.slug}</span> : null}
            </div>
          </div>
        ),
      },
      {
        field: 'category',
        headerName: 'Category',
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (_, row) => categoryLabel(row.category),
        renderCell: ({ row }) => {
          const name = categoryLabel(row.category)
          if (!name) return <span className="product-cell__meta">—</span>
          return (
            <span className="product-cell__title" title={name} style={{ display: 'block', width: '100%', minWidth: 0, fontWeight: 500 }}>
              {name}
            </span>
          )
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 110,
        minWidth: 110,
        align: 'center',
        headerAlign: 'center',
        valueGetter: (_, row) => (row.status ? 'Active' : 'Inactive'),
        renderCell: ({ row }) => (
          <span className={row.status ? 'badge badge-success' : 'badge badge-danger'}>{row.status ? 'Active' : 'Inactive'}</span>
        ),
      },
      {
        field: 'updatedAt',
        headerName: 'Updated',
        width: 190,
        minWidth: 160,
        valueGetter: (_, row) => row.updatedAt ?? row.createdAt ?? '',
        renderCell: ({ row }) => {
          const label = formatDateLabel(row.updatedAt ?? row.createdAt)
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
    [canDelete, canEdit, handleDelete, navigate],
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Blogs</h1>
          <p className="page-subtitle">Create and manage blog posts, categories, and SEO fields.</p>
        </div>
        {canCreate && (
        <button type="button" className="btn btn-primary" onClick={() => navigate('/articles/new')}>
          <Plus size={18} /> Add blog
        </button>
        )}
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
          <div className="categories-toolbar__tabs" role="group" aria-label="Blog status">
            {STATUS_FILTERS.map((filter) => (
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
          <select
            className="select categories-toolbar__select"
            value={categoryFilter}
            aria-label="Blog category"
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="categories-toolbar__search">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              placeholder="Search title or content..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search title or content"
            />
          </label>
        </div>
        <div className="table-wrap">
          <MuiDataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row._id)}
            loading={loading}
            paginationMode="server"
            rowCount={totalCount}
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

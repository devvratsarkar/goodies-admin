import { useEffect, useState } from 'react'
import { Award, Copy, ExternalLink, Eye, FileDown, Pencil, Plus, RotateCcw, Search, Trash2, Truck, X, type LucideIcon } from 'lucide-react'
import Tooltip from '@mui/material/Tooltip'
import moment from 'moment'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { categoriesApi, productsApi, sizesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { adminConfirm } from '../utils/adminConfirm'
import type { Category, Product, Size } from '../types/api'
import { MuiDataTable } from '../components/ui/MuiDataTable'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useRbac } from '../context/RbacContext'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function apiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

async function blobErrorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      // The response was not JSON.
    }
    return fallback
  }
  return apiMessage(err, fallback)
}

type Visibility = 'all' | 'publish' | 'draft' | 'pending' | 'trash'
type VisibilityCounts = Partial<Record<Visibility, number>>

const VISIBILITY_OPTIONS: { value: Exclude<Visibility, 'trash'>; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'publish', label: 'Published' },
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
]

function readProducts(payload: unknown) {
  const data = (payload as { data?: unknown } | null)?.data
  if (Array.isArray(data)) return { list: data as Product[], total: data.length, counts: {} as VisibilityCounts }

  const page = data as
    | { list?: Product[]; data?: Product[]; visibility_counts?: VisibilityCounts; pagination?: { total?: number } }
    | undefined
  const list = page?.list ?? (Array.isArray(page?.data) ? page.data : [])
  return { list, total: Number(page?.pagination?.total ?? list.length), counts: page?.visibility_counts ?? {} }
}

function storeProductUrl(slug?: string) {
  const origin =
    (import.meta.env.VITE_STORE_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://goodies-jade.vercel.app'
  const path = (slug || '').trim()
  if (!path) return ''
  return `${origin}/product/${encodeURIComponent(path)}`
}

function categoryName(product: Product) {
  const category = product.categoryId
  if (category && typeof category === 'object') return category.name || '-'
  if (typeof category === 'string' && category) return category
  return '-'
}

function productType(product: Product) {
  if (product.product_type) return product.product_type
  if (product.is_variant || (product.variants && product.variants.length > 0)) return 'variable'
  return 'simple'
}

function productStock(product: Product) {
  if (productType(product) === 'variable') {
    const variants = product.variants ?? []
    if (!variants.length) return Number(product.stock ?? 0)
    return variants.reduce((sum, variant) => sum + Number(variant.stock ?? 0), 0)
  }
  return Number(product.variant?.stock ?? product.stock ?? 0)
}

function stockInfo(product: Product) {
  if (!product.stock_manage) return { out: false, qty: null }
  return { out: product.stock_status === 'out_of_stock', qty: productStock(product) }
}

function listPrice(product: Product) {
  if (productType(product) === 'variable') return null
  const price = product.variant?.price ?? product.price
  return price == null || !Number.isFinite(Number(price)) ? null : Number(price)
}

function simpleMrp(product: Product) {
  if (productType(product) !== 'simple') return null
  const selling = listPrice(product)
  const mrp = Number(product.variant?.max_price)
  if (selling == null || !Number.isFinite(mrp) || mrp <= 0) return null
  if (mrp.toFixed(2) === selling.toFixed(2)) return null
  return mrp
}

function formatAed(value: number) {
  return `AED ${value.toFixed(2)}`
}

function variantSellingPrices(product: Product) {
  return (product.variants ?? [])
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price))
}

function variablePriceLabel(product: Product) {
  const prices = variantSellingPrices(product)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min.toFixed(2) === max.toFixed(2) ? formatAed(min) : `${formatAed(min)} – ${formatAed(max)}`
}

function readNamedList<T>(payload: unknown): T[] {
  const body = payload as { data?: T[] | { list?: T[] }; list?: T[] }
  if (Array.isArray(body?.data)) return body.data
  if (body?.data && typeof body.data === 'object' && 'list' in body.data) return body.data.list ?? []
  if (Array.isArray(body?.list)) return body.list
  return []
}

function priceInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`
}

function toPrice(value: string) {
  if (!value.trim() || value === '.') return undefined
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return undefined
  return price
}

type ProductFlag = 'is_best_seller' | 'is_new_arrival'

const PRODUCT_FLAGS: { key: ProductFlag; label: string; icon: LucideIcon }[] = [
  { key: 'is_best_seller', label: 'Best seller', icon: Award },
  { key: 'is_new_arrival', label: 'New arrival', icon: Truck },
]

const STATUS_LABELS: Record<string, string> = { publish: 'Publish', draft: 'Draft' }
const TYPE_LABELS: Record<string, string> = { simple: 'Simple', variable: 'Variable', bundle: 'Bundle' }
const STOCK_LABELS: Record<string, string> = { in_stock: 'In stock', out_of_stock: 'Out of stock' }

const DATE_FORMAT = 'YYYY/MM/DD [at] h:mm a'

function ProductDates({ product }: { product: Product }) {
  const created = moment(product.createdAt ?? null)
  const updated = moment(product.updatedAt ?? null)
  const modified = created.isValid() && updated.isValid() && updated.diff(created, 'minutes') >= 1
  return (
    <div className="product-dates">
      <span className="product-dates__value">
        <span className="product-dates__label">Created: </span>
        {created.isValid() ? created.format(DATE_FORMAT) : '-'}
      </span>
      {modified && (
        <span className="product-dates__value">
          <span className="product-dates__label">Updated: </span>
          {updated.format(DATE_FORMAT)}
        </span>
      )}
    </div>
  )
}

function CellText({ value, lines = 2 }: { value?: string; lines?: number }) {
  const text = value || '-'
  return (
    <span
      title={text}
      style={{
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        whiteSpace: 'normal',
        lineHeight: 1.35,
        wordBreak: 'break-word',
      }}
    >
      {text}
    </span>
  )
}

export function Products({ trash = false }: { trash?: boolean }) {
  const navigate = useNavigate()
  const { can } = useRbac()
  const canEdit = can('products', 'edit')
  const canCreate = can('products', 'create')
  const canDelete = can('products', 'delete')
  const canExport = can('products', 'export')
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState<Visibility>(trash ? 'trash' : 'all')
  const [visibilityCounts, setVisibilityCounts] = useState<VisibilityCounts>({})
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const isTrash = trash || visibility === 'trash'
  const [status, setStatus] = useState('all')
  const [categoryId, setCategoryId] = useState(() => searchParams.get('categoryId') || '')
  const [sizeName, setSizeName] = useState(() => searchParams.get('size') || '')
  const [productTypeFilter, setProductTypeFilter] = useState('all')
  const [stockStatus, setStockStatus] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [sizes, setSizes] = useState<Size[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [reloadKey, setReloadKey] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setVisibility(trash ? 'trash' : 'all')
    setPage(0)
  }, [trash])

  useEffect(() => {
    const nextCategoryId = searchParams.get('categoryId') || ''
    const nextSize = searchParams.get('size') || ''
    setCategoryId((current) => {
      if (current === nextCategoryId) return current
      setPage(0)
      return nextCategoryId
    })
    setSizeName((current) => {
      if (current === nextSize) return current
      setPage(0)
      return nextSize
    })
  }, [searchParams])

  const applyCategoryFilter = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    setPage(0)
    const next = new URLSearchParams(searchParams)
    if (nextCategoryId) next.set('categoryId', nextCategoryId)
    else next.delete('categoryId')
    setSearchParams(next, { replace: true })
  }

  const applySizeFilter = (nextSize: string) => {
    setSizeName(nextSize)
    setPage(0)
    const next = new URLSearchParams(searchParams)
    if (nextSize) next.set('size', nextSize)
    else next.delete('size')
    setSearchParams(next, { replace: true })
  }

  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)
  const debouncedMinPrice = useDebouncedValue(minPrice, 350)
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 350)
  const min = toPrice(debouncedMinPrice)
  const max = toPrice(debouncedMaxPrice)
  const priceError =
    min != null && max != null && min > max ? 'Min price cannot be greater than max price' : ''
  const productFilters = {
    search: debouncedSearch.trim() || undefined,
    visibility: isTrash ? 'trash' : visibility === 'all' ? undefined : visibility,
    transition: status === 'all' ? undefined : status,
    categoryId: categoryId || undefined,
    size: sizeName || undefined,
    product_type: productTypeFilter === 'all' ? undefined : productTypeFilter,
    stock_status: stockStatus === 'all' ? undefined : stockStatus,
    min_price: min,
    max_price: max,
  }

  useEffect(() => {
    categoriesApi
      .getAllCategories()
      .then((res) => setCategories(readNamedList<Category>(res.data)))
      .catch(() => setCategories([]))
    sizesApi
      .getAll()
      .then((res) => setSizes(readNamedList<Size>(res.data)))
      .catch(() => setSizes([]))
  }, [])

  useEffect(() => {
    if (priceError) {
      setLoading(false)
      return
    }

    let ignore = false
    setLoading(true)
    setError('')

    productsApi
      .getAll({
        page: page + 1,
        limit: pageSize,
        ...productFilters,
      })
      .then((res) => {
        if (ignore) return
        const parsed = readProducts(res.data)
        setRows(parsed.list)
        setTotal(parsed.total)
        setVisibilityCounts(parsed.counts)
      })
      .catch((err) => {
        if (!ignore) setError(apiMessage(err, 'Failed to load products'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [page, pageSize, debouncedSearch, visibility, isTrash, status, categoryId, sizeName, productTypeFilter, stockStatus, min, max, priceError, reloadKey])

  const handleDelete = async (id: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Move this product to trash? You can restore it from the Trash filter.'))) return
    try {
      await productsApi.delete(id)
      await revalidateStore(['home', 'shop', 'products', 'category'])
      setSuccess('Product moved to trash')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(apiMessage(err, 'Delete failed'))
    }
  }
  
  const handleRestore = async (row: Product) => {
    if (!canEdit) return
    if (!(await adminConfirm(`Are you sure you want to restore “${row.title || 'this product'}”?`))) return
    setRestoringId(row._id)
    setError('')
    try {
      await productsApi.restore(row._id)
      await revalidateStore(['home', 'shop', 'products', 'category'])
      setSuccess('Product restored')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(apiMessage(err, 'Restore failed'))
    } finally {
      setRestoringId(null)
    }
  }

  const handleToggleStatus = async (id: string, published: boolean) => {
    if (!canEdit) return
    const nextTransition = published ? 'publish' : 'draft'
    const previous = rows.find((product) => product._id === id)?.transition
    setTogglingId(id)
    setError('')
    setRows((current) => current.map((product) => (product._id === id ? { ...product, transition: nextTransition } : product)))
    try {
      const form = new FormData()
      form.append('transition', nextTransition)
      await productsApi.update(id, form)
      await revalidateStore(['home', 'shop', 'products', 'category'])
      setSuccess(published ? 'Product published' : 'Product saved as draft')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setRows((current) => current.map((product) => (product._id === id ? { ...product, transition: previous } : product)))
      setError(apiMessage(err, 'Failed to update status'))
    } finally {
      setTogglingId(null)
    }
  }

  const handleToggleFlag = async (id: string, flag: ProductFlag, nextValue: boolean) => {
    if (!canEdit) return
    const meta = PRODUCT_FLAGS.find((item) => item.key === flag)
    const busyKey = `${id}-${flag}`
    setTogglingFlag(busyKey)
    setError('')
    setRows((current) => current.map((product) => (product._id === id ? { ...product, [flag]: nextValue } : product)))
    try {
      const form = new FormData()
      form.append(flag, String(nextValue))
      await productsApi.update(id, form)
      await revalidateStore(['home', 'shop', 'products', 'category'])
      setSuccess(`${meta?.label ?? 'Flag'} ${nextValue ? 'enabled' : 'removed'}`)
    } catch (err) {
      setRows((current) => current.map((product) => (product._id === id ? { ...product, [flag]: !nextValue } : product)))
      setError(apiMessage(err, `Failed to update ${meta?.label.toLowerCase() ?? 'flag'}`))
    } finally {
      setTogglingFlag(null)
    }
  }

  const handleExport = async () => {
    if (!canExport || priceError) return
    setExporting(true)
    setError('')
    try {
      const res = await productsApi.exportCsv(productFilters)
      const contentType = String(res.headers['content-type'] || '')
      if (contentType.includes('application/json')) {
        setError(await blobErrorMessage({ response: { data: res.data } }, 'Failed to export products'))
        return
      }
      const blob = new Blob([res.data], { type: contentType || 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(await blobErrorMessage(err, 'Failed to export products'))
    } finally {
      setExporting(false)
    }
  }

  const handlePageChange = (model: GridPaginationModel) => {
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const clearFilter = (apply: () => void) => {
    apply()
    setPage(0)
  }

  const clearAllFilters = () => {
    setSearch('')
    if (!trash) setVisibility('all')
    setStatus('all')
    setCategoryId('')
    setSizeName('')
    setProductTypeFilter('all')
    setStockStatus('all')
    setMinPrice('')
    setMaxPrice('')
    setPage(0)
    const next = new URLSearchParams(searchParams)
    next.delete('categoryId')
    next.delete('size')
    setSearchParams(next, { replace: true })
  }

  const selectedCategory = categories.find((category) => category._id === categoryId)
  const selectedSize = sizes.find((size) => size.name.toLowerCase() === sizeName.toLowerCase())
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (!trash && visibility !== 'all') {
    const label = VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.label ?? visibility
    chips.push({ key: 'visibility', label: `Visibility: ${label}`, clear: () => setVisibility('all') })
  }
  if (status !== 'all') chips.push({ key: 'status', label: `Status: ${STATUS_LABELS[status] ?? status}`, clear: () => setStatus('all') })
  if (categoryId) chips.push({ key: 'category', label: `Category: ${selectedCategory?.name || 'Selected'}`, clear: () => applyCategoryFilter('') })
  if (sizeName) chips.push({ key: 'size', label: `Size: ${(selectedSize?.name || sizeName).toUpperCase()}`, clear: () => applySizeFilter('') })
  if (productTypeFilter !== 'all') chips.push({ key: 'type', label: `Type: ${TYPE_LABELS[productTypeFilter] ?? productTypeFilter}`, clear: () => setProductTypeFilter('all') })
  if (stockStatus !== 'all') chips.push({ key: 'stock', label: `Stock: ${STOCK_LABELS[stockStatus] ?? stockStatus}`, clear: () => setStockStatus('all') })
  if (minPrice.trim()) chips.push({ key: 'min', label: `Min: ${minPrice}`, clear: () => setMinPrice('') })
  if (maxPrice.trim()) chips.push({ key: 'max', label: `Max: ${maxPrice}`, clear: () => setMaxPrice('') })
  const hasActiveFilters = chips.length > 0 || Boolean(search.trim())

  const columns: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 168,
      minWidth: 168,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      cellClassName: 'products-actions-cell',
      renderCell: ({ row }) => isTrash ? (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          {canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            title="Restore product"
            aria-label="Restore product"
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
            disabled={!storeProductUrl(row.slug)}
            onClick={() => {
              const url = storeProductUrl(row.slug)
              if (url) window.open(url, '_blank', 'noopener,noreferrer')
            }}
          >
            <Eye size={16} />
          </button>
          {canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
            title="Edit product"
            aria-label="Edit product"
            onClick={() => navigate(`/products/${row._id}/edit`)}
          >
            <Pencil size={16} />
          </button>
          )}
          {canCreate && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--clone"
            title="Clone product"
            aria-label="Clone product"
            onClick={() => navigate(`/products/new?clone=${encodeURIComponent(row._id)}`)}
          >
            <Copy size={16} />
          </button>
          )}
          {canDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete"
            title="Delete product"
            aria-label="Delete product"
            onClick={() => handleDelete(row._id)}
          >
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      field: 'title',
      headerName: 'Product',
      flex: 2,
      minWidth: 260,
      renderCell: ({ row }) => {
        const meta = [row.id != null && row.id !== '' ? `#${row.id}` : '', row.sku ? String(row.sku) : ''].filter(Boolean).join(' · ')
        const storeUrl = isTrash ? null : storeProductUrl(row.slug)
        return (
          <div className="product-cell" title={row.slug ? `${row.title}\n/${row.slug}` : row.title}>
            {row.thumbnail ? (
              <img className="product-cell__thumb" src={row.thumbnail} alt={row.title} />
            ) : (
              <span className="product-cell__thumb product-cell__thumb--empty">No image</span>
            )}
            <div className="product-cell__text">
              {storeUrl ? (
                <a
                  className="product-cell__title product-cell__link"
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span>{row.title || '-'}</span>
                  <ExternalLink size={12} aria-hidden />
                </a>
              ) : (
                <span className="product-cell__title">{row.title || '-'}</span>
              )}
              {meta && <span className="product-cell__meta">{meta}</span>}
            </div>
          </div>
        )
      },
    },
    {
      field: 'flags',
      headerName: 'Highlights',
      width: 100,
      minWidth: 100,
      sortable: false,
      disableColumnMenu: true,
      cellClassName: 'products-actions-cell',
      renderCell: ({ row }) => (
        <div className="product-flags" onClick={(event) => event.stopPropagation()}>
          {PRODUCT_FLAGS.map(({ key, label, icon: Icon }) => {
            const active = Boolean(row[key])
            const busy = togglingFlag === `${row._id}-${key}`
            return (
              <Tooltip key={key} title={canEdit ? (active ? `${label} (click to remove)` : `Mark as ${label.toLowerCase()}`) : label} arrow placement="top">
                <span>
                  <button
                    type="button"
                    className={`product-flag-btn${active ? ' is-active' : ''}`}
                    aria-label={canEdit ? (active ? `Remove ${label.toLowerCase()}` : `Mark as ${label.toLowerCase()}`) : label}
                    aria-pressed={active}
                    disabled={!canEdit || busy || isTrash}
                    onClick={() => handleToggleFlag(row._id, key, !active)}
                  >
                    <Icon size={16} fill="none" />
                  </button>
                </span>
              </Tooltip>
            )
          })}
        </div>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 80,
      minWidth: 80,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: ({ row }) => {
        const isPublished = (row.transition || 'publish') !== 'draft'
        const isBusy = togglingId === row._id
        return (
          <Tooltip title={!canEdit ? (isPublished ? 'Published' : 'Draft') : isPublished ? 'Publish (click to save as draft)' : 'Draft (click to publish)'} arrow placement="top">
            <label
              className={`toggle-switch toggle-switch--sm${!canEdit ? ' is-disabled' : ''}`}
              style={{
                cursor: !canEdit || isTrash ? 'not-allowed' : isBusy ? 'wait' : 'pointer',
                opacity: !canEdit || isBusy || isTrash ? 0.7 : 1,
                paddingTop: 0,
                flex: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isPublished}
                aria-label={isPublished ? 'Publish' : 'Draft'}
                disabled={!canEdit || isBusy || isTrash}
                onChange={(event) => handleToggleStatus(row._id, event.target.checked)}
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
      field: 'category',
      headerName: 'Category',
      flex: 1,
      minWidth: 150,
      valueGetter: (_, row) => categoryName(row),
      renderCell: ({ row }) => <CellText value={categoryName(row)} />,
    },
    {
      field: 'price',
      headerName: 'Selling price',
      width: 230,
      minWidth: 210,
      valueGetter: (_, row) => {
        if (productType(row) === 'variable') {
          const prices = variantSellingPrices(row)
          return prices.length ? Math.min(...prices) : null
        }
        return listPrice(row)
      },
      renderCell: ({ row }) => {
        const type = productType(row)
        const price = listPrice(row)
        const mrp = simpleMrp(row)
        const priceLabel = type === 'variable' ? variablePriceLabel(row) ?? '-' : price == null ? '-' : formatAed(price)
        return (
          <div className="product-cell__text">
            <span className="product-cell__title">{priceLabel}</span>
            <span className="product-cell__meta">
              {TYPE_LABELS[type] ?? type}
              {mrp != null && (
                <>
                  {' · '}
                  <span className={mrp > (price ?? 0) ? 'product-cell__mrp' : ''}>MRP AED {mrp.toFixed(2)}</span>
                </>
              )}
            </span>
          </div>
        )
      },
    },
    {
      field: 'stock',
      headerName: 'Stock',
      width: 180,
      minWidth: 180,
      align: 'left',
      headerAlign: 'left',
      valueGetter: (_, row) => (productType(row) === 'variable' ? '—' : stockInfo(row).out ? 'Out of stock' : 'In stock'),
      renderCell: ({ row }) => {
        if (productType(row) === 'variable') {
          return <span className="product-cell__meta">—</span>
        }
        const { out, qty } = stockInfo(row)
        return (
          <div className="product-cell__text" style={{ gap: 2, alignItems: 'flex-start', width: '100%' }}>
            <span
              className={`badge ${out ? 'badge-danger' : 'badge-success'}`}
              style={{ height: 22, flex: 'none', whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
            >
              {out ? 'Out of stock' : 'In stock'}
            </span>
            <span className="product-cell__meta">
              {qty == null ? 'Manage stock: Off' : `Manage stock: On · Qty ${qty.toLocaleString()}`}
            </span>
          </div>
        )
      },
    },
    {
      field: 'views_30d',
      headerName: 'Views (30 days)',
      width: 130,
      minWidth: 130,
      align: 'left',
      headerAlign: 'left',
      valueGetter: (_, row) => Number(row.views_30d ?? 0),
      renderCell: ({ row }) => (
        <span title="Unique visitors per day over the last 30 days">
          {Number(row.views_30d ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 240,
      minWidth: 240,
      renderCell: ({ row }) => <ProductDates product={row} />,
    },
 
  
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{trash ? 'Product trash' : 'Products'}</h1>
          <p className="page-subtitle">
            {trash ? 'Soft-deleted products. Restore one to put it back in the catalog.' : 'Add, edit and delete products with size variants.'}
          </p>
        </div>
        {(canExport || trash || canDelete || canCreate) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canExport && (
            <button
              type="button"
              className="btn"
              onClick={handleExport}
              disabled={exporting || Boolean(priceError)}
            >
              <FileDown size={18} /> {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
          {trash ? (
            <button type="button" className="btn" onClick={() => navigate('/products')}>
              Back to products
            </button>
          ) : (
            <>
              {canDelete && (
              <button type="button" className="btn" onClick={() => navigate('/products/trash')}>
                <Trash2 size={18} /> Trash
              </button>
              )}
              {canCreate && (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/products/new')}>
                <Plus size={18} /> Add Product
              </button>
              )}
            </>
          )}
        </div>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="product-filter-bar">
        <div className="filter-toolbar-row">
          <div className="product-filter-search">
            <Search size={18} />
            <input
              className="input"
              placeholder="Search title, slug, or SKU..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
            />
          </div>
          {!trash && (
          <select
            className="select"
            aria-label="Product visibility"
            value={visibility}
            onChange={(event) => { setVisibility(event.target.value as Visibility); setPage(0) }}
          >
            {VISIBILITY_OPTIONS.map((option) => {
              const count = visibilityCounts[option.value]
              return (
                <option key={option.value} value={option.value}>
                  {count == null ? option.label : `${option.label} (${count.toLocaleString()})`}
                </option>
              )
            })}
          </select>
          )}
          {/* <select className="select" style={{ width: 150 }} value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}>
            <option value="all">All status</option>
            <option value="publish">Publish</option>
            <option value="draft">Draft</option>
          </select> */}
          <select className="select" value={categoryId} onChange={(event) => applyCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          <select className="select" value={sizeName} onChange={(event) => applySizeFilter(event.target.value)}>
            <option value="">All sizes</option>
            {sizes.map((size) => (
              <option key={size._id} value={size.name}>{size.name.toUpperCase()}</option>
            ))}
          </select>
          <select className="select" value={productTypeFilter} onChange={(event) => { setProductTypeFilter(event.target.value); setPage(0) }}>
            <option value="all">All types</option>
            <option value="simple">Simple</option>
            <option value="variable">Variable</option>
            <option value="bundle">Bundle</option>
          </select>
          <select className="select" value={stockStatus} onChange={(event) => { setStockStatus(event.target.value); setPage(0) }}>
            <option value="all">All stock</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
          <input
            className={`input product-filter-price${priceError ? ' is-invalid' : ''}`}
            inputMode="decimal"
            placeholder="Min price"
            aria-label="Min price"
            aria-invalid={Boolean(priceError)}
            value={minPrice}
            onChange={(event) => { setMinPrice(priceInput(event.target.value)); setPage(0) }}
          />
          <input
            className={`input product-filter-price${priceError ? ' is-invalid' : ''}`}
            inputMode="decimal"
            placeholder="Max price"
            aria-label="Max price"
            aria-invalid={Boolean(priceError)}
            value={maxPrice}
            onChange={(event) => { setMaxPrice(priceInput(event.target.value)); setPage(0) }}
          />
        </div>
        {priceError && <p className="form-field-error">{priceError}</p>}
        {hasActiveFilters && (
          <div className="product-filter-chips">
            {chips.map((chip) => (
              <span key={chip.key} className="filter-chip">
                {chip.label}
                <button
                  type="button"
                  className="filter-chip-remove"
                  aria-label={`Remove ${chip.label}`}
                  onClick={() => clearFilter(chip.clear)}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            <button type="button" className="product-filter-clear" onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}
        </div>

        <div className="table-wrap">
          <MuiDataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row._id}
            loading={loading}
            paginationMode="server"
            rowCount={total}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={handlePageChange}
            pageSizeOptions={[50, 100, 200, 300, 400,500]}
            density="compact"
            showIndex
          />
        </div>
      </div>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { productsApi } from '../../api/endpoints'
import { getProfileImageUrl } from '../../api/client'
import type { EligibleBundleProduct, EligibleBundleVariant } from '../../types/api'
import { FormField } from '../ui/FormField'
import { MuiDataTable } from '../ui/MuiDataTable'

export type SelectedBundleItem = {
  product_id: string
  id?: string
  variant_sku: string | null
  variant_key: string | null
  title: string
  sku: string
  product_type: 'simple' | 'variable' | 'bundle' | 'unknown'
  thumbnail?: string
  selling_price: number
  max_price: number
  weight: number
  variant_label?: string
  missing?: boolean
  missing_variant?: boolean
}

type ExcludeChip = { _id: string; title: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const obj = asRecord(value)
  return obj?._id ? String(obj._id) : ''
}

function buildVariantKey(variant: {
  sku?: string
  color?: string
  size?: string
  attributes?: Record<string, string>
}) {
  const attrs = variant.attributes && typeof variant.attributes === 'object' ? variant.attributes : {}
  const attrPart = Object.keys(attrs)
    .sort()
    .map((key) => `${key}:${attrs[key]}`)
    .join('|')
  return `${variant.sku || ''}::${variant.color || ''}::${variant.size || ''}::${attrPart}`
}

function formatVariantLabel(variant: EligibleBundleVariant) {
  const parts = [variant.size, variant.color, variant.sku].filter(Boolean)
  return parts.join(' · ') || 'Variant'
}

function formatVariantOption(variant: EligibleBundleVariant) {
  const parts = [
    variant.size ? `Size: ${variant.size}` : null,
    variant.color ? `Color: ${variant.color}` : null,
    `Price: ${formatMoney(toNumber(variant.price))}`,
    variant.sku ? `SKU: ${variant.sku}` : null,
  ].filter((part) => part !== null)
  return parts.join(' · ') || 'Variant'
}

function variantOptionValue(variant: EligibleBundleVariant) {
  return buildVariantKey(variant)
}

function VariantDropdown({
  variants,
  value,
  fallbackLabel,
  disabled,
  invalid,
  onChange,
}: {
  variants: EligibleBundleVariant[]
  value: string
  fallbackLabel?: string
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number }>({
    left: 0,
    width: 360,
    maxHeight: 320,
  })
  const selected = variants.find((variant) => variantOptionValue(variant) === value)
  const locked = Boolean(disabled) || variants.length === 0

  const openMenu = () => {
    if (locked) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(420, window.innerWidth - 24, Math.max(rect.width, 220))
    const estimated = Math.min(320, 52 + Math.max(variants.length, 1) * 44)
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUp = spaceBelow < estimated && spaceAbove > spaceBelow
    let left = rect.left
    if (left + width > window.innerWidth - 12) left = Math.max(12, rect.right - width)
    setPosition({
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width,
      maxHeight: Math.max(140, openUp ? spaceAbove - 8 : spaceBelow - 8),
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const summary = selected ? selected.size || selected.color || selected.sku || 'Variant' : fallbackLabel || ''

  return (
    <div className="variant-picker">
      <button
        ref={buttonRef}
        type="button"
        className={`variant-picker-trigger${invalid ? ' is-invalid' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={locked}
        title={selected ? formatVariantOption(selected) : fallbackLabel || undefined}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className={`variant-picker-value${summary ? '' : ' is-placeholder'}`}>
          {summary || (variants.length === 0 ? 'No variants' : 'Select variant')}
        </span>
        {selected ? <span className="variant-picker-price">{formatMoney(toNumber(selected.price))}</span> : null}
        <ChevronDown size={16} className="variant-picker-chevron" />
      </button>
      {open
        ? createPortal(
          <>
            <div className="variant-menu-backdrop" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              role="listbox"
              className="variant-menu"
              style={{
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              <div className="variant-menu-head">
                <span>Size</span>
                <span>Price</span>
                <span>SKU</span>
              </div>
              {variants.map((variant) => {
                const optionValue = variantOptionValue(variant)
                const isSelected = optionValue === value
                return (
                  <button
                    key={optionValue}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`variant-menu-option${isSelected ? ' is-selected' : ''}`}
                    onClick={() => {
                      setOpen(false)
                      if (isSelected) return
                      onChange(optionValue)
                    }}
                  >
                    <span className="variant-menu-size">
                      {variant.size || '—'}
                      {variant.color ? <span className="variant-menu-color">{variant.color}</span> : null}
                    </span>
                    <span className="variant-menu-price">{formatMoney(toNumber(variant.price))}</span>
                    <span className="variant-menu-sku" title={variant.sku || undefined}>
                      {variant.sku || '—'}
                    </span>
                  </button>
                )
              })}
            </div>
          </>,
          document.body,
        )
        : null}
    </div>
  )
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatWeight(value: number) {
  return `${formatMoney(value)} kg`
}

function variantSkipMessage(products: { title: string; variants?: unknown[] }[]) {
  if (products.length === 0) return ''
  const needsVariant = products.filter((product) => (product.variants?.length ?? 0) > 0)
  const noVariants = products.length - needsVariant.length
  const names = needsVariant.slice(0, 3).map((product) => product.title).join(', ')
  const extra = needsVariant.length > 3 ? ` and ${needsVariant.length - 3} more` : ''
  const parts: string[] = []
  if (needsVariant.length === 1) {
    parts.push(`${needsVariant[0].title} was left unchecked because it has sizes. Choose a variant, then check that row.`)
  } else if (needsVariant.length > 1) {
    parts.push(`${needsVariant.length} products with sizes were left unchecked: ${names}${extra}. Choose a variant for each, then check that row.`)
  }
  if (noVariants === 1 && needsVariant.length === 0) {
    parts.push(`${products[0].title} was left unchecked because it has no variants.`)
  } else if (noVariants > 0) {
    parts.push(`${noVariants} ${noVariants === 1 ? 'product has' : 'products have'} no variants, so ${noVariants === 1 ? 'it stays' : 'they stay'} unchecked.`)
  }
  return parts.join(' ')
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function hydrateBundleItems(raw: unknown): SelectedBundleItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const item = asRecord(entry) ?? {}
    const productRaw = item.product_id
    const product = asRecord(productRaw)
    const productId = readId(productRaw)
    const variantSku = item.variant_sku ? String(item.variant_sku) : null
    const variantKey = item.variant_key ? String(item.variant_key) : null

    if (!product) {
      return {
        product_id: productId,
        variant_sku: variantSku,
        variant_key: variantKey,
        title: productId ? `Product ${productId}` : 'Unavailable product',
        sku: '',
        product_type: 'unknown',
        selling_price: 0,
        max_price: 0,
        weight: 0,
        variant_label: variantSku || undefined,
        missing: true,
      }
    }

    const productType =
      product.product_type === 'variable' ||
        product.product_type === 'simple' ||
        product.product_type === 'bundle'
        ? product.product_type
        : 'unknown'
    const variants = Array.isArray(product.variants) ? product.variants : []
    const single = asRecord(product.variant)

    if (productType === 'variable') {
      const match = variants.find((variant) => {
        const rec = asRecord(variant)
        if (!rec) return false
        const sku = String(rec.sku || '').toUpperCase()
        const key = buildVariantKey({
          sku: String(rec.sku || ''),
          color: String(rec.color || ''),
          size: String(rec.size || ''),
          attributes: (rec.attributes as Record<string, string>) || {},
        })
        return sku === String(variantSku || '').toUpperCase() && key === String(variantKey || '')
      })
      const rec = asRecord(match)
      const price = toNumber(rec?.price)
      return {
        product_id: productId,
        id: product.id != null ? String(product.id) : undefined,
        variant_sku: variantSku,
        variant_key: variantKey,
        title: String(product.title || 'Untitled'),
        sku: String(product.sku || ''),
        product_type: 'variable',
        thumbnail: product.thumbnail ? String(product.thumbnail) : undefined,
        selling_price: price,
        max_price: toNumber(rec?.max_price, price),
        weight: toNumber(rec?.weight),
        variant_label: rec
          ? formatVariantLabel(rec as EligibleBundleVariant)
          : variantSku || 'Variant unavailable',
        missing_variant: !rec,
      }
    }

    const price = toNumber(single?.price)
    return {
      product_id: productId,
      id: product.id != null ? String(product.id) : undefined,
      variant_sku: null,
      variant_key: null,
      title: String(product.title || 'Untitled'),
      sku: String(product.sku || ''),
      product_type: productType === 'simple' ? 'simple' : productType,
      thumbnail: product.thumbnail ? String(product.thumbnail) : undefined,
      selling_price: price,
      max_price: toNumber(single?.max_price, price),
      weight: toNumber(product.weight),
    }
  })
}

function toSelectedItem(
  product: EligibleBundleProduct,
  variant?: EligibleBundleVariant | null,
): SelectedBundleItem {
  if (product.product_type === 'variable' && variant) {
    const price = toNumber(variant.price)
    return {
      product_id: product._id,
      id: product.id ? String(product.id) : undefined,
      variant_sku: variant.sku ? String(variant.sku).toUpperCase() : null,
      variant_key: variantOptionValue(variant),
      title: product.title,
      sku: product.sku || '',
      product_type: 'variable',
      thumbnail: product.thumbnail,
      selling_price: price,
      max_price: toNumber(variant.max_price, price),
      weight: toNumber(variant.weight),
      variant_label: formatVariantLabel(variant),
    }
  }

  const price = toNumber(product.selling_price)
  return {
    product_id: product._id,
    id: product.id ? String(product.id) : undefined,
    variant_sku: null,
    variant_key: null,
    title: product.title,
    sku: product.sku || '',
    product_type: 'simple',
    thumbnail: product.thumbnail,
    selling_price: price,
    max_price: toNumber(product.max_price, price),
    weight: toNumber(product.weight),
  }
}

function readTypedNumber(input: HTMLInputElement) {
  const cleaned = input.value.replace(/^0+(?=\d)/, '')
  if (cleaned !== input.value) input.value = cleaned
  return cleaned
}

function parseOptionalLimit(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type BundleTab = 'browse' | 'selected'

function bundleProblemMessage(items: SelectedBundleItem[], onSelectedTab: boolean) {
  const problems = items.filter((item) => item.missing || item.missing_variant)
  if (problems.length === 0) return ''
  const where = onSelectedTab ? 'Uncheck them below' : 'Go to Selected and uncheck them'
  const names = problems.map((item) => item.title).join(', ')
  if (problems.length === 1) {
    const item = problems[0]
    if (item.missing) return `${item.title} was deleted. ${where} before saving.`
    return `${item.title} has a removed size/color. ${where} before saving.`
  }
  return `${problems.length} selected products were deleted or changed (${names}). ${where} before saving.`
}

function BundleSelectBox({
  checked,
  indeterminate = false,
  disabled,
  label,
  title,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  label: string
  title?: string
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  })
  return (
    <input
      ref={ref}
      type="checkbox"
      className="bundle-select"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      title={title}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
    />
  )
}

function BundleProductCell({
  title,
  sku,
  thumbnail,
}: {
  title: string
  sku?: string
  thumbnail?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, width: '100%', overflow: 'hidden' }}>
      {thumbnail ? (
        <img
          src={getProfileImageUrl(thumbnail)}
          alt=""
          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flex: 'none' }}
        />
      ) : null}
      <div style={{ minWidth: 0, overflow: 'hidden', lineHeight: 1.3 }}>
        <div title={title} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        <div
          title={sku || undefined}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-dim)' }}
        >
          SKU: {sku || '-'}
        </div>
      </div>
    </div>
  )
}

export function BundleItemsPicker({
  items,
  onChange,
  excludeProductId,
  selection,
  selectionError,
  onSelectionChange,
  itemsError,
  totalLimit,
  totalLimitError,
  onTotalLimitChange,
}: {
  items: SelectedBundleItem[]
  onChange: (items: SelectedBundleItem[]) => void
  excludeProductId?: string
  selection: number
  selectionError?: string
  onSelectionChange: (value: number) => void
  itemsError?: string
  totalLimit: number | null
  totalLimitError?: string
  onTotalLimitChange: (value: number | null) => void
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('')
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('')
  const [productType, setProductType] = useState<'' | 'simple' | 'variable'>('')
  const [excludedProducts, setExcludedProducts] = useState<ExcludeChip[]>([])
  const [excludeQuery, setExcludeQuery] = useState('')
  const [excludeResults, setExcludeResults] = useState<EligibleBundleProduct[]>([])
  const [excludeOpen, setExcludeOpen] = useState(false)
  const [excludePanelOpen, setExcludePanelOpen] = useState(false)
  const [pendingVariantByProduct, setPendingVariantByProduct] = useState<Record<string, string>>({})
  const [variantErrorByProduct, setVariantErrorByProduct] = useState<Record<string, string>>({})
  const [eligible, setEligible] = useState<EligibleBundleProduct[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [selectedPage, setSelectedPage] = useState(0)
  const [selectedPageSize, setSelectedPageSize] = useState(50)
  const [selectedSearch, setSelectedSearch] = useState('')
  const [tab, setTab] = useState<BundleTab>('browse')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [selectAllOn, setSelectAllOn] = useState(false)
  const excludeRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const selectedIds = useMemo(() => new Set(items.map((item) => item.product_id)), [items])
  const problemMessage = bundleProblemMessage(items, tab === 'selected')
  const filteredSelectedItems = useMemo(() => {
    const q = selectedSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.title, item.sku, item.id, item.product_id].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, selectedSearch])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMinPrice(minPrice.trim())
      setDebouncedMaxPrice(maxPrice.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [minPrice, maxPrice])

  useEffect(() => {
    setPage(0)
    setSelectAllOn(false)
  }, [debouncedSearch, debouncedMinPrice, debouncedMaxPrice, excludedProducts, productType])

  useEffect(() => {
    if (eligible.some((product) => selectedIds.has(product._id))) return
    if (selectAllOn) setSelectAllOn(false)
  }, [selectAllOn, eligible, selectedIds])

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(items.length / selectedPageSize))
    if (selectedPage > pageCount - 1) setSelectedPage(pageCount - 1)
  }, [items.length, selectedPage, selectedPageSize])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (excludeRef.current && !excludeRef.current.contains(event.target as Node)) {
        setExcludeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    const exclude = excludedProducts.map((item) => item._id)
    setLoading(true)
    setListError('')
    productsApi
      .getEligibleForBundle({
        search: debouncedSearch || undefined,
        min_price: debouncedMinPrice || undefined,
        max_price: debouncedMaxPrice || undefined,
        product_type: productType || undefined,
        exclude: exclude.length ? exclude : undefined,
        page: page + 1,
        limit: pageSize,
      })
      .then((res) => {
        if (cancelled) return
        const payload = (res.data as { data?: { list?: EligibleBundleProduct[]; pagination?: { total?: number } } }).data
        const list = Array.isArray(payload?.list) ? payload.list : []
        setEligible(list)
        setTotal(Number(payload?.pagination?.total ?? list.length))
      })
      .catch(() => {
        if (!cancelled) {
          setEligible([])
          setListError('Could not load eligible products.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, debouncedMinPrice, debouncedMaxPrice, productType, excludedProducts, page, pageSize])

  useEffect(() => {
    const query = excludeQuery.trim()
    if (!query) {
      setExcludeResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      productsApi
        .getEligibleForBundle({
          search: query,
          exclude: [
            ...excludedProducts.map((item) => item._id),
            ...items.map((item) => item.product_id),
            ...(excludeProductId ? [excludeProductId] : []),
          ],
          page: 1,
          limit: 8,
        })
        .then((res) => {
          if (cancelled) return
          const payload = (res.data as { data?: { list?: EligibleBundleProduct[] } }).data
          setExcludeResults(Array.isArray(payload?.list) ? payload.list : [])
          setExcludeOpen(true)
        })
        .catch(() => {
          if (!cancelled) setExcludeResults([])
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [excludeQuery, excludedProducts, items, excludeProductId])

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setMinPrice('')
    setMaxPrice('')
    setDebouncedMinPrice('')
    setDebouncedMaxPrice('')
    setProductType('')
    setExcludedProducts([])
    setExcludeQuery('')
    setExcludeResults([])
    setPendingVariantByProduct({})
    setVariantErrorByProduct({})
    setPage(0)
  }

  const commitItems = (next: SelectedBundleItem[]) => {
    itemsRef.current = next
    onChange(next)
  }

  const addItem = (product: EligibleBundleProduct) => {
    const current = itemsRef.current
    if (current.some((item) => item.product_id === product._id)) return
    if (product.product_type === 'variable') {
      const selectedKey = pendingVariantByProduct[product._id]
      const variant = (product.variants ?? []).find((item) => variantOptionValue(item) === selectedKey)
      if (!variant) {
        setVariantErrorByProduct((prev) => ({ ...prev, [product._id]: 'Variant is required' }))
        return
      }
      setVariantErrorByProduct((prev) => {
        if (!prev[product._id]) return prev
        const next = { ...prev }
        delete next[product._id]
        return next
      })
      commitItems([...current, toSelectedItem(product, variant)])
      return
    }
    commitItems([...current, toSelectedItem(product)])
  }

  const removeItems = (productIds: Set<string>) => {
    if (productIds.size === 0) return
    const current = itemsRef.current
    const pendingUpdates: Record<string, string> = {}
    for (const item of current) {
      if (!productIds.has(item.product_id)) continue
      if (item.product_type === 'variable' && item.variant_key) pendingUpdates[item.product_id] = item.variant_key
    }
    if (Object.keys(pendingUpdates).length > 0) {
      setPendingVariantByProduct((prev) => ({ ...prev, ...pendingUpdates }))
    }
    setVariantErrorByProduct((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of productIds) {
        if (!next[id]) continue
        delete next[id]
        changed = true
      }
      return changed ? next : prev
    })
    const nextItems = current.filter((item) => !productIds.has(item.product_id))
    if (nextItems.length !== current.length) commitItems(nextItems)
  }

  const removeItem = (productId: string) => {
    removeItems(new Set([productId]))
  }

  const toggleBrowseProduct = (product: EligibleBundleProduct, checked: boolean) => {
    if (checked) {
      const before = itemsRef.current.length
      addItem(product)
      if (itemsRef.current.length === before) return
    } else {
      removeItem(product._id)
    }
    if (selectAllOn) setSelectAllOn(false)
  }

  const chosenVariant = (product: EligibleBundleProduct) => {
    if (product.product_type !== 'variable') return undefined
    const selectedKey = pendingVariantByProduct[product._id]
    if (!selectedKey) return undefined
    return (product.variants ?? []).find((variant) => variantOptionValue(variant) === selectedKey)
  }

  const simplePageRows = eligible.filter((product) => product.product_type !== 'variable')
  const selectablePageRows = eligible.filter(
    (product) => product.product_type !== 'variable' || (product.variants?.length ?? 0) > 0,
  )
  const pageFullySelected =
    selectablePageRows.length > 0 && selectablePageRows.every((product) => selectedIds.has(product._id))
  const skippedVariableProducts = eligible.filter(
    (product) => product.product_type === 'variable' && !selectedIds.has(product._id),
  )
  const showDeselect = pageFullySelected
  const selectAllNotice = selectAllOn ? variantSkipMessage(skippedVariableProducts) : ''

  const toggleBrowsePage = () => {
    const current = itemsRef.current
    if (showDeselect) {
      const pageIds = new Set(eligible.map((product) => product._id))
      removeItems(new Set(current.filter((item) => pageIds.has(item.product_id)).map((item) => item.product_id)))
      setSelectAllOn(false)
      return
    }
    const simpleToAdd = simplePageRows.filter((product) => !current.some((item) => item.product_id === product._id))
    const readyVariableRows = eligible.filter((product) => {
      if (current.some((item) => item.product_id === product._id)) return false
      return Boolean(chosenVariant(product))
    })
    const next = [...current]
    for (const product of simpleToAdd) next.push(toSelectedItem(product))
    for (const product of readyVariableRows) {
      const variant = chosenVariant(product)
      if (variant) next.push(toSelectedItem(product, variant))
    }
    setSelectAllOn(true)
    if (next.length !== current.length) commitItems(next)
  }

  const selectedPageRows = filteredSelectedItems.slice(
    selectedPage * selectedPageSize,
    (selectedPage + 1) * selectedPageSize,
  )
  const toggleSelectedPage = (checked: boolean) => {
    if (checked || selectedPageRows.length === 0) return
    removeItems(new Set(selectedPageRows.map((item) => item.product_id)))
  }

  const addExclude = (product: EligibleBundleProduct) => {
    setExcludedProducts((prev) =>
      prev.some((item) => item._id === product._id)
        ? prev
        : [...prev, { _id: product._id, title: product.title }],
    )
    setExcludeQuery('')
    setExcludeResults([])
    setExcludeOpen(false)
  }

  const removeExclude = (productId: string) => {
    setExcludedProducts((prev) => prev.filter((item) => item._id !== productId))
  }

  const handlePageChange = (model: GridPaginationModel) => {
    setSelectAllOn(false)
    setPage(model.pageSize === pageSize ? model.page : 0)
    setPageSize(model.pageSize)
  }

  const variantForRow = (row: EligibleBundleProduct) => {
    const variants = row.variants ?? []
    const selectedItem = items.find((item) => item.product_id === row._id)
    if (selectedItem) {
      return (
        variants.find((variant) => variantOptionValue(variant) === selectedItem.variant_key) ??
        variants.find(
          (variant) =>
            String(variant.sku || '').toUpperCase() === String(selectedItem.variant_sku || '').toUpperCase(),
        )
      )
    }
    const pendingKey = pendingVariantByProduct[row._id]
    if (!pendingKey) return undefined
    return variants.find((variant) => variantOptionValue(variant) === pendingKey)
  }

  const columns: GridColDef<EligibleBundleProduct>[] = [
    {
      field: 'select',
      headerName: 'Select all',
      width: 108,
      minWidth: 108,
      flex: 0,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderHeader: () => (
        <label className="bundle-select-header">
          <BundleSelectBox
            checked={showDeselect}
            disabled={loading || eligible.length === 0}
            label={showDeselect ? 'Deselect all products on this page' : 'Select all simple products on this page'}
            title={showDeselect
              ? 'Remove the selected products on this page.'
              : 'Selects simple products and products whose variant you already chose. Other products with sizes stay unchecked.'}
            onChange={toggleBrowsePage}
          />
          <span>{showDeselect ? 'Deselect all' : 'Select all'}</span>
        </label>
      ),
      renderCell: ({ row }) => {
        const selected = selectedIds.has(row._id)
        const noVariants = row.product_type === 'variable' && (row.variants?.length ?? 0) === 0
        return (
          <BundleSelectBox
            checked={selected}
            disabled={!selected && noVariants}
            label={selected ? `Remove ${row.title} from this bundle` : `Add ${row.title} to this bundle`}
            title={noVariants ? 'This product has no variants' : undefined}
            onChange={(checked) => toggleBrowseProduct(row, checked)}
          />
        )
      },
    },
    {
      field: 'index',
      headerName: '#',
      width: 48,
      minWidth: 48,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => page * pageSize + params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: 'title',
      headerName: 'Product',
      flex: 2.8,
      minWidth: 280,
      renderCell: ({ row }) => <BundleProductCell title={row.title} sku={row.sku} thumbnail={row.thumbnail} />,
    },
    {
      field: 'id',
      headerName: 'Product ID',
      width: 112,
      minWidth: 112,
      flex: 0,
      sortable: false,
      renderCell: ({ row }) => (
        <span
          title={row.id}
          style={{ display: 'block', width: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
        >
          #{row.id}
        </span>
      ),
    },
    {
      field: 'product_type',
      headerName: 'Type',
      flex: 0.4,
      minWidth: 72,
    },
    {
      field: 'selling_price',
      headerName: 'Price',
      flex: 0.45,
      minWidth: 72,
      renderCell: ({ row }) => {
        if (row.product_type !== 'variable') return formatMoney(toNumber(row.selling_price))
        const variant = variantForRow(row)
        if (variant) return formatMoney(toNumber(variant.price))
        const selectedItem = items.find((item) => item.product_id === row._id)
        if (selectedItem) return formatMoney(selectedItem.selling_price)
        return `From ${formatMoney(toNumber(row.selling_price))}`
      },
    },
    {
      field: 'weight',
      headerName: 'Weight',
      flex: 0.45,
      minWidth: 88,
      renderCell: ({ row }) => {
        if (row.product_type !== 'variable') return formatWeight(toNumber(row.weight))
        const variant = variantForRow(row)
        if (variant) return formatWeight(toNumber(variant.weight))
        const selectedItem = items.find((item) => item.product_id === row._id)
        if (selectedItem) return formatWeight(selectedItem.weight)
        return `From ${formatWeight(toNumber(row.weight))}`
      },
    },
    {
      field: 'variant',
      headerName: 'Variant',
      flex: 1,
      minWidth: 140,
      sortable: false,
      renderCell: ({ row }) => {
        if (row.product_type !== 'variable') return <span style={{ color: 'var(--text-dim)' }}>—</span>
        const variants = row.variants ?? []
        const selectedItem = items.find((item) => item.product_id === row._id)
        const matched = selectedItem
          ? variants.find((variant) => variantOptionValue(variant) === selectedItem.variant_key) ??
          variants.find(
            (variant) =>
              String(variant.sku || '').toUpperCase() === String(selectedItem.variant_sku || '').toUpperCase(),
          )
          : undefined
        const selectValue = matched
          ? variantOptionValue(matched)
          : selectedItem?.variant_key || pendingVariantByProduct[row._id] || ''
        const selectedLabel = matched ? formatVariantOption(matched) : selectedItem?.variant_label || ''
        const variantError = variantErrorByProduct[row._id]
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
            <VariantDropdown
              variants={variants}
              value={selectValue}
              fallbackLabel={selectedLabel}
              disabled={Boolean(selectedItem)}
              invalid={Boolean(variantError)}
              onChange={(next) => {
                setPendingVariantByProduct((prev) => ({ ...prev, [row._id]: next }))
                if (!next) return
                setVariantErrorByProduct((prev) => {
                  if (!prev[row._id]) return prev
                  const nextErrors = { ...prev }
                  delete nextErrors[row._id]
                  return nextErrors
                })
              }}
            />
            {variantError ? <span className="form-field-error">{variantError}</span> : null}
          </div>
        )
      },
    },
  ]

  const selectedColumns: GridColDef<SelectedBundleItem>[] = [
    {
      field: 'select',
      headerName: 'Select all',
      width: 108,
      minWidth: 108,
      flex: 0,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      renderHeader: () => (
        <label className="bundle-select-header">
          <BundleSelectBox
            checked={selectedPageRows.length > 0}
            disabled={selectedPageRows.length === 0}
            label="Deselect all products on this page"
            title="Remove the products on this page from the bundle."
            onChange={toggleSelectedPage}
          />
          <span>Deselect all</span>
        </label>
      ),
      renderCell: ({ row }) => (
        <BundleSelectBox
          checked
          label={`Remove ${row.title} from this bundle`}
          onChange={(checked) => {
            if (!checked) removeItem(row.product_id)
          }}
        />
      ),
    },
    {
      field: 'index',
      headerName: '#',
      width: 48,
      minWidth: 48,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) =>
        selectedPage * selectedPageSize + params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
    },
    {
      field: 'title',
      headerName: 'Product',
      flex: 2.8,
      minWidth: 280,
      renderCell: ({ row }) => <BundleProductCell title={row.title} sku={row.sku} thumbnail={row.thumbnail} />,
    },
    {
      field: 'id',
      headerName: 'Product ID',
      width: 112,
      minWidth: 112,
      flex: 0,
      sortable: false,
      renderCell: ({ row }) => (
        <span
          title={row.id || row.product_id}
          style={{ display: 'block', width: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
        >
          {row.id ? `#${row.id}` : '—'}
        </span>
      ),
    },
    {
      field: 'product_type',
      headerName: 'Type',
      flex: 0.4,
      minWidth: 72,
    },
    {
      field: 'selling_price',
      headerName: 'Price',
      flex: 0.45,
      minWidth: 72,
      renderCell: ({ row }) => formatMoney(row.selling_price),
    },
    {
      field: 'weight',
      headerName: 'Weight',
      flex: 0.45,
      minWidth: 88,
      renderCell: ({ row }) => formatWeight(row.weight),
    },
    {
      field: 'variant',
      headerName: 'Variant',
      flex: 1,
      minWidth: 140,
      sortable: false,
      renderCell: ({ row }) => {
        if (row.product_type !== 'variable') return <span style={{ color: 'var(--text-dim)' }}>—</span>
        return (
          <span title={row.variant_label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.variant_label || 'Variant unavailable'}
          </span>
        )
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 0.7,
      minWidth: 140,
      sortable: false,
      renderCell: ({ row }) => {
        if (row.missing) return <span className="form-field-error">Unavailable</span>
        if (row.missing_variant) return <span className="form-field-error">Variant unavailable</span>
        return <span style={{ color: 'var(--text-dim)' }}>In bundle</span>
      },
    },
  ]

  return (
    <div className="bundle-builder">
      <div className="bundle-builder__header">
        <h3 className="bundle-builder__title">Bundle builder</h3>
        <span className="bundle-builder__count">
          {items.length} {items.length === 1 ? 'product' : 'products'}
        </span>
      </div>
      <div className="bundle-builder__limit">
        <FormField
          label="Max selection"
          required
          hint="How many products a customer can choose from this bundle"
          error={selectionError}
        >
          <input
            type="number"
            className="input"
            min={1}
            value={selection}
            onChange={(e) => onSelectionChange(Number(readTypedNumber(e.target)))}
          />
        </FormField>
        <FormField
          label="Max single product quantity"
          hint="Cannot be greater than max selection. Leave empty for no limit."
          error={totalLimitError}
        >
          <input
            type="number"
            className={`input${totalLimitError ? ' is-invalid' : ''}`}
            min={1}
            max={selection > 0 ? selection : undefined}
            value={totalLimit ?? ''}
            onChange={(e) => onTotalLimitChange(parseOptionalLimit(readTypedNumber(e.target)))}
          />
        </FormField>
      </div>

      <div className="bundle-builder__section">
        {itemsError ? <p className="form-field-error" style={{ margin: '0 0 12px' }}>{itemsError}</p> : null}
        {problemMessage ? <div className="alert alert-error">{problemMessage}</div> : null}
        <div className="bundle-builder__tabs" role="tablist" aria-label="Bundle products">
          <button
            type="button"
            role="tab"
            id="bundle-tab-browse"
            aria-selected={tab === 'browse'}
            aria-controls="bundle-panel-browse"
            className={`bundle-builder__tab${tab === 'browse' ? ' is-active' : ''}`}
            onClick={() => setTab('browse')}
          >
            Find products
          </button>
          <button
            type="button"
            role="tab"
            id="bundle-tab-selected"
            aria-selected={tab === 'selected'}
            aria-controls="bundle-panel-selected"
            className={`bundle-builder__tab${tab === 'selected' ? ' is-active' : ''}`}
            onClick={() => setTab('selected')}
          >
            Selected
            <span className={`bundle-builder__tab-count${selectAllNotice ? ' is-warning' : ''}`}>{items.length}</span>
          </button>
        </div>

        {tab === 'selected' ? (
          <div role="tabpanel" id="bundle-panel-selected" aria-labelledby="bundle-tab-selected">
            {items.length === 0 ? (
              <div className="bundle-builder__empty">No products in this bundle yet. Check products on the Find products tab.</div>
            ) : (
              <>
                <div className="bundle-builder__filters">
                  <FormField label="Search">
                    <input
                      className="input"
                      value={selectedSearch}
                      onChange={(e) => {
                        setSelectedSearch(e.target.value)
                        setSelectedPage(0)
                      }}
                      placeholder="Name, SKU, or ID"
                    />
                  </FormField>
                </div>
                {filteredSelectedItems.length === 0 ? (
                  <div className="bundle-builder__empty">No selected products match this search.</div>
                ) : (
                  <div className="table-wrap">
                    <MuiDataTable
                      rows={filteredSelectedItems}
                      columns={selectedColumns}
                      getRowId={(row) => String(row.product_id)}
                      loading={false}
                      paginationMode="client"
                      paginationModel={{ page: selectedPage, pageSize: selectedPageSize }}
                      onPaginationModelChange={(model) => {
                        setSelectedPage(model.pageSize === selectedPageSize ? model.page : 0)
                        setSelectedPageSize(model.pageSize)
                      }}
                      pageSizeOptions={[10, 25, 50, 100, 200, 300]}
                      density="compact"
                      bodyScroll
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div role="tabpanel" id="bundle-panel-browse" aria-labelledby="bundle-tab-browse">
        <div className="bundle-builder__filters">
          <FormField label="Search">
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, SKU, or ID"
            />
          </FormField>
          <FormField label="Min price">
            <input
              className="input"
              type="number"
              step="0.01"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </FormField>
          <FormField label="Max price">
            <input
              className="input"
              type="number"
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </FormField>
          <FormField label="Type">
            <select
              className="select"
              value={productType}
              onChange={(e) => setProductType(e.target.value as '' | 'simple' | 'variable')}
            >
              <option value="">All types</option>
              <option value="simple">Simple</option>
              <option value="variable">Variable</option>
            </select>
          </FormField>
          <div className="bundle-builder__filter-actions">
            <button
              type="button"
              className={`btn btn-reset${excludePanelOpen ? ' is-open' : ''}`}
              onClick={() => setExcludePanelOpen((open) => !open)}
            >
              Exclude products{excludedProducts.length > 0 ? ` (${excludedProducts.length})` : ''}
            </button>
            <button type="button" className="btn btn-reset" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </div>
        {excludePanelOpen && (
          <div className="bundle-builder__exclude">
            <FormField label="Exclude products" hint="Hidden from the list only. Not saved.">
              <div ref={excludeRef} className="bundle-exclude-search">
                <input
                  className="input"
                  value={excludeQuery}
                  onFocus={() => excludeResults.length > 0 && setExcludeOpen(true)}
                  onChange={(e) => setExcludeQuery(e.target.value)}
                  placeholder="Search products to hide"
                />
                {excludeOpen && excludeResults.length > 0 && (
                  <div className="bundle-exclude-menu">
                    {excludeResults.map((product) => (
                      <button
                        key={product._id}
                        type="button"
                        className="bundle-exclude-option"
                        onClick={() => addExclude(product)}
                      >
                        {product.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormField>
          </div>
        )}
        {excludedProducts.length > 0 && (
          <div className="bundle-builder__chips">
            {excludedProducts.map((product) => (
              <span key={product._id} className="bundle-exclude-chip">
                <span className="bundle-exclude-chip-label" title={product.title}>
                  {product.title}
                </span>
                <button
                  type="button"
                  className="bundle-exclude-chip-remove"
                  onClick={() => removeExclude(product._id)}
                  aria-label={`Stop excluding ${product.title}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {listError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{listError}</div>}
        {selectAllNotice ? <div className="alert alert-warning">{selectAllNotice}</div> : null}
        <div className="table-wrap">
          <MuiDataTable
            rows={eligible}
            columns={columns}
            getRowId={(row) => row._id}
            loading={loading}
            paginationMode="server"
            rowCount={total}
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={handlePageChange}
            pageSizeOptions={[50, 100, 200, 300, 400,500]}
            density="compact"
            bodyScroll
          />
        </div>
          </div>
        )}
      </div>
    </div>
  )
}

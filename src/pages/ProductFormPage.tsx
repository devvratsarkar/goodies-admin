import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ExternalLink, Trash2, X } from 'lucide-react'
import { getIn, useFormik } from 'formik'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getProfileImageUrl } from '../api/client'
import { ImageSourceField } from '../components/media/ImageSourceField'
import { categoriesApi, productsApi, sizesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { confirmDeleteItem } from '../utils/adminConfirm'
import type { Category, Product, ProductType, Size } from '../types/api'
import { FormField } from '../components/ui/FormField'
import {
  BundleItemsPicker,
  hydrateBundleItems,
  type SelectedBundleItem,
} from '../components/products/BundleItemsPicker'
import { SearchAndSocialCard, type SearchSocialValues } from '../components/products/SearchAndSocialCard'
import { ArticleMdxEditor } from '../components/ArticleMdxEditor'
import slugify from 'slugify'
import { addProductValidationSchema } from '../validation/validation'
import { useModuleCan } from '../components/rbac/useModuleCan'

type SizeItem = { name: string }
type VariantItem = {
  sku: string
  color: string
  size: string
  attributes?: Record<string, string>
  stock: number
  price: number
  max_price: number
  weight: number
  status: boolean
  is_default: boolean
  stock_manage: boolean
  stock_status: 'in_stock' | 'out_of_stock'
}

type ProductForm = {
  title: string
  slug: string
  description: string
  short_description: string
  transition: string
  sku: string
  stock: number
  weight: number
  status: boolean
  product_type: ProductType
  is_best_seller: boolean
  is_new_arrival: boolean
  custom_notes: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  og_title: string
  og_description: string
  twitter_title: string
  twitter_description: string
  json_ld: string
  categoryId: string
  thumbnail: string
  images: string[]
  variant: {
    sku: string
    stock: number
    price: number
    max_price: number
  }
  sizes: SizeItem[]
  variants: VariantItem[]
  stock_manage: boolean
  stock_status: 'in_stock' | 'out_of_stock'
  max_selection: number
  max_product_quantity: number | null
}

function plainText(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function optionalBundleNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clipText(value: string, max = 160) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

function buildProductSeo(form: ProductForm): SearchSocialValues {
  const title = form.title.trim()
  const description = clipText(plainText(form.short_description) || plainText(form.description))
  const sku = (form.product_type === 'simple' ? form.variant.sku || form.sku : form.sku).trim()
  const prices = form.product_type === 'variable' ? form.variants.map((variant) => Number(variant.price) || 0) : [Number(form.variant.price) || 0]
  const price = prices.length ? Math.min(...prices) : 0
  const stock = form.product_type === 'variable'
    ? form.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0)
    : Number(form.variant.stock) || 0
  const image = form.thumbnail ? [form.thumbnail] : []
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    ...(sku ? { sku } : {}),
    ...(image.length ? { image } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'AED',
      price,
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  }

  return {
    meta_title: title,
    meta_description: description,
    meta_keywords: '',
    og_title: title,
    og_description: description,
    twitter_title: title,
    twitter_description: description,
    json_ld: title ? JSON.stringify(jsonLd, null, 2) : '',
  }
}

const TEXT_LIMITS = {
  short_description: 200,
  description: 500,
  custom_notes: 200,
} as const

function limitText(previous: string, next: string, max: number) {
  if (next.length <= max || next.length <= previous.length) return next
  return previous.length <= max ? next.slice(0, max) : previous
}

function readTypedNumber(input: HTMLInputElement) {
  const cleaned = input.value.replace(/^0+(?=\d)/, '')
  if (cleaned !== input.value) input.value = cleaned
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}

const initialForm: ProductForm = {
  title: '',
  slug: '',
  description: '',
  short_description: '',
  transition: 'draft',
  sku: '',
  stock: 0,
  weight: 0,
  status: true,
  stock_manage: false,
  stock_status: 'in_stock',
  product_type: 'simple',
  is_best_seller: false,
  is_new_arrival: false,
  custom_notes: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  twitter_title: '',
  twitter_description: '',
  json_ld: '',
  categoryId: '',
  thumbnail: '',
  images: [],
  variant: {
    sku: '',
    stock: 0,
    price: 0,
    max_price: 0,
  },
  sizes: [],
  variants: [],
  max_selection: 1,
  max_product_quantity: null,
}

const PRODUCT_TYPE_CHOICES: { value: ProductType; title: string; detail: string }[] = [
  {
    value: 'simple',
    title: 'Single product',
    detail: 'One price and one stock quantity.',
  },
  {
    value: 'variable',
    title: 'Variable',
    detail: 'Sizes, each with its own price and stock.',
  },
  {
    value: 'bundle',
    title: 'Bundle',
    detail: 'Customers pick from a set of products.',
  },
]

function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <section className="product-form-section">
      <div className="product-form-section__head">
        <h2 className="product-form-section__title">{title}</h2>
        <p className="product-form-section__hint">{hint}</p>
      </div>
      {children}
    </section>
  )
}

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (typeof payload !== 'object' || !payload) return []
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.data)) return obj.data as T[]
  if (obj.data && typeof obj.data === 'object' && 'list' in obj.data) {
    const list = (obj.data as { list?: unknown[] }).list
    return Array.isArray(list) ? (list as T[]) : []
  }
  return []
}

function canonicalSizeName(name: string, masters: Size[]) {
  const key = name.trim().toLowerCase()
  return masters.find((size) => size.name.trim().toLowerCase() === key)?.name ?? name.trim()
}

function createSizeVariant(sizeName: string, sku: string, weight: number): VariantItem {
  return {
    sku: `${sku.trim() || 'SKU'}-${sizeName.toUpperCase()}`,
    color: '',
    size: sizeName,
    attributes: {},
    stock: 0,
    price: 0,
    max_price: 0,
    weight: weight || 0,
    status: true,
    is_default: false,
    stock_manage: false,
    stock_status: 'in_stock',
  }
}

function withFirstSizeDefault(variants: VariantItem[]): VariantItem[] {
  if (variants.length === 0) return variants
  const defaultIndex = variants.findIndex((variant) => variant.is_default)
  const index = defaultIndex === -1 ? 0 : defaultIndex
  if (variants.every((variant, variantIndex) => variant.is_default === (variantIndex === index))) return variants
  return variants.map((variant, variantIndex) =>
    variant.is_default === (variantIndex === index) ? variant : { ...variant, is_default: variantIndex === index },
  )
}

function productSlug(value: string, trim = true) {
  return slugify(value, { lower: true, strict: true, trim })
}

function storeProductUrl(slug?: string) {
  const origin =
    (import.meta.env.VITE_STORE_URL as string | undefined)
  const path = (slug || '').trim()
  if (!path) return ''
  return `${origin}/product/${encodeURIComponent(path)}`
}

function toText(val: unknown) {
  return val === undefined || val === null ? '' : String(val)
}

function cloneSku(value: string) {
  const sku = value.trim()
  return sku ? `${sku}-COPY` : ''
}

function toImageFieldValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.replace(/^\/+/, '')
}

function firstErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
    return ''
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstErrorMessage(item)
      if (message) return message
    }
  }
  return ''
}

function ProductImagesFields({
  thumbnailFile,
  imageFiles,
  existingThumbnail,
  existingImages,
  libraryThumbnail,
  libraryImages,
  thumbnailError = '',
  onThumbnailChange,
  onImagesChange,
  onExistingThumbnailChange,
  onExistingImagesChange,
  onLibraryThumbnailChange,
  onLibraryImagesChange,
}: {
  thumbnailFile: File | null
  imageFiles: File[]
  existingThumbnail: string
  existingImages: string[]
  libraryThumbnail: string
  libraryImages: string[]
  thumbnailError?: string
  onThumbnailChange: (file: File | null) => void
  onImagesChange: (files: File[]) => void
  onExistingThumbnailChange: (value: string) => void
  onExistingImagesChange: (images: string[]) => void
  onLibraryThumbnailChange: (url: string) => void
  onLibraryImagesChange: (urls: string[]) => void
}) {
  return (
    <div className="form-row product-images">
      <ImageSourceField
        label="Thumbnail"
        hint="Main image for this product."
        required
        error={thumbnailError}
        file={thumbnailFile}
        url={libraryThumbnail}
        existing={existingThumbnail}
        onFileChange={onThumbnailChange}
        onUrlChange={onLibraryThumbnailChange}
        onExistingChange={onExistingThumbnailChange}
      />
      <ImageSourceField
        label="Images"
        hint="Extra gallery images."
        multiple
        files={imageFiles}
        urls={libraryImages}
        existingList={existingImages}
        onFilesChange={onImagesChange}
        onUrlsChange={onLibraryImagesChange}
        onExistingListChange={onExistingImagesChange}
      />
    </div>
  )
}

export function ProductFormPage() {
  const navigate = useNavigate()
  const { canDelete } = useModuleCan('products')
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)
  const cloneId = isEdit ? '' : searchParams.get('clone') || ''
  const isClone = Boolean(cloneId)
  const sourceId = id || cloneId
  const [initialFormValues, setInitialFormValues] = useState<ProductForm>(initialForm)
  const formik = useFormik<ProductForm>({
    initialValues: initialFormValues,
    enableReinitialize: true,
    validationSchema: addProductValidationSchema,
    onSubmit: (values) => submitProduct(values),
  })
  const form = formik.values
  const setForm = formik.setValues
  const setFieldValue = formik.setFieldValue
  const [categories, setCategories] = useState<Category[]>([])
  const [sizeMasters, setSizeMasters] = useState<Size[]>([])
  const [selectedSizeNames, setSelectedSizeNames] = useState<string[]>([])
  const hiddenVariantsRef = useRef<Map<string, VariantItem>>(new Map())
  const [categoryInput, setCategoryInput] = useState('')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [libraryThumbnail, setLibraryThumbnail] = useState('')
  const [libraryImages, setLibraryImages] = useState<string[]>([])
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null)
  const [ogImageUrl, setOgImageUrl] = useState('')
  const [twitterImageUrl, setTwitterImageUrl] = useState('')
  const [existingOgImage, setExistingOgImage] = useState('')
  const [existingTwitterImage, setExistingTwitterImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [descriptionEditor, setDescriptionEditor] = useState({ token: 0, markdown: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [bundleItems, setBundleItems] = useState<SelectedBundleItem[]>([])
  const notificationRef = useRef<HTMLDivElement>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const savedSlug = useRef('')
  const savedGallery = useRef<string[]>([])
  const seoTouched = useRef(new Set<keyof SearchSocialValues>())
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview('')
      return
    }
    const url = URL.createObjectURL(thumbnailFile)
    setThumbnailPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [thumbnailFile])

  useEffect(() => {
    setLibraryThumbnail('')
    setLibraryImages([])
    setOgImageUrl('')
    setTwitterImageUrl('')
  }, [sourceId])

  useEffect(() => {
    let ignore = false
    setMissing(false)
    const productRequest = sourceId
      ? productsApi.getById(sourceId).catch((err: { response?: { status?: number } }) => {
          if (err?.response?.status === 404) return 'missing' as const
          throw err
        })
      : Promise.resolve(null)

    Promise.all([
      categoriesApi.getAll(),
      sizesApi.getActive(),
      productRequest,
    ])
      .then(([catsRes, sizesRes, productRes]) => {
        if (ignore) return
        if (productRes === 'missing') {
          setMissing(true)
          return
        }
        const categoryList = toArray<Category>(catsRes.data)
        const sizeList = toArray<Size>(sizesRes.data)
        setCategories(categoryList)
        setSizeMasters(sizeList)
        if (productRes) {
          const data = (productRes.data as { data?: Product }).data as Product & Record<string, unknown>
          const sizes = Array.isArray(data?.sizes) ? (data.sizes as SizeItem[]) : []
          const variants = Array.isArray(data?.variants) ? (data.variants as VariantItem[]) : []
          const savedSizeNames = [
            ...new Set(sizes.map((size) => canonicalSizeName(size.name, sizeList)).filter(Boolean)),
          ]
          const inferredType: ProductType =
            data?.product_type === 'simple' || data?.product_type === 'variable' || data?.product_type === 'bundle'
              ? data.product_type
              : variants.length > 0 || data?.is_variant
                ? 'variable'
                : 'simple'
          const singleVariant = (data?.variant as ProductForm['variant'] | undefined) ?? {
            sku: toText(data?.sku),
            stock: Number(data?.stock ?? 0),
            price: Number(data?.price ?? 0),
            max_price: 0,
          }
          setSelectedSizeNames(savedSizeNames)
          savedSlug.current = isClone ? '' : toText(data?.slug)
          const copySku = (value: unknown) => (isClone ? cloneSku(toText(value)) : toText(value))
          const description = toText(data?.description)
          setDescriptionEditor({ token: Date.now(), markdown: description })
          setInitialFormValues({
            title: isClone ? `${toText(data?.title)} (Copy)` : toText(data?.title),
            slug: isClone ? `${toText(data?.slug)}-copy` : toText(data?.slug),
            description,
            short_description: toText(data?.short_description),
            transition: isClone ? 'draft' : (toText(data?.transition) || 'publish'),
            sku: copySku(data?.sku),
            stock: Number(data?.stock ?? 0),
            weight: Number(data?.weight ?? 0),
            status: Boolean(data?.status),
            product_type: inferredType,
            is_best_seller: Boolean(data?.is_best_seller),
            is_new_arrival: Boolean(data?.is_new_arrival),
            custom_notes: toText(data?.custom_notes),
            meta_title: toText(data?.meta_title),
            meta_description: toText(data?.meta_description),
            meta_keywords: toText(data?.meta_keywords),
            og_title: toText(data?.og_title),
            og_description: toText(data?.og_description),
            twitter_title: toText(data?.twitter_title),
            twitter_description: toText(data?.twitter_description),
            json_ld: toText(data?.json_ld),
            categoryId: typeof data?.categoryId === 'object' ? toText(data?.categoryId?._id) : toText(data?.categoryId),
            thumbnail: toText(data?.thumbnail),
            images: Array.isArray(data?.images) ? (data.images as string[]) : [],
            variant: {
              sku: copySku(singleVariant.sku),
              stock: Number(singleVariant.stock ?? 0),
              price: Number(singleVariant.price ?? 0),
              max_price: Number(singleVariant.max_price ?? 0),
            },
            sizes,
            stock_manage: data?.stock_manage === true,
            stock_status: data?.stock_status === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
            max_selection: Number(data?.max_selection ?? 1) || 1,
            max_product_quantity: optionalBundleNumber(data?.max_product_quantity),
            variants: variants.map((v) => ({
              ...v,
              sku: copySku(v.sku),
              size: canonicalSizeName(v.size, sizeList),
              stock: Number(v.stock ?? 0),
              price: Number(v.price ?? 0),
              max_price: Number(v.max_price ?? 0),
              weight: Number(v.weight ?? 0),
              status: v.status !== false,
              is_default: v.is_default === true,
              stock_manage:
                v.stock_manage === true || (v.stock_manage == null && data?.stock_manage === true),
              stock_status: v.stock_status === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
            })),
          })
          savedGallery.current = (Array.isArray(data?.images) ? (data.images as string[]) : [])
            .map(toImageFieldValue)
            .filter(Boolean)
          setBundleItems(hydrateBundleItems(data?.bundle_items))
          setExistingOgImage(toText(data?.og_image))
          setExistingTwitterImage(toText(data?.twitter_image))
          setOgImageFile(null)
          setTwitterImageFile(null)
          setOgImageUrl('')
          setTwitterImageUrl('')
          const catId = typeof data?.categoryId === 'object' ? toText(data?.categoryId?._id) : toText(data?.categoryId)
          setCategoryInput(
            (typeof data?.categoryId === 'object' ? toText(data?.categoryId?.name) : '') ||
            (catId ? categoryList.find((c) => c._id === catId)?.name ?? '' : '')
          )
        } else {
          savedGallery.current = []
          setDescriptionEditor({ token: 0, markdown: '' })
          setCategoryInput('')
          setBundleItems([])
          setSelectedSizeNames([])
          setThumbnailFile(null)
          setImageFiles([])
          setExistingOgImage('')
          setExistingTwitterImage('')
          setOgImageFile(null)
          setTwitterImageFile(null)
          setSlugTouched(false)
          setInitialFormValues({ ...initialForm, transition: 'draft' })
        }
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        if (ignore) return
        setError(err?.response?.data?.message || 'Failed to load form data')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [sourceId, isClone])

  const categoryOptions = useMemo(() => categories.map((c) => ({ id: c._id, label: c.name })), [categories])
  const filteredCategoryOptions = useMemo(() => {
    const q = categoryInput.trim().toLowerCase()
    if (!q) return categoryOptions
    return categoryOptions.filter((c) => c.label.toLowerCase().includes(q))
  }, [categoryInput, categoryOptions])
  const sizeNameToItem = useMemo(() => {
    const map = new Map<string, SizeItem>()
    sizeMasters.forEach((s) => map.set(s.name, { name: s.name }))
    return map
  }, [sizeMasters])

  const sizeSelectOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    const add = (name: string) => {
      const value = name.trim()
      const key = value.toLowerCase()
      if (!value || seen.has(key)) return
      seen.add(key)
      options.push({ value, label: value })
    }
    sizeMasters.forEach((size) => add(size.name))
    selectedSizeNames.forEach(add)
    return options
  }, [sizeMasters, selectedSizeNames])

  useEffect(() => {
    const nextSizes = selectedSizeNames.map((name) => sizeNameToItem.get(name) ?? { name })
    // setValues' updater reads the form from the last render, so it can replace a
    // just-loaded product with the empty initial values. setFieldValue patches sizes only.
    setFieldValue('sizes', nextSizes, false)
  }, [selectedSizeNames, sizeNameToItem, setFieldValue])

  const seoSourceKey = JSON.stringify({
    title: form.title,
    short_description: form.short_description,
    description: form.description,
    sku: form.sku,
    variantSku: form.variant.sku,
    price: form.variant.price,
    stock: form.variant.stock,
    product_type: form.product_type,
    thumbnail: form.thumbnail,
    variants: form.variants.map((variant) => ({ sku: variant.sku, price: variant.price, stock: variant.stock })),
  })

  useEffect(() => {
    if (isEdit) return
    const current = formRef.current
    const next = buildProductSeo(current)
      ; (Object.keys(next) as (keyof SearchSocialValues)[]).forEach((key) => {
        if (seoTouched.current.has(key) || current[key] === next[key]) return
        setFieldValue(key, next[key], false)
      })
  }, [isEdit, seoSourceKey, setFieldValue])

  const variantsForSelectedSizes = (names: string[], current: ProductForm) => {
    const visible = new Map(current.variants.map((variant) => [variant.size, variant]))
    current.variants.forEach((variant) => {
      if (!names.includes(variant.size)) hiddenVariantsRef.current.set(variant.size, variant)
    })
    return withFirstSizeDefault(names.map((name) => {
      const kept = visible.get(name) ?? hiddenVariantsRef.current.get(name)
      if (kept) {
        hiddenVariantsRef.current.delete(name)
        return kept
      }
      return createSizeVariant(name, current.sku, current.weight)
    }))
  }

  const toggleSizeSelection = (name: string) => {
    const nextNames = selectedSizeNames.includes(name)
      ? selectedSizeNames.filter((item) => item !== name)
      : [...selectedSizeNames, name]
    setSelectedSizeNames(nextNames)
    setFieldValue('variants', variantsForSelectedSizes(nextNames, formRef.current), false)
  }

  const updateVariant = (index: number, key: keyof VariantItem, value: string | number | boolean) => {
    setForm((prev) => {
      const next = [...prev.variants]
      next[index] = { ...next[index], [key]: value }
      return { ...prev, variants: next }
    })
  }

  const setDefaultVariant = (index: number, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, variantIndex) => ({
        ...variant,
        is_default: checked ? variantIndex === index : variantIndex === index ? false : variant.is_default,
      })),
    }))
  }

  const syncCategoryFromInput = (): boolean => {
    const normalized = categoryInput.trim().toLowerCase()
    const matched = categoryOptions.find((c) => c.label.toLowerCase() === normalized)
    if (!matched) return false
    setForm((prev) => ({ ...prev, categoryId: matched.id }))
    setCategoryInput(matched.label)
    return true
  }

  const selectCategoryOption = (option: { id: string; label: string }) => {
    setForm((prev) => ({ ...prev, categoryId: option.id }))
    setCategoryInput(option.label)
    setCategoryDropdownOpen(false)
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const setProductType = (product_type: ProductType) => {
    if (isEdit) return
    const variants = variantsForSelectedSizes(product_type === 'variable' ? selectedSizeNames : [], formRef.current)
    setForm((p) => ({
      ...p,
      product_type,
      variants,
      max_selection: product_type === 'bundle' ? p.max_selection || 1 : 1,
      max_product_quantity: product_type === 'bundle' ? p.max_product_quantity : null,
    }))
    if (product_type !== 'bundle') setBundleItems([])
  }

  const showValidationError = (message: string) => {
    setError(message)
  }

  const fieldError = (path: string) => {
    if (formik.submitCount < 1) return ''
    const message = getIn(formik.errors, path)
    return typeof message === 'string' ? message : ''
  }

  const validationSummary = formik.submitCount > 0 ? firstErrorMessage(formik.errors) : ''
  const bannerMessage = error || validationSummary

  useEffect(() => {
    if (!bannerMessage && !success) return
    notificationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [bannerMessage, success, formik.submitCount])

  async function submitProduct(values: ProductForm) {
    setError('')
    setSuccess('')
    try {
      if (!thumbnailFile && !libraryThumbnail.trim() && !values.thumbnail.trim()) {
        showValidationError('Thumbnail is required')
        return
      }
      if (!syncCategoryFromInput()) {
        formik.setFieldError('categoryId', 'Please select a valid category from the searchable dropdown.')
        showValidationError('Please select a valid category from the searchable dropdown.')
        return
      }

      const categoryId = categoryOptions.find((option) => option.label.toLowerCase() === categoryInput.trim().toLowerCase())?.id ?? values.categoryId
      const current = { ...values, categoryId }
      const hasVariants = current.product_type === 'variable'
      const isBundle = current.product_type === 'bundle'
      if (isBundle) {
        const selection = Number(current.max_selection)
        if (bundleItems.length < 1) {
          showValidationError('Add at least one product to the bundle.')
          return
        }
        if (!Number.isInteger(selection) || selection < 1) {
          formik.setFieldError('max_selection', 'Max selection must be a whole number of at least 1.')
          showValidationError('Max selection must be a whole number of at least 1.')
          return
        }
        if (selection > bundleItems.length) {
          formik.setFieldError('max_selection', 'Max selection cannot be greater than the number of products in the bundle.')
          showValidationError('Max selection cannot be greater than the number of products in the bundle.')
          return
        }
        if (current.max_product_quantity != null && (!Number.isInteger(current.max_product_quantity) || current.max_product_quantity < 1)) {
          formik.setFieldError('max_product_quantity', 'Max single product quantity must be a whole number of at least 1.')
          showValidationError('Max single product quantity must be a whole number of at least 1.')
          return
        }
        if (current.max_product_quantity != null && current.max_product_quantity > selection) {
          formik.setFieldError('max_product_quantity', 'Max single product quantity cannot be greater than max selection.')
          showValidationError('Max single product quantity cannot be greater than max selection.')
          return
        }
        const missingVariant = bundleItems.find(
          (item) =>
            item.product_type === 'variable' &&
            (!item.variant_sku || !item.variant_key || item.missing_variant),
        )
        if (missingVariant) {
          showValidationError(
            missingVariant.missing_variant
              ? `The selected variant for ${missingVariant.title} is no longer available. Remove it or add the product again.`
              : `Select a variant for ${missingVariant.title}.`,
          )
          return
        }
        if (bundleItems.some((item) => item.missing || !item.product_id)) {
          showValidationError('Remove unavailable products from the bundle before saving.')
          return
        }
      }

      const payload = new FormData()
      payload.append('title', current.title)
      payload.append('slug', current.slug)
      payload.append('description', current.description)
      payload.append('short_description', current.short_description)
      payload.append('transition', current.transition.trim() || (isEdit ? 'publish' : 'draft'))
      payload.append('sku', hasVariants ? current.sku : (current.variant.sku || current.sku))
      payload.append('stock', String(hasVariants ? current.stock : current.variant.stock))
      if (!isBundle) {
        payload.append('weight', String(current.weight || 0))
      }
      payload.append('status', String(current.status))
      payload.append('stock_manage', String(current.stock_manage))
      payload.append('stock_status', current.stock_status)
      payload.append('product_type', current.product_type)
      payload.append('is_variant', String(hasVariants))
      payload.append('is_best_seller', String(current.is_best_seller))
      payload.append('is_new_arrival', String(current.is_new_arrival))
      payload.append('custom_notes', current.custom_notes)
      payload.append('meta_title', current.meta_title)
      payload.append('meta_description', current.meta_description)
      payload.append('meta_keywords', current.meta_keywords)
      payload.append('og_title', current.og_title)
      payload.append('og_description', current.og_description)
      payload.append('twitter_title', current.twitter_title)
      payload.append('twitter_description', current.twitter_description)
      payload.append('json_ld', current.json_ld)
      payload.append('categoryId', current.categoryId)
      payload.append('colors', JSON.stringify([]))
      payload.append('sizes', JSON.stringify(hasVariants ? current.sizes : []))
      if (hasVariants) {
        payload.append('variants', JSON.stringify(current.variants))
      } else if (isBundle) {
        payload.append('variants', JSON.stringify([]))
        payload.append(
          'variant',
          JSON.stringify({
            sku: current.variant.sku,
            stock: current.variant.stock,
            price: current.variant.price,
          }),
        )
        payload.append('max_selection', String(current.max_selection))
        payload.append('max_product_quantity', current.max_product_quantity == null ? '' : String(current.max_product_quantity))
        payload.append(
          'bundle_items',
          JSON.stringify(
            bundleItems.map((item) => ({
              product_id: item.product_id,
              variant_sku: item.product_type === 'variable' ? item.variant_sku : null,
              variant_key: item.product_type === 'variable' ? item.variant_key : null,
            })),
          ),
        )
      } else {
        payload.append('variants', JSON.stringify([]))
        payload.append('variant', JSON.stringify(current.variant))
      }
      if (thumbnailFile) payload.append('thumbnail', thumbnailFile)
      else if (libraryThumbnail.trim()) payload.append('thumbnail', toImageFieldValue(libraryThumbnail))
      else if (isClone && current.thumbnail.trim()) payload.append('thumbnail', toImageFieldValue(current.thumbnail))
      const keptImages = current.images.map(toImageFieldValue).filter(Boolean)
      const libraryPaths = libraryImages.map(toImageFieldValue).filter(Boolean)
      const imagePaths = [...new Set([...keptImages, ...libraryPaths])]
      const galleryChanged = keptImages.join('\n') !== savedGallery.current.join('\n')
      if (imageFiles.length) {
        if ((isEdit || isClone) && imagePaths.length) imagePaths.forEach((url) => payload.append('images', url))
        imageFiles.forEach((file) => payload.append('images', file))
      } else if (libraryPaths.length || galleryChanged || (isClone && imagePaths.length)) {
        if (imagePaths.length) imagePaths.forEach((url) => payload.append('images', url))
        else payload.append('images', '[]')
      }
      if (ogImageFile) payload.append('og_image', ogImageFile)
      else if (ogImageUrl.trim()) payload.append('og_image', toImageFieldValue(ogImageUrl))
      else if ((isEdit || isClone) && existingOgImage.trim()) payload.append('og_image', toImageFieldValue(existingOgImage))
      if (twitterImageFile) payload.append('twitter_image', twitterImageFile)
      else if (twitterImageUrl.trim()) payload.append('twitter_image', toImageFieldValue(twitterImageUrl))
      else if ((isEdit || isClone) && existingTwitterImage.trim()) {
        payload.append('twitter_image', toImageFieldValue(existingTwitterImage))
      }
      if (isEdit && id) await productsApi.update(id, payload)
      else await productsApi.create(payload)
      const slugs = [...new Set([savedSlug.current, current.slug].map((slug) => slug.trim()).filter(Boolean))]
      await revalidateStore([
        "home",
        "shop",
        "products",
        "category",
        ...slugs.map((slug) => ({ page: "product" as const, slug })),
      ])
      // Stay on the edit form after update; redirect only for create/clone.
      if (isEdit) {
        formik.setErrors({})
        setSuccess('Product updated')
      } else navigate('/products')
    } catch (err) {
      const apiMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : ''
      setError(apiMessage || 'Failed to save product')
    }
  }

  async function handleDelete() {
    if (!canDelete || !isEdit || !id) return
    if (!(await confirmDeleteItem(formik.values.title))) return
    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      await productsApi.delete(id)
      await revalidateStore(['home', 'shop', 'products', 'category'])
      navigate('/products')
    } catch (err) {
      const apiMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : ''
      setError(apiMessage || 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>

  if (missing) {
    return (
      <div className="product-form-page">
        <div className="product-form-bar">
          <div className="product-form-bar__copy">
            <h1 className="page-title">Edit Product</h1>
            <p className="page-subtitle">This product is no longer available.</p>
          </div>
          <div className="product-form-bar__actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/products')}>
              Back to products
            </button>
          </div>
        </div>
        <div className="alert alert-error product-form-error">Product not found</div>
      </div>
    )
  }

  const storeUrl = isEdit ? storeProductUrl(form.slug) : ''

  const saveActions = () => (
    <>
      {isEdit && storeUrl && (
        <a className="btn btn-ghost btn-icon action-icon action-icon--view" href={storeUrl} target="_blank" rel="noopener noreferrer" title="View" aria-label="View product">
          <ExternalLink size={16} />
        </a>
      )}
      {isEdit && canDelete && (
        <button type="button" className="btn btn-ghost btn-icon action-icon action-icon--delete" onClick={handleDelete} disabled={deleting || formik.isSubmitting} title="Delete" aria-label="Delete product">
          <Trash2 size={16} />
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => navigate('/products')} disabled={deleting} title="Cancel" aria-label="Cancel">
        <X size={16} />
      </button>
      <button type="submit" className="btn btn-primary" disabled={formik.isSubmitting || deleting}>
        {formik.isSubmitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
      </button>
    </>
  )

  return (
    <form
      noValidate
      onSubmit={(event) => {
        setSuccess('')
        formik.handleSubmit(event)
      }}
      className="product-form-page"
    >
      <div className="product-form-bar">
        <div className="product-form-bar__copy">
          <h1 className="page-title">{isEdit ? 'Edit Product' : isClone ? 'Clone Product' : 'Add Product'}</h1>
          <p className="page-subtitle">Add the product details, then choose how it is sold. Pricing, variants, and bundle items stay in that section.</p>
        </div>
        <div className="product-form-bar__actions">{saveActions()}</div>
      </div>
      {bannerMessage ? (
        <div ref={notificationRef} className="alert alert-error product-form-error">
          {bannerMessage}
        </div>
      ) : success ? (
        <div ref={notificationRef} className="alert alert-success product-form-error" role="status">
          {success}
        </div>
      ) : null}
      <div className="card product-form">
        <FormSection
          title="Product details"
          hint="Name, catalog placement, and the badges shown in the store."
        >
          <div className="form-row">
            <FormField label="Title" required error={fieldError('title')}>
              <input
                className={`input${fieldError('title') ? ' is-invalid' : ''}`}
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm((p) => ({
                    ...p,
                    title,
                    slug: slugTouched ? p.slug : productSlug(title),
                  }))
                }}
              />
            </FormField>
            <FormField label="Slug" required error={fieldError('slug')}>
              <input
                className={`input${fieldError('slug') ? ' is-invalid' : ''}`}
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setForm((p) => ({ ...p, slug: productSlug(e.target.value, false) }))
                }}
                onBlur={() => setForm((p) => ({ ...p, slug: productSlug(p.slug) }))}
              />
            </FormField>
          </div>
          <div className="form-row-3">
            <FormField label="Status">
              <label className="form-check">
                <input type="checkbox" checked={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))} />
                Active
              </label>
            </FormField>
            <FormField label="Product Visibility">
              <select
                className="select"
                value={form.transition}
                onChange={(e) => setForm((p) => ({ ...p, transition: e.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="publish">Publish</option>
                <option value="pending">Pending</option>
              </select>
            </FormField>
            <FormField label="Category" required error={fieldError('categoryId')}>
              <div ref={categoryDropdownRef} style={{ position: 'relative' }}>
                <input
                  className={`input${fieldError('categoryId') ? ' is-invalid' : ''}`}
                  value={categoryInput}
                  onFocus={() => setCategoryDropdownOpen(true)}
                  onChange={(e) => {
                    const value = e.target.value
                    const matched = categoryOptions.find((option) => option.label.toLowerCase() === value.trim().toLowerCase())
                    setCategoryInput(value)
                    setCategoryDropdownOpen(true)
                    setForm((prev) => ({ ...prev, categoryId: matched?.id ?? '' }))
                  }}
                  onBlur={syncCategoryFromInput}
                  placeholder="Search category..."
                />
                {categoryDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      maxHeight: 220,
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--bg-card)',
                      zIndex: 10,
                    }}
                  >
                    {filteredCategoryOptions.length > 0 ? (
                      filteredCategoryOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            borderRadius: 0,
                            padding: '10px 12px',
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCategoryOption(c)}
                        >
                          {c.label}
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: 13 }}>
                        No matching categories
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormField>
          </div>
          <div className="product-badges">
            <label className="product-badge">
              <input
                type="checkbox"
                checked={form.is_best_seller}
                onChange={(e) => setForm((p) => ({ ...p, is_best_seller: e.target.checked }))}
              />
              <span className="product-badge__title">Best seller</span>
            </label>
            <label className="product-badge">
              <input
                type="checkbox"
                checked={form.is_new_arrival}
                onChange={(e) => setForm((p) => ({ ...p, is_new_arrival: e.target.checked }))}
              />
              <span className="product-badge__title">New arrival</span>
            </label>
          </div>
        </FormSection>

        <FormSection
          title="How it is sold"
          hint="Pick a type. Pricing, variants, and bundle items all appear in this section."
        >
          <div className="product-type-options" role="radiogroup" aria-label="Product type">
            {PRODUCT_TYPE_CHOICES.map((choice) => {
              const selected = form.product_type === choice.value
              return (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`product-type-option${selected ? ' is-selected' : ''}`}
                  disabled={isEdit}
                  onClick={() => setProductType(choice.value)}
                >
                  <span className="product-type-option__title">{choice.title}</span>
                  <span className="product-type-option__detail">{choice.detail}</span>
                </button>
              )
            })}
          </div>
          {isEdit && (
            <p className="product-form-note">Product type stays as it was when this product was created.</p>
          )}
          {form.product_type !== 'variable' && (
            <div className="product-stock-row">
              <label className="product-stock-toggle">
                <span className="form-field-label">Manage stock</span>
                <span className="product-stock-toggle__box">
                  <input
                    type="checkbox"
                    checked={form.stock_manage}
                    onChange={(e) => setForm((p) => ({ ...p, stock_manage: e.target.checked }))}
                  />
                  <span>{form.stock_manage ? 'On' : 'Off'}</span>
                </span>
              </label>
              {form.stock_manage && (
                <FormField label="Stock status">
                  <select
                    className="select"
                    value={form.stock_status}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        stock_status: e.target.value === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
                      }))
                    }
                  >
                    <option value="in_stock">In stock</option>
                    <option value="out_of_stock">Out of stock</option>
                  </select>
                </FormField>
              )}
            </div>
          )}
          {(form.product_type === 'simple' || form.product_type === 'bundle') && (
            <div className="product-type-panel">
              <h3 className="product-type-panel__title">Pricing and stock</h3>
              <p className="product-type-panel__hint">
                {form.product_type === 'bundle'
                  ? 'Selling price is the amount the customer pays for this bundle.'
                  : 'MRP is the original price, shown when it is higher. Selling price is the amount the customer pays.'}
              </p>
              <div
                className={`product-price-grid product-price-grid--${1 + (form.stock_manage ? 1 : 0) + (form.product_type === 'simple' ? 3 : 1)
                  }`}
              >
                <FormField label="SKU">
                  <input
                    className="input"
                    value={form.variant.sku}
                    onChange={(e) => setForm((p) => ({ ...p, variant: { ...p.variant, sku: e.target.value } }))}
                  />
                </FormField>
                {form.stock_manage && (
                  <FormField label="Stock quantity" error={fieldError('variant.stock')}>
                    <input
                      type="number"
                      min={0}
                      className={`input${fieldError('variant.stock') ? ' is-invalid' : ''}`}
                      value={form.variant.stock}
                      onChange={(e) => setForm((p) => ({ ...p, variant: { ...p.variant, stock: readTypedNumber(e.target) } }))}
                    />
                  </FormField>
                )}
                {form.product_type === 'simple' && (
                  <FormField label="MRP" required error={fieldError('variant.max_price')}>
                    <input
                      type="number"
                      min={0}
                      className={`input${fieldError('variant.max_price') ? ' is-invalid' : ''}`}
                      value={form.variant.max_price}
                      onChange={(e) => setForm((p) => ({ ...p, variant: { ...p.variant, max_price: readTypedNumber(e.target) } }))}
                    />
                  </FormField>
                )}
                {(form.product_type === 'simple' || form.product_type === 'bundle') && (
                  <FormField label="Selling price" required error={fieldError('variant.price')}>
                    <input
                      type="number"
                      min={0}
                      className={`input${fieldError('variant.price') ? ' is-invalid' : ''}`}
                      value={form.variant.price}
                      onChange={(e) => setForm((p) => ({ ...p, variant: { ...p.variant, price: readTypedNumber(e.target) } }))}
                    />
                  </FormField>
                )}
                {form.product_type === 'simple' && (
                  <FormField label="Weight (kg)" error={fieldError('weight')}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`input${fieldError('weight') ? ' is-invalid' : ''}`}
                      value={form.weight}
                      onChange={(e) => setForm((p) => ({ ...p, weight: readTypedNumber(e.target) }))}
                    />
                  </FormField>
                )}
              </div>
            </div>
          )}

          {form.product_type === 'variable' && (
            <div className="product-type-panel">
              <h3 className="product-type-panel__title">Sizes and variants</h3>
              <p className="product-type-panel__hint">Check a size to set its price and stock. The first size you add is the default. Uncheck a size to hide it. MRP is the original price, shown when it is higher. Selling price is the amount the customer pays.</p>
              <div className="variant-toolbar">
                <div className="product-size-list">
                  {sizeSelectOptions.map((opt) => (
                    <label key={opt.value} className="form-check product-size-chip">
                      <input
                        type="checkbox"
                        checked={selectedSizeNames.includes(opt.value)}
                        onChange={() => toggleSizeSelection(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              {typeof formik.errors.variants === 'string' && formik.submitCount > 0 && (
                <p className="form-field-error">{formik.errors.variants}</p>
              )}
              {form.variants.length > 0 && (
                <div className="variant-list">
                  {form.variants.map((v, i) => {
                    const priceError = fieldError(`variants.${i}.price`)
                    const stockError = fieldError(`variants.${i}.stock`)
                    const maxPriceError = fieldError(`variants.${i}.max_price`)
                    const weightError = fieldError(`variants.${i}.weight`)
                    return (
                      <article key={v.size} className="variant-card">
                        <div className="variant-card__head">
                          <h4 className="variant-card__size">{v.size}</h4>
                          <label className="form-check">
                            <input
                              type="checkbox"
                              checked={v.is_default}
                              onChange={(e) => setDefaultVariant(i, e.target.checked)}
                            />
                            Default
                          </label>
                        </div>
                        <div className="variant-card__fields">
                          <FormField label="SKU">
                            <input className="input" value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} />
                          </FormField>
                          <label className="product-stock-toggle">
                            <span className="form-field-label">Manage stock</span>
                            <span className="product-stock-toggle__box">
                              <input
                                type="checkbox"
                                checked={v.stock_manage}
                                onChange={(e) => updateVariant(i, 'stock_manage', e.target.checked)}
                              />
                              <span>{v.stock_manage ? 'On' : 'Off'}</span>
                            </span>
                          </label>
                          {v.stock_manage && (
                            <FormField label="Stock status">
                              <select
                                className="select"
                                value={v.stock_status}
                                onChange={(e) =>
                                  updateVariant(
                                    i,
                                    'stock_status',
                                    e.target.value === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
                                  )
                                }
                              >
                                <option value="in_stock">In stock</option>
                                <option value="out_of_stock">Out of stock</option>
                              </select>
                            </FormField>
                          )}
                          {v.stock_manage && (
                            <FormField label="Stock quantity" error={stockError}>
                              <input type="number" className={`input${stockError ? ' is-invalid' : ''}`} min={0} value={v.stock} onChange={(e) => updateVariant(i, 'stock', readTypedNumber(e.target))} />
                            </FormField>
                          )}
                          <FormField label="MRP" required error={maxPriceError}>
                            <input type="number" className={`input${maxPriceError ? ' is-invalid' : ''}`} min={0} value={v.max_price} onChange={(e) => updateVariant(i, 'max_price', readTypedNumber(e.target))} />
                          </FormField>
                          <FormField label="Selling price" required error={priceError}>
                            <input
                              type="number"
                              className={`input${priceError ? ' is-invalid' : ''}`}
                              value={v.price}
                              onChange={(e) => updateVariant(i, 'price', readTypedNumber(e.target))}
                            />
                          </FormField>
                          <FormField label="Weight (kg)" error={weightError}>
                            <input type="number" className={`input${weightError ? ' is-invalid' : ''}`} min={0} step="0.01" value={v.weight} onChange={(e) => updateVariant(i, 'weight', readTypedNumber(e.target))} />
                          </FormField>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {form.product_type === 'bundle' && (
            <BundleItemsPicker
              items={bundleItems}
              onChange={setBundleItems}
              excludeProductId={isEdit ? id : undefined}
              selection={form.max_selection}
              selectionError={fieldError('max_selection')}
              onSelectionChange={(max_selection) => setForm((p) => ({ ...p, max_selection }))}
              totalLimit={form.max_product_quantity}
              totalLimitError={fieldError('max_product_quantity')}
              onTotalLimitChange={(max_product_quantity) => setForm((p) => ({ ...p, max_product_quantity }))}
            />
          )}
        </FormSection>

        <FormSection
          title="Images"
          hint="The thumbnail is the main image. Extra images are the gallery."
        >
          <ProductImagesFields
            thumbnailFile={thumbnailFile}
            imageFiles={imageFiles}
            existingThumbnail={form.thumbnail}
            existingImages={form.images}
            libraryThumbnail={libraryThumbnail}
            libraryImages={libraryImages}
            onThumbnailChange={setThumbnailFile}
            onImagesChange={setImageFiles}
            onExistingThumbnailChange={(thumbnail) => setForm((current) => ({ ...current, thumbnail }))}
            onExistingImagesChange={(images) => setForm((current) => ({ ...current, images }))}
            onLibraryThumbnailChange={setLibraryThumbnail}
            onLibraryImagesChange={setLibraryImages}
            thumbnailError={
              formik.submitCount > 0 && !thumbnailFile && !libraryThumbnail.trim() && !form.thumbnail.trim()
                ? 'Thumbnail is required'
                : ''
            }
          />
        </FormSection>

        <FormSection
          title="Description"
          hint="Shown on the product page."
        >
          <FormField
            label="Short description"
            hint={`${form.short_description.length} / ${TEXT_LIMITS.short_description}`}
            error={fieldError('short_description')}
          >
            <textarea
              className={`textarea${fieldError('short_description') ? ' is-invalid' : ''}`}
              rows={2}
              maxLength={TEXT_LIMITS.short_description}
              value={form.short_description}
              onChange={(e) => setForm((p) => ({
                ...p,
                short_description: limitText(p.short_description, e.target.value, TEXT_LIMITS.short_description),
              }))}
            />
          </FormField>
          <FormField
            label="Description"
            hint={`Format the product page text. Switch to source for markdown. ${form.description.length} / ${TEXT_LIMITS.description.toLocaleString()}`}
            error={fieldError('description')}
          >
            <ArticleMdxEditor
              key={sourceId ? `product-${sourceId}-${descriptionEditor.token}` : 'new-product'}
              markdown={sourceId ? descriptionEditor.markdown : form.description}
              maxLength={TEXT_LIMITS.description}
              onChange={(description) => setForm((current) => ({
                ...current,
                description: limitText(current.description, description, TEXT_LIMITS.description),
              }))}
              placeholder="Write the product description…"
            />
          </FormField>
          <FormField
            label="Custom notes"
            hint={`${form.custom_notes.length} / ${TEXT_LIMITS.custom_notes}`}
            error={fieldError('custom_notes')}
          >
            <textarea
              className={`textarea${fieldError('custom_notes') ? ' is-invalid' : ''}`}
              rows={2}
              maxLength={TEXT_LIMITS.custom_notes}
              value={form.custom_notes}
              onChange={(e) => setForm((p) => ({
                ...p,
                custom_notes: limitText(p.custom_notes, e.target.value, TEXT_LIMITS.custom_notes),
              }))}
              placeholder="Add any custom notes for this product..."
            />
          </FormField>
        </FormSection>

        <SearchAndSocialCard
          values={form}
          onChange={(key, value) => {
            if (!isEdit) seoTouched.current.add(key)
            setForm((p) => ({ ...p, [key]: value }))
          }}
          isEdit={isEdit}
          ogImageFile={ogImageFile}
          twitterImageFile={twitterImageFile}
          ogImageUrl={ogImageUrl}
          twitterImageUrl={twitterImageUrl}
          existingOgImage={existingOgImage}
          existingTwitterImage={existingTwitterImage}
          fallbackOgImage={!ogImageFile && !ogImageUrl && !existingOgImage ? thumbnailPreview || getProfileImageUrl(libraryThumbnail) || getProfileImageUrl(form.thumbnail) : undefined}
          fallbackTwitterImage={!twitterImageFile && !twitterImageUrl && !existingTwitterImage ? thumbnailPreview || getProfileImageUrl(libraryThumbnail) || getProfileImageUrl(form.thumbnail) : undefined}
          onOgImageChange={setOgImageFile}
          onTwitterImageChange={setTwitterImageFile}
          onOgImageUrlChange={setOgImageUrl}
          onTwitterImageUrlChange={setTwitterImageUrl}
        />

        <div className="product-form-actions">{saveActions()}</div>
      </div>
    </form>
  )
}

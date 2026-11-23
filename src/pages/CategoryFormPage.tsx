import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { categoriesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { useScrollToNotice } from '../hooks/useScrollToNotice'
import { ImageSourceField } from '../components/media/ImageSourceField'
import { slugify } from '../utils/slugify'

const categorySlug = (value: string, trim = true) => slugify(value, { trim, keepArabic: true })
import type { Category, CategoryFaq, CategoryPayload } from '../types/api'
import { SearchAndSocialCard } from '../components/products/SearchAndSocialCard'
import { FormField } from '../components/ui/FormField'
import { ArticleMdxEditor } from '../components/ArticleMdxEditor'

type FormState = {
  name: string
  slug: string
  parent_category: string
  is_mega_menu: boolean
  status: boolean
  description: string
  meta_title: string
  meta_description: string
  meta_keywords: string
  og_title: string
  og_description: string
  twitter_title: string
  twitter_description: string
  json_ld: string
}

const initialForm: FormState = {
  name: '',
  slug: '',
  parent_category: '',
  is_mega_menu: false,
  status: true,
  description: '',
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
  og_title: '',
  og_description: '',
  twitter_title: '',
  twitter_description: '',
  json_ld: '',
}

const FAQ_LIMITS = {
  question: 200,
  answer: 500,
} as const

function limitText(previous: string, next: string, max: number) {
  if (next.length <= max || next.length <= previous.length) return next
  return previous.length <= max ? next.slice(0, max) : previous
}

type FaqRow = CategoryFaq & { key: string }

let faqKeySeed = 0
const nextFaqKey = () => `faq-${Date.now()}-${faqKeySeed++}`

const emptyFaq = (): FaqRow => ({
  key: nextFaqKey(),
  question: '',
  answer: '',
  status: true,
})

function FormSection({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
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

function parseCategory(payload: unknown): Category | null {
  const body = payload as { data?: unknown }
  const nested = body?.data ?? payload
  if (nested && typeof nested === 'object' && '_id' in (nested as object)) return nested as Category
  return null
}

function parseCategoryList(payload: unknown): Category[] {
  const body = payload as { data?: Category[] | { list?: Category[] }; list?: Category[] }
  if (Array.isArray(body?.data)) return body.data
  if (body?.data && typeof body.data === 'object' && 'list' in body.data) return body.data.list ?? []
  if (Array.isArray(body?.list)) return body.list
  return []
}

function toImageFieldValue(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.replace(/^\/+/, '')
}

export function CategoryFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<FormState>(initialForm)
  const [faqs, setFaqs] = useState<FaqRow[]>(() => [emptyFaq()])
  const [parents, setParents] = useState<Category[]>([])
  const [slugTouched, setSlugTouched] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [ogImageUrl, setOgImageUrl] = useState('')
  const [twitterImageUrl, setTwitterImageUrl] = useState('')
  const [existingImage, setExistingImage] = useState('')
  const [existingOgImage, setExistingOgImage] = useState('')
  const [existingTwitterImage, setExistingTwitterImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || success, noticeRevision)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    const loadParents = categoriesApi.getAllCategories().then((res) => parseCategoryList(res.data))
    const loadCategory = isEdit && id ? categoriesApi.getById(id) : Promise.resolve(null)

    Promise.all([loadParents, loadCategory])
      .then(([parentList, categoryRes]) => {
        if (ignore) return
        setParents(parentList.filter((category) => category._id !== id))
        if (!categoryRes) return
        const row = parseCategory(categoryRes.data)
        if (!row) {
          setError('Category not found')
          return
        }
        const parentCategoryId =
          row.parent_category && typeof row.parent_category === 'object'
            ? row.parent_category._id
            : (row.parent_category ?? '')
        setForm({
          name: row.name ?? '',
          slug: row.slug ?? '',
          parent_category: parentCategoryId || '',
          is_mega_menu: Boolean(row.is_mega_menu),
          status: row.status !== false,
          description: row.description ?? '',
          meta_title: row.meta_title ?? '',
          meta_description: row.meta_description ?? '',
          meta_keywords: row.meta_keywords ?? '',
          og_title: row.og_title ?? '',
          og_description: row.og_description ?? '',
          twitter_title: row.twitter_title ?? '',
          twitter_description: row.twitter_description ?? '',
          json_ld: row.json_ld ?? '',
        })
        const loadedFaqs = Array.isArray(row.faqs) ? row.faqs : []
        setFaqs(
          loadedFaqs.length
            ? loadedFaqs.map((faq) => ({
                key: faq._id || nextFaqKey(),
                _id: faq._id,
                question: faq.question ?? '',
                answer: faq.answer ?? '',
                status: faq.status !== false,
              }))
            : [emptyFaq()],
        )
        setExistingImage(row.image ?? '')
        setExistingOgImage(row.og_image ?? '')
        setExistingTwitterImage(row.twitter_image ?? '')
        setSlugTouched(false)
      })
      .catch(() => {
        if (!ignore) setError(isEdit ? 'Failed to load category' : 'Failed to load categories')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [id, isEdit])

  const updateFaq = (index: number, patch: Partial<CategoryFaq>) => {
    setFaqs((current) => current.map((faq, faqIndex) => (faqIndex === index ? { ...faq, ...patch } : faq)))
  }

  const buildPayload = (): CategoryPayload | string => {
    const cleanedFaqs = faqs
      .map((faq) => ({
        ...(faq._id ? { _id: faq._id } : {}),
        question: faq.question.trim(),
        answer: faq.answer.trim(),
        status: faq.status !== false,
      }))
      .filter((faq) => faq.question || faq.answer)

    const incomplete = cleanedFaqs.find((faq) => !faq.question || !faq.answer)
    if (incomplete) return 'Each FAQ needs both a question and an answer.'

    const payload: CategoryPayload = {
      name: form.name,
      slug: categorySlug(form.slug),
      parent_category: form.parent_category || '',
      is_mega_menu: form.is_mega_menu,
      status: form.status,
      description: form.description,
      meta_title: form.meta_title,
      meta_description: form.meta_description,
      meta_keywords: form.meta_keywords,
      og_title: form.og_title,
      og_description: form.og_description,
      twitter_title: form.twitter_title,
      twitter_description: form.twitter_description,
      json_ld: form.json_ld,
      faqs: JSON.stringify(cleanedFaqs),
    }

    if (imageFile) payload.image = imageFile
    else if (imageUrl.trim()) payload.image = toImageFieldValue(imageUrl)
    else if (isEdit && existingImage.trim()) payload.image = toImageFieldValue(existingImage)

    if (ogImageFile) payload.og_image = ogImageFile
    else if (ogImageUrl.trim()) payload.og_image = toImageFieldValue(ogImageUrl)
    else if (isEdit && existingOgImage.trim()) payload.og_image = toImageFieldValue(existingOgImage)

    if (twitterImageFile) payload.twitter_image = twitterImageFile
    else if (twitterImageUrl.trim()) payload.twitter_image = toImageFieldValue(twitterImageUrl)
    else if (isEdit && existingTwitterImage.trim()) payload.twitter_image = toImageFieldValue(existingTwitterImage)

    return payload
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNoticeRevision((current) => current + 1)
    const nextErrors: { name?: string; slug?: string } = {}
    if (!form.name.trim()) nextErrors.name = 'Name is required.'
    if (!form.slug.trim()) nextErrors.slug = 'Slug is required.'
    setFieldErrors(nextErrors)
    if (nextErrors.name || nextErrors.slug) {
      setError(nextErrors.name || nextErrors.slug || 'Name and slug are required.')
      document.getElementById(nextErrors.name ? 'category-name' : 'category-slug')?.focus()
      return
    }
    const payload = buildPayload()
    if (typeof payload === 'string') {
      setError(payload)
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (isEdit && id) await categoriesApi.update(id, payload)
      else await categoriesApi.create(payload)
      const slug = form.slug.trim()
      await revalidateStore([
        'categories',
        'home',
        'category',
        ...(slug ? [{ page: 'category' as const, slug }] : []),
      ])
      if (isEdit) {
        setSuccess('Category updated')
      } else {
        navigate('/categories')
      }
    } catch (err) {
      const apiMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : ''
      setError(apiMessage || (isEdit ? 'Update failed' : 'Create failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>

  const imageHint = isEdit ? 'Leave empty to keep the current image' : 'Optional'
  const saveActions = () => (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => navigate('/categories')}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}
      </button>
    </>
  )

  return (
    <form noValidate onSubmit={handleSubmit} className="product-form-page">
      <div className="product-form-bar">
        <div className="product-form-bar__copy">
          <h1 className="page-title">{isEdit ? 'Edit Category' : 'Add Category'}</h1>
          <p className="page-subtitle">
            {isEdit
              ? 'Update catalog details, images, SEO, and FAQs for this category.'
              : 'Add catalog details, images, SEO, and FAQs for this category.'}
          </p>
        </div>
        <div className="product-form-bar__actions">{saveActions()}</div>
      </div>

      {error ? (
        <div ref={noticeRef} className="alert alert-error product-form-error">{error}</div>
      ) : success ? (
        <div ref={noticeRef} className="alert alert-success product-form-error" role="status">{success}</div>
      ) : null}

      <div className="card product-form">
        <FormSection title="Category details" hint="Name, parent, and how this category appears in the store.">
          <div className="form-row">
            <FormField label="Name" htmlFor="category-name" required error={fieldErrors.name}>
              <input
                id="category-name"
                className={`input${fieldErrors.name ? ' is-invalid' : ''}`}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value
                  setError('')
                  setFieldErrors((current) => ({ ...current, name: undefined, slug: undefined }))
                  setForm((current) => {
                    const slug = slugTouched && current.slug.trim() ? current.slug : categorySlug(name)
                    return { ...current, name, slug }
                  })
                }}
                required
              />
            </FormField>
            <FormField label="Slug" htmlFor="category-slug" required error={fieldErrors.slug}>
              <input
                id="category-slug"
                className={`input${fieldErrors.slug ? ' is-invalid' : ''}`}
                value={form.slug}
                onChange={(e) => {
                  const slug = categorySlug(e.target.value, false)
                  setError('')
                  setSlugTouched(slug.trim().length > 0)
                  setFieldErrors((current) => ({ ...current, slug: undefined }))
                  setForm((current) => ({ ...current, slug }))
                }}
                onBlur={() => setForm((current) => ({ ...current, slug: categorySlug(current.slug) }))}
                required
              />
            </FormField>
          </div>
          <FormField label="Parent Category">
            <select
              className="select"
              value={form.parent_category}
              onChange={(e) => setForm((current) => ({ ...current, parent_category: e.target.value }))}
            >
              <option value="">None</option>
              {parents.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Description">
            <ArticleMdxEditor
              key={isEdit ? `edit-${id}` : 'create'}
              markdown={form.description}
              onChange={(md) => setForm((current) => ({ ...current, description: md }))}
              placeholder="Write the category description…"
            />
          </FormField>
          <ImageSourceField
            label="Image"
            hint={imageHint}
            file={imageFile}
            url={imageUrl}
            existing={existingImage}
            onFileChange={setImageFile}
            onUrlChange={setImageUrl}
          />
          <div className="categories-form-toggles">
            <label className="categories-toggle-card">
              <span>Add to Homepage</span>
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.is_mega_menu}
                  onChange={(e) => setForm((current) => ({ ...current, is_mega_menu: e.target.checked }))}
                />
                <span className="toggle-switch-track" aria-hidden>
                  <span className="toggle-switch-thumb" />
                </span>
              </span>
            </label>
            <label className="categories-toggle-card">
              <span>Active</span>
              <span className="toggle-switch">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) => setForm((current) => ({ ...current, status: e.target.checked }))}
                />
                <span className="toggle-switch-track" aria-hidden>
                  <span className="toggle-switch-thumb" />
                </span>
              </span>
            </label>
          </div>
        </FormSection>

        <FormSection title="FAQs" hint="Optional questions shown with this category. Empty rows are ignored.">
          <div className="category-faq-list">
            {faqs.map((faq, index) => (
              <div key={faq.key} className="category-faq-card">
                <div className="category-faq-card__head">
                  <strong>FAQ {index + 1}</strong>
                  <div className="category-faq-card__actions">
                    <label className="form-check">
                      <input
                        type="checkbox"
                        checked={faq.status !== false}
                        onChange={(e) => updateFaq(index, { status: e.target.checked })}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon action-delete"
                      title="Remove FAQ"
                      aria-label="Remove FAQ"
                      onClick={() =>
                        setFaqs((current) => (current.length === 1 ? [emptyFaq()] : current.filter((_, faqIndex) => faqIndex !== index)))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <FormField label="Question" hint={`${faq.question.length} / ${FAQ_LIMITS.question}`}>
                  <input
                    className="input"
                    value={faq.question}
                    maxLength={FAQ_LIMITS.question}
                    onChange={(e) => updateFaq(index, { question: limitText(faq.question, e.target.value, FAQ_LIMITS.question) })}
                    placeholder="What sizes are available?"
                  />
                </FormField>
                <FormField label="Answer" hint={`${faq.answer.length} / ${FAQ_LIMITS.answer}`}>
                  <ArticleMdxEditor
                    key={faq.key}
                    markdown={faq.answer}
                    maxLength={FAQ_LIMITS.answer}
                    onChange={(answer) => updateFaq(index, { answer: limitText(faq.answer, answer, FAQ_LIMITS.answer) })}
                    placeholder="XS to XL"
                  />
                </FormField>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost category-faq-add" onClick={() => setFaqs((current) => [...current, emptyFaq()])}>
            <Plus size={16} /> Add FAQ
          </button>
        </FormSection>

        <SearchAndSocialCard
          values={form}
          onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
          isEdit={isEdit}
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

        <div className="product-form-actions">{saveActions()}</div>
      </div>
    </form>
  )
}

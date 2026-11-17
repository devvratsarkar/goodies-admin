import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { articlesApi, blogCategoriesApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { useScrollToNotice } from '../hooks/useScrollToNotice'
import { slugify } from '../utils/slugify'
import { getApiErrorMessage } from '../utils/apiError'
import type { Article, BlogCategory } from '../types/api'
import { FormField } from '../components/ui/FormField'
import { ArticleMdxEditor } from '../components/ArticleMdxEditor'
import { ImageSourceField, imageFieldValue } from '../components/media/ImageSourceField'
import { SearchAndSocialCard } from '../components/products/SearchAndSocialCard'

type ArticleForm = {
  title: string
  slug: string
  description: string
  category: string
  tags: string
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

const initialForm: ArticleForm = {
  title: '',
  slug: '',
  description: '',
  category: '',
  tags: '',
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

function parseArticle(res: { data: unknown }): Article | null {
  const body = res.data as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return null
  const nested = body.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Article
  }
  if ('_id' in body && 'title' in body) return body as unknown as Article
  return null
}

function categoryIdOf(category: Article['category']): string {
  if (!category || typeof category === 'string') return category || ''
  return category._id || ''
}

function parseCategories(res: { data: unknown }): BlogCategory[] {
  const body = res.data as { data?: BlogCategory[] } | null
  return Array.isArray(body?.data) ? body.data : []
}

export function ArticleFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [form, setForm] = useState<ArticleForm>(initialForm)
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [existingImage, setExistingImage] = useState<string>('')
  const [ogImageFile, setOgImageFile] = useState<File | null>(null)
  const [ogImageUrl, setOgImageUrl] = useState('')
  const [existingOgImage, setExistingOgImage] = useState<string>('')
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null)
  const [twitterImageUrl, setTwitterImageUrl] = useState('')
  const [existingTwitterImage, setExistingTwitterImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || success, noticeRevision)
  const [contentEditorKey, setContentEditorKey] = useState(0)
  const [slugTouched, setSlugTouched] = useState(false)
  const savedSlug = useRef('')
  const savedCategorySlug = useRef('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    const articleRequest = isEdit && id ? articlesApi.getById(id) : Promise.resolve(null)

    Promise.all([blogCategoriesApi.getAll(), articleRequest])
      .then(([categoryRes, articleRes]) => {
        if (!active) return
        const list = parseCategories(categoryRes)
        if (!articleRes) {
          setCategories(list)
          return
        }
        const article = parseArticle(articleRes)
        if (!article) {
          setCategories(list)
          setError('Blog not found')
          return
        }
        const selectedCategory = categoryIdOf(article.category)
        if (
          selectedCategory &&
          article.category &&
          typeof article.category !== 'string' &&
          !list.some((item) => item._id === selectedCategory)
        ) {
          list.unshift({
            _id: selectedCategory,
            name: article.category.name || 'Current category',
            slug: article.category.slug || '',
            status: article.category.status,
          })
        }
        setCategories(list)
        setForm({
          title: article.title ?? '',
          slug: article.slug ?? '',
          description: article.description ?? article.content ?? '',
          category: selectedCategory,
          tags: Array.isArray(article.tags) ? article.tags.join(', ') : '',
          status: Boolean(article.status),
          canonical_url: article.canonical_url ?? '',
          meta_title: article.meta_title ?? '',
          meta_description: article.meta_description ?? '',
          meta_keywords: article.meta_keywords ?? '',
          og_title: article.og_title ?? '',
          og_description: article.og_description ?? '',
          og_type: article.og_type ?? '',
          twitter_title: article.twitter_title ?? '',
          twitter_description: article.twitter_description ?? '',
          schema: article.schema ?? article.schema_markup ?? '',
        })
        savedSlug.current = article.slug ?? ''
        savedCategorySlug.current = typeof article.category === 'object' && article.category?.slug ? article.category.slug : ''
        setExistingImage(article.image ?? '')
        setExistingOgImage(article.og_image ?? '')
        setExistingTwitterImage(article.twitter_image ?? '')
        setContentEditorKey((key) => key + 1)
        setSlugTouched(false)
      })
      .catch((err) => {
        if (active) setError(getApiErrorMessage(err, 'Failed to load blog'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, isEdit])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNoticeRevision((current) => current + 1)
    setSubmitting(true)
    setError('')
    setSuccess('')
    if (!form.category) {
      setError('Category is required.')
      setSubmitting(false)
      return
    }
    if (!form.description.trim()) {
      setError('Description is required.')
      setSubmitting(false)
      return
    }
    const slug = slugify(form.slug)
    if (!slug) {
      setError('Slug is required.')
      setSubmitting(false)
      return
    }
    try {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('slug', slug)
      fd.append('description', form.description)
      fd.append('category', form.category)
      fd.append('tags', form.tags)
      fd.append('status', String(form.status))
      fd.append('canonical_url', form.canonical_url)
      fd.append('meta_title', form.meta_title)
      fd.append('meta_description', form.meta_description)
      fd.append('meta_keywords', form.meta_keywords)
      fd.append('og_title', form.og_title)
      fd.append('og_description', form.og_description)
      fd.append('og_type', form.og_type)
      fd.append('twitter_title', form.twitter_title)
      fd.append('twitter_description', form.twitter_description)
      fd.append('schema', form.schema)
      if (imageFile) fd.append('image', imageFile)
      else if (imageUrl.trim()) fd.append('image', imageFieldValue(imageUrl))
      if (ogImageFile) fd.append('og_image', ogImageFile)
      else if (ogImageUrl.trim()) fd.append('og_image', imageFieldValue(ogImageUrl))
      else if (isEdit && existingOgImage.trim()) fd.append('og_image', imageFieldValue(existingOgImage))
      if (twitterImageFile) fd.append('twitter_image', twitterImageFile)
      else if (twitterImageUrl.trim()) fd.append('twitter_image', imageFieldValue(twitterImageUrl))
      else if (isEdit && existingTwitterImage.trim()) fd.append('twitter_image', imageFieldValue(existingTwitterImage))

      if (isEdit && id) await articlesApi.update(id, fd)
      else await articlesApi.create(fd)
      const categorySlug = categories.find((item) => item._id === form.category)?.slug ?? ''
      const articleSlugs = [...new Set([savedSlug.current, form.slug.trim()].filter(Boolean))]
      const categorySlugs = [...new Set([savedCategorySlug.current, categorySlug].filter(Boolean))]
      await revalidateStore([
        'articles',
        ...articleSlugs.map((slug) => ({ page: 'article' as const, slug })),
        ...categorySlugs.map((slug) => ({ page: 'blog-category' as const, slug })),
      ])
      if (isEdit) {
        savedSlug.current = slug
        savedCategorySlug.current = categorySlug
        setSuccess('Blog updated')
      } else {
        navigate('/articles')
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save blog'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <Loader2 size={32} style={{ opacity: 0.6 }} />
      </div>
    )
  }

  const saveActions = () => (
    <>
      <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => navigate('/articles')}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Saving...' : isEdit ? 'Update blog' : 'Create blog'}
      </button>
    </>
  )

  return (
    <form onSubmit={submit} className="product-form-page">
      <div className="product-form-bar">
        <div className="product-form-bar__copy">
          <h1 className="page-title">{isEdit ? 'Edit blog' : 'Add blog'}</h1>
          <p className="page-subtitle">Title, slug, category, and description are required.</p>
        </div>
        <div className="product-form-bar__actions">{saveActions()}</div>
      </div>
      {error ? (
        <div ref={noticeRef} className="alert alert-error product-form-error">{error}</div>
      ) : success ? (
        <div ref={noticeRef} className="alert alert-success product-form-error" role="status">{success}</div>
      ) : null}
      <div className="card product-form">
          <div className="form-row">
            <FormField label="Title" required>
              <input
                className="input"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm((p) => ({
                    ...p,
                    title,
                    slug: slugTouched && p.slug.trim() ? p.slug : slugify(title),
                  }))
                }}
                required
              />
            </FormField>
            <FormField label="Slug" required>
              <input
                className="input"
                value={form.slug}
                onChange={(e) => {
                  const slug = slugify(e.target.value, { trim: false })
                  setSlugTouched(slug.trim().length > 0)
                  setForm((p) => ({ ...p, slug }))
                }}
                onBlur={() => setForm((p) => ({ ...p, slug: slugify(p.slug) }))}
                required
              />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Category" required>
              <select
                className="select"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                required
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tags" hint="Separate tags with commas.">
              <input
                className="input"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder="candy, gifts"
              />
            </FormField>
          </div>
          <FormField label="Status">
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.checked }))}
              />
              Active
            </label>
          </FormField>
          <FormField label="Description" required hint="Toolbar for formatting; use source mode for raw markdown / MDX.">
            <ArticleMdxEditor
              key={isEdit ? `${id}-${contentEditorKey}` : 'new-article'}
              markdown={form.description}
              onChange={(md) => setForm((p) => ({ ...p, description: md }))}
              placeholder="Start writing…"
            />
          </FormField>

          <h3 style={{ margin: '20px 0 12px', fontSize: 15 }}>Cover image</h3>
          <ImageSourceField
            label="Image"
            hint={isEdit ? 'Leave empty to keep the current image' : 'Optional'}
            file={imageFile}
            url={imageUrl}
            existing={existingImage}
            onFileChange={setImageFile}
            onUrlChange={setImageUrl}
          />

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

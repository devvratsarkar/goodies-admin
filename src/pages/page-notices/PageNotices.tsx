import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { pageNoticesApi } from '../../api/endpoints'
import { revalidateStore } from '../../api/revalidateStore'
import { useScrollToNotice } from '../../hooks/useScrollToNotice'
import type { PageNotices as PageNoticesData } from '../../types/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useModuleCan } from '../../components/rbac/useModuleCan'

const PAGE_NOTICES = [
  {
    key: 'cart_notice',
    enabledKey: 'cart_notice_enabled',
    label: 'Cart',
    hint: 'Shown under the breadcrumb on the cart page.',
  },
  {
    key: 'checkout_notice',
    enabledKey: 'checkout_notice_enabled',
    label: 'Checkout',
    hint: 'Shown under the breadcrumb on checkout.',
  },
  {
    key: 'product_notice',
    enabledKey: 'product_notice_enabled',
    label: 'Product page',
    hint: 'Shown under the breadcrumb on a single product.',
  },
] as const

type NoticeKey = (typeof PAGE_NOTICES)[number]['key']
type NoticeEnabledKey = (typeof PAGE_NOTICES)[number]['enabledKey']

type NoticeForm = {
  messages: Record<NoticeKey, string>
  enabled: Record<NoticeEnabledKey, boolean>
}

const EMPTY_FORM: NoticeForm = {
  messages: {
    product_notice: '',
    cart_notice: '',
    checkout_notice: '',
  },
  enabled: {
    product_notice_enabled: false,
    cart_notice_enabled: false,
    checkout_notice_enabled: false,
  },
}

function readNotices(res: { data: unknown }): PageNoticesData | null {
  const body = res.data as { data?: PageNoticesData } | PageNoticesData | null
  if (!body || typeof body !== 'object') return null
  if ('data' in body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) return body.data
  return body as PageNoticesData
}

export function PageNotices() {
  const { canEdit } = useModuleCan('page-notices')
  const [form, setForm] = useState<NoticeForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || message, noticeRevision)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    pageNoticesApi
      .get()
      .then((res) => {
        const notices = readNotices(res)
        setForm({
          messages: {
            product_notice: notices?.product_notice ?? '',
            cart_notice: notices?.cart_notice ?? '',
            checkout_notice: notices?.checkout_notice ?? '',
          },
          enabled: {
            product_notice_enabled: Boolean(notices?.product_notice_enabled),
            cart_notice_enabled: Boolean(notices?.cart_notice_enabled),
            checkout_notice_enabled: Boolean(notices?.checkout_notice_enabled),
          },
        })
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load page notices.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setNoticeRevision((current) => current + 1)
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await pageNoticesApi.update({
        product_notice: form.messages.product_notice,
        cart_notice: form.messages.cart_notice,
        checkout_notice: form.messages.checkout_notice,
        product_notice_enabled: form.enabled.product_notice_enabled,
        cart_notice_enabled: form.enabled.cart_notice_enabled,
        checkout_notice_enabled: form.enabled.checkout_notice_enabled,
      })
      await revalidateStore(['page-notices'])
      setMessage('Page notices saved.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card product-form global-settings-form page-notices-card">
        <h1 className="page-title">Page notices</h1>
        <div className="page-notices-loading">
          <Loader2 size={32} />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <div className="card product-form global-settings-form page-notices-card">
        <div className="page-header">
          <h1 className="page-title">Page notices</h1>
          <div className="global-settings-actions">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={load}>
              Reload
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !canEdit}>
              {saving ? 'Saving…' : 'Save notices'}
            </button>
          </div>
        </div>

        {(error || message) ? (
          <div ref={noticeRef}>
            {error && <div className="alert alert-error global-settings-alert">{error}</div>}
            {message && <div className="alert alert-success global-settings-alert">{message}</div>}
          </div>
        ) : null}

        <div className="page-notices">
          {PAGE_NOTICES.map((notice) => (
            <div key={notice.key} className="page-notice">
              <div className="page-notice__head">
                <div>
                  <label className="form-field-label" htmlFor={notice.key}>
                    {notice.label}
                  </label>
                  {/* <p className="form-field-hint">{notice.hint}</p> */}
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.enabled[notice.enabledKey]}
                    aria-label={`Show the ${notice.label} notice`}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        enabled: { ...current.enabled, [notice.enabledKey]: event.target.checked },
                      }))
                    }
                  />
                  <span className="toggle-switch-track" aria-hidden="true">
                    <span className="toggle-switch-thumb" />
                  </span>
                </label>
              </div>
              <input
                id={notice.key}
                className="input"
                type="text"
                value={form.messages[notice.key]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    messages: { ...current.messages, [notice.key]: event.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}

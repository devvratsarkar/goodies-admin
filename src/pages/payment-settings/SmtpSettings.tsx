import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { smtpSettingsApi } from '../../api/endpoints'
import { FormField } from '../../components/ui/FormField'
import type { SmtpSettings as SmtpSettingsData } from '../../types/api'
import { getApiErrorMessage } from '../../utils/apiError'
import { useScrollToNotice } from '../../hooks/useScrollToNotice'
import { useModuleCan } from '../../components/rbac/useModuleCan'

const emptyForm = {
  host: '',
  port: '587',
  secure: false,
  username: '',
  password: '',
  from_name: '',
  from_email: '',
  status: false,
}

function readSettings(res: { data: unknown }) {
  const body = res.data as { data?: SmtpSettingsData } | null
  return body?.data ?? null
}

const SMTP_PASSWORD_MAX = 64
const SMTP_PASSWORD_ERROR = `Password must be ${SMTP_PASSWORD_MAX} characters or fewer.`

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function passwordLengthError(password: string) {
  return password.length > SMTP_PASSWORD_MAX ? SMTP_PASSWORD_ERROR : ''
}

export function SmtpSettings() {
  const { canEdit } = useModuleCan('smtp-settings')
  const [form, setForm] = useState(emptyForm)
  const [hasPassword, setHasPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || message, noticeRevision)

  useEffect(() => {
    let ignore = false
    smtpSettingsApi
      .get()
      .then((res) => {
        if (ignore) return
        const settings = readSettings(res)
        if (!settings) return
        setHasPassword(Boolean(settings.has_password))
        setForm({
          host: settings.host || '',
          port: String(settings.port || 587),
          secure: Boolean(settings.secure),
          username: settings.username || '',
          password: '',
          from_name: settings.from_name || '',
          from_email: settings.from_email || '',
          status: Boolean(settings.status),
        })
      })
      .catch((err) => {
        if (!ignore) setError(getApiErrorMessage(err, 'Failed to load SMTP settings.'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setNoticeRevision((current) => current + 1)
    const host = form.host.trim()
    const username = form.username.trim()
    const fromName = form.from_name.trim()
    const fromEmail = form.from_email.trim()
    const passwordField = event.currentTarget.querySelector<HTMLInputElement>('#smtp-password')
    const password = passwordField?.value ?? form.password
    const port = Number(form.port)
    const passwordError = passwordLengthError(password)
    if (passwordError) {
      setError(passwordError)
      setMessage('')
      return
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError('Port must be a number from 1 to 65535.')
      setMessage('')
      return
    }
    if (fromEmail && !isEmail(fromEmail)) {
      setError('From email must be a valid email address.')
      setMessage('')
      return
    }
    if (form.status) {
      if (!host || !username || !fromEmail) {
        setError('Host, username, and from email are required when SMTP is turned on.')
        setMessage('')
        return
      }
      if (!password.trim() && !hasPassword) {
        setError('Password is required when SMTP is turned on.')
        setMessage('')
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await smtpSettingsApi.update({
        host,
        port,
        secure: form.secure,
        username,
        from_name: fromName,
        from_email: fromEmail,
        status: form.status,
        ...(password.trim() ? { password } : {}),
      })
      const settings = readSettings(res)
      setHasPassword(Boolean(settings?.has_password))
      setForm((current) => ({ ...current, password: '' }))
      setMessage('Saved.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Save failed.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <h1 className="page-title">SMTP settings</h1>
        <p className="page-subtitle">Send store emails through your mail server.</p>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <Loader2 size={32} style={{ opacity: 0.6 }} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">SMTP settings</h1>
          <p className="page-subtitle">Send store emails through your mail server.</p>
        </div>
      </div>
      <form className="card product-form global-settings-form" onSubmit={save}>
      {(error || message) ? (
        <div ref={noticeRef}>
          {error && <div className="alert alert-error global-settings-alert">{error}</div>}
          {message && <div className="alert alert-success global-settings-alert">{message}</div>}
        </div>
      ) : null}

      <section className="product-form-section">
        <div className="payment-gateway-list">
          <div className="payment-gateway-row">
            <div>
              <p className="payment-gateway-row__name">Use these SMTP settings</p>
              <p className="payment-gateway-row__note">
                Turn this on to send store emails through this mail server. Leave it off to keep the current mail setup.
              </p>
            </div>
            <label className="toggle-switch" htmlFor="smtp-status">
              <input
                id="smtp-status"
                type="checkbox"
                checked={form.status}
                disabled={saving}
                aria-label={`${form.status ? 'Turn off' : 'Turn on'} SMTP`}
                onChange={(event) => setField('status', event.target.checked)}
              />
              <span className="toggle-switch-track" aria-hidden>
                <span className="toggle-switch-thumb" />
              </span>
            </label>
          </div>
        </div>

        <div className="global-settings-grid-2" style={{ marginTop: 22 }}>
          <FormField label="Host" htmlFor="smtp-host" required={form.status}>
            <input
              id="smtp-host"
              className="input"
              value={form.host}
              disabled={saving}
              placeholder="smtp.example.com"
              onChange={(event) => setField('host', event.target.value)}
            />
          </FormField>
          <FormField label="Port" htmlFor="smtp-port" required>
            <input
              id="smtp-port"
              className="input"
              inputMode="numeric"
              value={form.port}
              disabled={saving}
              onChange={(event) => setField('port', event.target.value)}
            />
          </FormField>
          <FormField label="Username" htmlFor="smtp-username" required={form.status}>
            <input
              id="smtp-username"
              className="input"
              autoComplete="off"
              value={form.username}
              disabled={saving}
              onChange={(event) => setField('username', event.target.value)}
            />
          </FormField>
          <FormField
            label="Password"
            htmlFor="smtp-password"
            required={form.status && !hasPassword}
            hint={
              hasPassword
                ? `A password is already saved. Leave this blank to keep it. Maximum ${SMTP_PASSWORD_MAX} characters.`
                : `Saved only on the server. It is never shown again. Maximum ${SMTP_PASSWORD_MAX} characters.`
            }
            error={passwordLengthError(form.password)}
          >
            <input
              id="smtp-password"
              className="input"
              type="password"
              autoComplete="new-password"
              name="password"
              value={form.password}
              disabled={saving}
              onChange={(event) => {
                const next = event.target.value
                setField('password', next)
                if (passwordLengthError(next)) {
                  setError(SMTP_PASSWORD_ERROR)
                  setMessage('')
                } else {
                  setError((current) => (current === SMTP_PASSWORD_ERROR ? '' : current))
                }
              }}
            />
          </FormField>
          <FormField label="From name" htmlFor="smtp-from-name">
            <input
              id="smtp-from-name"
              className="input"
              value={form.from_name}
              disabled={saving}
              placeholder="Goodies"
              onChange={(event) => setField('from_name', event.target.value)}
            />
          </FormField>
          <FormField label="From email" htmlFor="smtp-from-email" required={form.status}>
            <input
              id="smtp-from-email"
              className="input"
              type="email"
              value={form.from_email}
              disabled={saving}
              placeholder="orders@example.com"
              onChange={(event) => setField('from_email', event.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Connection" htmlFor="smtp-secure" hint="Turn on for port 465. Leave off for port 587.">
          <label className="form-check" htmlFor="smtp-secure">
            <input
              id="smtp-secure"
              type="checkbox"
              checked={form.secure}
              disabled={saving}
              onChange={(event) => setField('secure', event.target.checked)}
            />
            Use a secure connection
          </label>
        </FormField>
      </section>

      <div className="product-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !canEdit}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
    </>
  )
}

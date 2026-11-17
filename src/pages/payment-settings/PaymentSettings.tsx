import { useEffect, useState } from 'react'
import { Banknote, CreditCard, Loader2 } from 'lucide-react'
import { globalSettingsApi } from '../../api/endpoints'
import { revalidateStore } from '../../api/revalidateStore'
import { useScrollToNotice } from '../../hooks/useScrollToNotice'
import { CodMethods } from './CodMethods'
import type { GlobalSettings } from '../../types/api'
import { FormField } from '../../components/ui/FormField'
import { getApiErrorMessage } from '../../utils/apiError'
import { useModuleCan } from '../../components/rbac/useModuleCan'

const GATEWAYS = [
  { key: 'ziina_enable', method: 'ziina', name: 'Ziina', note: 'Card payments at checkout.' },
  { key: 'tabby_enable', method: 'tabby', name: 'Tabby', note: 'Pay later in installments.' },
  { key: 'tamara_enable', method: 'tamara', name: 'Tamara', note: 'Pay later in installments.' },
] as const

type FlagKey = (typeof GATEWAYS)[number]['key']

type GatewayDraft = {
  default_payment_method: string
  ziina_enable: boolean
  tabby_enable: boolean
  tamara_enable: boolean
}

function draftFromSettings(settings: GlobalSettings | null): GatewayDraft {
  return {
    default_payment_method:
      GATEWAYS.find((gateway) => gateway.method === settings?.default_payment_method)?.method ?? 'ziina',
    ziina_enable: settings?.ziina_enable !== false,
    tabby_enable: settings?.tabby_enable !== false,
    tamara_enable: settings?.tamara_enable !== false,
  }
}

function readSettings(res: { data: unknown }) {
  const body = res.data as { data?: GlobalSettings } | null
  return body?.data ?? null
}

function SwitchRow({
  id,
  name,
  note,
  checked,
  disabled,
  onChange,
}: {
  id: string
  name: string
  note: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="payment-gateway-row">
      <div>
        <p className="payment-gateway-row__name">{name}</p>
        <p className="payment-gateway-row__note">{note}</p>
      </div>
      <label className="toggle-switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={`${checked ? 'Turn off' : 'Turn on'} ${name}`}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="toggle-switch-track" aria-hidden>
          <span className="toggle-switch-thumb" />
        </span>
      </label>
    </div>
  )
}

const TABS = [
  { id: 'gateways', label: 'Payment gateways', icon: CreditCard },
  { id: 'cod', label: 'COD settings', icon: Banknote },
] as const

type Tab = (typeof TABS)[number]['id']

function tabSubtitle(tab: Tab) {
  if (tab === 'gateways') return 'Turn a gateway on to offer it at checkout.'
  return 'Set the cash on delivery charge for each country.'
}

export function PaymentSettings() {
  const { canEdit } = useModuleCan('payment-settings')
  const [tab, setTab] = useState<Tab>('gateways')
  const [settings, setSettings] = useState<GlobalSettings | null>(null)
  const [draft, setDraft] = useState<GatewayDraft>(() => draftFromSettings(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [noticeRevision, setNoticeRevision] = useState(0)
  const noticeRef = useScrollToNotice(error || message, noticeRevision)

  useEffect(() => {
    globalSettingsApi
      .get()
      .then((res) => {
        const next = readSettings(res)
        setSettings(next)
        setDraft(draftFromSettings(next))
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load payment settings.')))
      .finally(() => setLoading(false))
  }, [])

  function setDefaultMethod(method: string) {
    setDraft((current) => ({ ...current, default_payment_method: method }))
    setMessage('')
    setError('')
  }

  function toggle(key: FlagKey, enabled: boolean) {
    setDraft((current) => ({ ...current, [key]: enabled }))
    setMessage('')
    setError('')
  }

  async function saveGateways() {
    if (!canEdit) return
    if (!settings || saving) return
    setNoticeRevision((current) => current + 1)
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await globalSettingsApi.update(draft)
      await revalidateStore(['global'])
      setSettings({ ...settings, ...draft })
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
        <h1 className="page-title">Payment settings</h1>
        <p className="page-subtitle">Turn payment gateways on or off, and manage cash on delivery.</p>
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
          <h1 className="page-title">Payment settings</h1>
          <p className="page-subtitle">{tabSubtitle(tab)}</p>
        </div>
      </div>

      <div className="payment-tabs" role="tablist" aria-label="Payment settings">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`payment-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <item.icon size={18} />
            <span className="payment-tab__label">{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'gateways' && (error || message) ? (
        <div ref={noticeRef}>
          {error && <div className="alert alert-error global-settings-alert">{error}</div>}
          {message && <div className="alert alert-success global-settings-alert">{message}</div>}
        </div>
      ) : null}

      {tab === 'gateways' ? (
        <form className="card product-form global-settings-form" onSubmit={(event) => { event.preventDefault(); void saveGateways() }}>
          <div className="payment-default-row">
            <div className="payment-default">
              <FormField label="Default payment method" htmlFor="default-payment-method">
                <select
                  id="default-payment-method"
                  className="select"
                  value={draft.default_payment_method}
                  disabled={saving || !settings}
                  onChange={(event) => setDefaultMethod(event.target.value)}
                >
                  {GATEWAYS.map((gateway) => (
                    <option key={gateway.method} value={gateway.method}>
                      {gateway.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving || !settings || !canEdit}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
          <div className="payment-gateway-list">
            {GATEWAYS.map((gateway) => (
              <SwitchRow
                key={gateway.key}
                id={gateway.key}
                name={gateway.name}
                note={gateway.note}
                checked={draft[gateway.key]}
                disabled={saving || !settings}
                onChange={(checked) => toggle(gateway.key, checked)}
              />
            ))}
          </div>
        </form>
      ) : (
        <CodMethods />
      )}
    </>
  )
}

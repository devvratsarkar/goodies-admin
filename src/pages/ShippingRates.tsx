import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { shippingRatesApi, shippingZonesApi } from '../api/endpoints'
import { adminConfirm } from '../utils/adminConfirm'
import type { ShippingRate, ShippingZone } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import { useModuleCan } from '../components/rbac/useModuleCan'
type Tab = 'zones' | 'rates'
type Method = 'flat' | 'weight'
type FreeShippingRequires = 'not_required' | 'minimum_order_amount'

type ZoneForm = {
  name: string
  countries: string[]
  status: boolean
}

type RateForm = {
  title: string
  method: Method
  shippingZoneId: string
  flatCost: string
  baseCost: string
  perKg: string
  stepKg: string
  skipKg: string
  isFreeShipping: boolean
  freeShippingRequires: FreeShippingRequires
  minimumOrderAmount: string
  status: boolean
}

const initialZoneForm: ZoneForm = { name: '', countries: [], status: true }

const zoneNameValue = (value: string) => value.replace(/[^\p{L}\p{N}\s.'-]/gu, '')
const initialRateForm: RateForm = {
  title: '',
  method: 'flat',
  shippingZoneId: '',
  flatCost: '',
  baseCost: '',
  perKg: '',
  stepKg: '1',
  skipKg: '0',
  isFreeShipping: false,
  freeShippingRequires: 'not_required',
  minimumOrderAmount: '',
  status: true,
}

const COUNTRY_CODES = [
  'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ',
  'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI',
  'CV', 'KH', 'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU', 'CY', 'CZ',
  'DK', 'DJ', 'DM', 'DO',
  'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET',
  'FJ', 'FI', 'FR',
  'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY',
  'HT', 'HN', 'HU',
  'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IL', 'IT',
  'JM', 'JP', 'JO',
  'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG',
  'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU',
  'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM',
  'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO',
  'OM',
  'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT',
  'QA',
  'RO', 'RU', 'RW',
  'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY',
  'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'TV',
  'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ',
  'VU', 'VA', 'VE', 'VN',
  'YE',
  'ZM', 'ZW',
] as const

type CountryOption = { code: string; name: string }

function buildCountryOptions(): CountryOption[] {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
  return COUNTRY_CODES
    .map((code) => ({ code, name: displayNames?.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } }
  return err?.response?.data?.message || fallback
}

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  return []
}

function zoneOf(rate: ShippingRate): ShippingZone | null {
  const zone = rate.shipping_zone_id
  if (!zone || typeof zone === 'string') return null
  return zone as ShippingZone
}

function zoneIdOf(rate: ShippingRate): string {
  const zone = rate.shipping_zone_id
  if (!zone) return ''
  return typeof zone === 'string' ? zone : zone._id
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span className={`order-status ${active ? 'order-status--success' : 'order-status--danger'}`}>
      <span className="order-status__dot" />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function priceLabel(rate: ShippingRate): string {
  const currency = rate.currency || 'AED'
  if (rate.method === 'weight') {
    const base = Number(rate.base_cost || 0).toFixed(2)
    const perKg = Number(rate.per_kg || 0).toFixed(2)
    const skip = Number(rate.skip_kg || 0)
    return `${currency} ${base} + ${perKg}/kg${skip ? `, first ${skip} kg included` : ''}`
  }
  return `${currency} ${Number(rate.flat_cost ?? rate.rate ?? 0).toFixed(2)}`
}

export function ShippingRates() {
  const { canCreate, canEdit, canDelete } = useModuleCan('shipping-rates')
  const countryOptions = useMemo(() => buildCountryOptions(), [])
  const countryNameMap = useMemo(
    () => new Map(countryOptions.map((country) => [country.code, country.name])),
    [countryOptions],
  )

  const [tab, setTab] = useState<Tab>('zones')
  const [zones, setZones] = useState<ShippingZone[]>([])
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const selectTab = (next: Tab) => {
    setTab(next)
    setSuccess('')
    setError('')
  }
  const [modal, setModal] = useState<'zone' | 'rate' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [zoneForm, setZoneForm] = useState<ZoneForm>(initialZoneForm)
  const [rateForm, setRateForm] = useState<RateForm>(initialRateForm)
  const [countryInput, setCountryInput] = useState('')
  const [countryOpen, setCountryOpen] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([shippingZonesApi.getAll(), shippingRatesApi.getAll()])
      .then(([zoneRes, rateRes]) => {
        setZones(toArray<ShippingZone>(zoneRes.data))
        setRates(toArray<ShippingRate>(rateRes.data))
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load shipping')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    setZoneForm(initialZoneForm)
    setRateForm(initialRateForm)
    setCountryInput('')
    setCountryOpen(false)
    setModalError('')
  }

  const openCreateZone = () => {
    setZoneForm(initialZoneForm)
    setCountryInput('')
    setModalError('')
    setEditingId(null)
    setModal('zone')
  }

  const openEditZone = (row: ShippingZone) => {
    setEditingId(row._id)
    setZoneForm({
      name: row.name || '',
      countries: Array.isArray(row.country) ? row.country.map((code) => String(code).toUpperCase()) : [],
      status: Boolean(row.status),
    })
    setCountryInput('')
    setModalError('')
    setModal('zone')
  }

  const openCreateRate = () => {
    setRateForm({
      ...initialRateForm,
      shippingZoneId: zones[0]?._id || '',
    })
    setModalError('')
    setEditingId(null)
    setModal('rate')
  }

  const openEditRate = (row: ShippingRate) => {
    setEditingId(row._id)
    setRateForm({
      title: row.title || '',
      method: row.method === 'weight' ? 'weight' : 'flat',
      shippingZoneId: zoneIdOf(row),
      flatCost: row.flat_cost == null ? '' : String(row.flat_cost),
      baseCost: row.base_cost == null ? '' : String(row.base_cost),
      perKg: row.per_kg == null ? '' : String(row.per_kg),
      stepKg: String(row.step_kg ?? 1),
      skipKg: String(row.skip_kg ?? 0),
      isFreeShipping: Boolean(row.is_free_shipping),
      freeShippingRequires: row.free_shipping_requires === 'minimum_order_amount'
        ? 'minimum_order_amount'
        : 'not_required',
      minimumOrderAmount: row.minimum_order_amount == null ? '' : String(row.minimum_order_amount),
      status: Boolean(row.status),
    })
    setModalError('')
    setModal('rate')
  }

  const filteredCountryOptions = useMemo(() => {
    const needle = countryInput.trim().toLowerCase()
    const selected = new Set(zoneForm.countries)
    return countryOptions.filter((country) => {
      if (selected.has(country.code)) return false
      if (!needle) return true
      return country.name.toLowerCase().includes(needle) || country.code.toLowerCase().includes(needle)
    })
  }, [countryInput, countryOptions, zoneForm.countries])

  const addCountry = (country: CountryOption) => {
    setZoneForm((prev) => ({
      ...prev,
      countries: prev.countries.includes(country.code) ? prev.countries : [...prev.countries, country.code],
      name: prev.name.trim() ? prev.name : country.name,
    }))
    setCountryInput('')
    setCountryOpen(false)
    if (modalError) setModalError('')
  }

  const removeCountry = (code: string) => {
    setZoneForm((prev) => ({ ...prev, countries: prev.countries.filter((item) => item !== code) }))
  }

  const handleZoneSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setModalError('')
    const zoneName = zoneNameValue(zoneForm.name).trim()
    if (!zoneName) {
      setModalError('Zone name is required.')
      setSubmitting(false)
      return
    }
    if (zoneName !== zoneForm.name.trim()) {
      setModalError('Zone name cannot include special characters.')
      setSubmitting(false)
      return
    }
    if (!zoneForm.countries.length) {
      setModalError('Add at least one country.')
      setSubmitting(false)
      return
    }
    const payload = {
      name: zoneName,
      country: zoneForm.countries,
      status: zoneForm.status,
    }
    try {
      if (editingId) await shippingZonesApi.update(editingId, payload)
      else await shippingZonesApi.create(payload)
      setSuccess(editingId ? 'Shipping zone updated' : 'Shipping zone created')
      closeModal()
      load()
    } catch (err) {
      setModalError(getErrorMessage(err, 'Save failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRateSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setModalError('')
    if (!rateForm.title.trim()) {
      setModalError('Title is required.')
      setSubmitting(false)
      return
    }
    if (!rateForm.shippingZoneId) {
      setModalError('Select a shipping zone.')
      setSubmitting(false)
      return
    }
    if (
      rateForm.isFreeShipping &&
      rateForm.freeShippingRequires === 'minimum_order_amount' &&
      !(Number(rateForm.minimumOrderAmount) > 0)
    ) {
      setModalError('Enter a minimum order amount greater than 0.')
      setSubmitting(false)
      return
    }
    const payload = {
      title: rateForm.title.trim(),
      method: rateForm.method,
      shipping_zone_id: rateForm.shippingZoneId,
      currency: 'AED',
      status: rateForm.status,
      is_free_shipping: rateForm.isFreeShipping,
      free_shipping_requires: rateForm.isFreeShipping ? rateForm.freeShippingRequires : 'not_required',
      minimum_order_amount:
        rateForm.isFreeShipping && rateForm.freeShippingRequires === 'minimum_order_amount'
          ? Number(rateForm.minimumOrderAmount)
          : 0,
      ...(rateForm.method === 'flat'
        ? { flat_cost: Number(rateForm.flatCost) }
        : {
            base_cost: Number(rateForm.baseCost),
            per_kg: Number(rateForm.perKg),
            step_kg: Number(rateForm.stepKg || 1),
            skip_kg: Number(rateForm.skipKg || 0),
          }),
    }
    try {
      if (editingId) await shippingRatesApi.update(editingId, payload)
      else await shippingRatesApi.create(payload)
      setSuccess(editingId ? 'Shipping rate updated' : 'Shipping rate created')
      closeModal()
      load()
    } catch (err) {
      setModalError(getErrorMessage(err, 'Save failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteZone = async (id: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Are you sure you want to delete this shipping zone?'))) return
    try {
      await shippingZonesApi.delete(id)
      setSuccess('Shipping zone deleted')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Delete failed'))
    }
  }

  const handleDeleteRate = async (id: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Are you sure you want to delete this shipping rate?'))) return
    try {
      await shippingRatesApi.delete(id)
      setSuccess('Shipping rate deleted')
      load()
    } catch (err) {
      setError(getErrorMessage(err, 'Delete failed'))
    }
  }

  const zoneColumns: ColumnDef<ShippingZone>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit" title="Edit zone" aria-label="Edit zone" onClick={() => openEditZone(row.original)}>
            <Pencil size={16} />
          </button>
          )}
          {canDelete && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete" title="Delete zone" aria-label="Delete zone" onClick={() => handleDeleteZone(row.original._id)}>
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="shipping-name">{String(getValue() || '—')}</span>,
    },
    {
      header: 'Countries',
      id: 'country',
      cell: ({ row }) => {
        const codes = Array.isArray(row.original.country) ? row.original.country : []
        if (!codes.length) return '—'
        return (
          <span className="shipping-countries-cell">
            {codes.map((code) => countryNameMap.get(String(code).toUpperCase()) || code).join(', ')}
          </span>
        )
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusChip active={Boolean(getValue())} />,
    },
  ]

  const rateColumns: ColumnDef<ShippingRate>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit" title="Edit rate" aria-label="Edit rate" onClick={() => openEditRate(row.original)}>
            <Pencil size={16} />
          </button>
          )}
          {canDelete && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete" title="Delete rate" aria-label="Delete rate" onClick={() => handleDeleteRate(row.original._id)}>
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      header: 'Zone',
      id: 'zone',
      cell: ({ row }) => zoneOf(row.original)?.name || '—',
    },
    {
      header: 'Title',
      accessorKey: 'title',
      cell: ({ getValue }) => <span className="shipping-name">{String(getValue() || '—')}</span>,
    },
    {
      header: 'Method',
      accessorKey: 'method',
      cell: ({ getValue }) => (
        <span className="shipping-method">{getValue() === 'weight' ? 'Weight' : 'Flat'}</span>
      ),
    },
    { header: 'Price', id: 'price', cell: ({ row }) => priceLabel(row.original) },
    {
      header: 'Free shipping',
      id: 'free_shipping',
      cell: ({ row }) => {
        if (!row.original.is_free_shipping) return '—'
        if (row.original.free_shipping_requires === 'minimum_order_amount') {
          const amount = Number(row.original.minimum_order_amount || 0).toFixed(2)
          return `Min ${row.original.currency || 'AED'} ${amount}`
        }
        return 'Yes'
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => <StatusChip active={Boolean(getValue())} />,
    },
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipping</h1>
          <p className="page-subtitle">Create a zone for each country, then add a flat or weight rate.</p>
        </div>
      </div>

      <div className="shipping-bar">
        <div className="shipping-tabs" role="tablist" aria-label="Shipping sections">
          <button type="button" className={`shipping-tab${tab === 'zones' ? ' is-active' : ''}`} aria-selected={tab === 'zones'} onClick={() => selectTab('zones')}>
            Zones
          </button>
          <button type="button" className={`shipping-tab${tab === 'rates' ? ' is-active' : ''}`} aria-selected={tab === 'rates'} onClick={() => selectTab('rates')}>
            Rates
          </button>
        </div>
        {canCreate && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={tab === 'zones' ? openCreateZone : openCreateRate}
        >
          <Plus size={18} /> {tab === 'zones' ? 'Add zone' : 'Add rate'}
        </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {tab === 'zones' ? (
        <DataTable className="shipping-table" data={zones} columns={zoneColumns} searchPlaceholder="Search shipping zones..." />
      ) : (
        <DataTable className="shipping-table" data={rates} columns={rateColumns} searchPlaceholder="Search shipping rates..." />
      )}

      {modal === 'zone' && (
        <Modal title={editingId ? 'Update Shipping Zone' : 'Create Shipping Zone'} onClose={closeModal}>
          <form className="modal-form" onSubmit={handleZoneSubmit}>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <FormField label="Zone name" required>
              <input
                type="text"
                className="input"
                value={zoneForm.name}
                onChange={(e) => setZoneForm((prev) => ({ ...prev, name: zoneNameValue(e.target.value) }))}
                placeholder="UAE"
                required
              />
            </FormField>
            <FormField label="Countries" required hint="A country can belong to only one zone.">
              <div className="shipping-country-picks">
                {zoneForm.countries.map((code) => (
                  <span key={code} className="shipping-country-pick">
                    {countryNameMap.get(code) || code}
                    <button type="button" onClick={() => removeCountry(code)} aria-label={`Remove ${countryNameMap.get(code) || code}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="shipping-country-search">
                <input
                  type="text"
                  className="input"
                  value={countryInput}
                  onFocus={() => setCountryOpen(true)}
                  onChange={(e) => {
                    setCountryInput(e.target.value)
                    setCountryOpen(true)
                  }}
                  onBlur={() => setTimeout(() => setCountryOpen(false), 120)}
                  placeholder="Type to search country"
                />
                {countryOpen && (
                  <div className="shipping-country-menu">
                    {filteredCountryOptions.length === 0 ? (
                      <div className="shipping-country-empty">No countries found</div>
                    ) : (
                      filteredCountryOptions.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          className="shipping-country-option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addCountry(country)}
                        >
                          {country.name} ({country.code})
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </FormField>
            <label className="form-check">
              <input
                type="checkbox"
                checked={zoneForm.status}
                onChange={(e) => setZoneForm((prev) => ({ ...prev, status: e.target.checked }))}
              />
              Active
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'rate' && (
        <Modal title={editingId ? 'Update Shipping Rate' : 'Create Shipping Rate'} onClose={closeModal}>
          <form className="modal-form" onSubmit={handleRateSubmit}>
            {modalError && <div className="alert alert-error">{modalError}</div>}
            <FormField label="Zone" required>
              <select
                className="select"
                value={rateForm.shippingZoneId}
                onChange={(e) => setRateForm((prev) => ({ ...prev, shippingZoneId: e.target.value }))}
                required
              >
                <option value="">Select zone</option>
                {zones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.name} ({(zone.country || []).join(', ')})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Title" required>
              <input
                type="text"
                className="input"
                value={rateForm.title}
                onChange={(e) => setRateForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Flat rate"
                required
              />
            </FormField>
            <FormField label="Method" required>
              <select
                className="select"
                value={rateForm.method}
                onChange={(e) => setRateForm((prev) => ({ ...prev, method: e.target.value as Method }))}
              >
                <option value="flat">Flat</option>
                <option value="weight">Weight</option>
              </select>
            </FormField>
            {rateForm.method === 'flat' ? (
              <FormField label="Flat cost (AED)" required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={rateForm.flatCost}
                  onChange={(e) => setRateForm((prev) => ({ ...prev, flatCost: e.target.value }))}
                  required
                />
              </FormField>
            ) : (
              <>
                <FormField label="Base cost (AED)" required hint="Starting price for the shipment.">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={rateForm.baseCost}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, baseCost: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Per kg (AED)" required>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={rateForm.perKg}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, perKg: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Step kg" required hint="Charge per kg is applied in steps of this size.">
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="input"
                    value={rateForm.stepKg}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, stepKg: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Skip kg" hint="Kilograms already included in the base cost.">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={rateForm.skipKg}
                    onChange={(e) => setRateForm((prev) => ({ ...prev, skipKg: e.target.value }))}
                  />
                </FormField>
              </>
            )}
            <label className="form-check">
              <input
                type="checkbox"
                checked={rateForm.isFreeShipping}
                onChange={(e) => setRateForm((prev) => ({ ...prev, isFreeShipping: e.target.checked }))}
              />
              Free shipping
            </label>
            {rateForm.isFreeShipping && (
              <FormField label="Free shipping requires">
                <select
                  className="select"
                  value={rateForm.freeShippingRequires}
                  onChange={(e) =>
                    setRateForm((prev) => ({
                      ...prev,
                      freeShippingRequires: e.target.value as FreeShippingRequires,
                    }))
                  }
                >
                  <option value="not_required">No requirement</option>
                  <option value="minimum_order_amount">Minimum order amount</option>
                </select>
              </FormField>
            )}
            {rateForm.isFreeShipping && rateForm.freeShippingRequires === 'minimum_order_amount' && (
              <FormField label="Minimum order amount (AED)" required>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="input"
                  value={rateForm.minimumOrderAmount}
                  onChange={(e) => setRateForm((prev) => ({ ...prev, minimumOrderAmount: e.target.value }))}
                  required
                />
              </FormField>
            )}
            <label className="form-check">
              <input
                type="checkbox"
                checked={rateForm.status}
                onChange={(e) => setRateForm((prev) => ({ ...prev, status: e.target.checked }))}
              />
              Active
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || zones.length === 0}>
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

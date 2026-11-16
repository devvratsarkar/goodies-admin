import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'
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

type ContinentGroup = { id: string; name: string; countries: readonly string[] }

/** WooCommerce continent groups, limited to the country codes this screen already saves. */
const CONTINENTS: ContinentGroup[] = [
  {
    id: 'AF',
    name: 'Africa',
    countries: [
      'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET',
      'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW',
      'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
    ],
  },
  {
    id: 'AS',
    name: 'Asia',
    countries: [
      'AF', 'AM', 'AZ', 'BH', 'BD', 'BT', 'BN', 'KH', 'CN', 'GE', 'IN', 'ID', 'IR', 'IQ', 'IL', 'JP', 'JO', 'KZ', 'KP', 'KR',
      'KW', 'KG', 'LA', 'LB', 'MY', 'MV', 'MN', 'MM', 'NP', 'OM', 'PK', 'PH', 'QA', 'SA', 'SG', 'LK', 'SY', 'TW', 'TJ', 'TH',
      'TL', 'TM', 'AE', 'UZ', 'VN', 'YE',
    ],
  },
  {
    id: 'EU',
    name: 'Europe',
    countries: [
      'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT',
      'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM', 'RS', 'SK', 'SI', 'ES',
      'SE', 'CH', 'TR', 'UA', 'GB', 'VA',
    ],
  },
  {
    id: 'NA',
    name: 'North America',
    countries: [
      'AG', 'BS', 'BB', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'SV', 'GD', 'GT', 'HT', 'HN', 'JM', 'MX', 'NI', 'PA', 'KN', 'LC',
      'VC', 'TT', 'US',
    ],
  },
  {
    id: 'OC',
    name: 'Oceania',
    countries: ['AU', 'FJ', 'KI', 'MH', 'FM', 'NR', 'NZ', 'PW', 'PG', 'WS', 'SB', 'TO', 'TV', 'VU'],
  },
]

type RegionToken = { key: string; label: string; codes: string[] }

function regionTokens(
  selected: string[],
  taken: Set<string>,
  nameOf: (code: string) => string,
): RegionToken[] {
  const selectedSet = new Set(selected.map((code) => code.toUpperCase()))
  const available = (codes: readonly string[]) =>
    codes.filter((code) => selectedSet.has(code) || !taken.has(code))
  const allCodes = CONTINENTS.flatMap((continent) => continent.countries)
  const availableAll = available(allCodes)
  if (
    availableAll.length > 0 &&
    availableAll.every((code) => selectedSet.has(code)) &&
    [...selectedSet].every((code) => availableAll.includes(code))
  ) {
    return [{ key: 'everywhere', label: 'Everywhere', codes: [...selectedSet] }]
  }

  const tokens: RegionToken[] = []
  const claimed = new Set<string>()
  for (const continent of CONTINENTS) {
    const availableHere = available(continent.countries)
    const selectedHere = continent.countries.filter((code) => selectedSet.has(code))
    if (!selectedHere.length) continue
    if (availableHere.length > 0 && availableHere.every((code) => selectedSet.has(code))) {
      tokens.push({ key: continent.id, label: continent.name, codes: selectedHere })
      selectedHere.forEach((code) => claimed.add(code))
    }
  }
  const leftovers = [...selectedSet].filter((code) => !claimed.has(code))
  leftovers
    .map((code) => ({ key: code, label: nameOf(code), codes: [code] }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((token) => tokens.push(token))
  return tokens
}

function continentsForCodes(codes: string[]) {
  const selected = new Set(codes.map((code) => code.toUpperCase()))
  return new Set(
    CONTINENTS.filter((continent) => continent.countries.some((code) => selected.has(code))).map((continent) => continent.id),
  )
}

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

function TriCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange: () => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [indeterminate, checked])
  return (
    <label className={`zone-region-check${disabled ? ' is-disabled' : ''}`}>
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span>{label}</span>
    </label>
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
  const [openContinents, setOpenContinents] = useState<Set<string>>(new Set())
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
    setOpenContinents(new Set())
    setModalError('')
  }

  const openCreateZone = () => {
    setZoneForm(initialZoneForm)
    setCountryInput('')
    setOpenContinents(new Set())
    setModalError('')
    setEditingId(null)
    setModal('zone')
  }

  const openEditZone = (row: ShippingZone) => {
    const countries = Array.isArray(row.country) ? row.country.map((code) => String(code).toUpperCase()) : []
    setEditingId(row._id)
    setZoneForm({
      name: row.name || '',
      countries,
      status: Boolean(row.status),
    })
    setCountryInput('')
    setOpenContinents(continentsForCodes(countries))
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

  const takenCountryCodes = useMemo(() => {
    const taken = new Set<string>()
    zones.forEach((zone) => {
      if (editingId && zone._id === editingId) return
      const codes = Array.isArray(zone.country) ? zone.country : []
      codes.forEach((code) => taken.add(String(code).toUpperCase()))
    })
    return taken
  }, [zones, editingId])

  const toggleCountryCodes = (codes: string[], suggestedName?: string) => {
    setZoneForm((prev) => {
      const current = prev.countries.map((code) => code.toUpperCase())
      const currentSet = new Set(current)
      const actionable = codes
        .map((code) => code.toUpperCase())
        .filter((code) => currentSet.has(code) || !takenCountryCodes.has(code))
      if (!actionable.length) return prev
      const allOn = actionable.every((code) => currentSet.has(code))
      const nextSet = new Set(currentSet)
      if (allOn) actionable.forEach((code) => nextSet.delete(code))
      else actionable.forEach((code) => nextSet.add(code))

      const next: string[] = []
      current.forEach((code) => {
        if (nextSet.has(code)) {
          next.push(code)
          nextSet.delete(code)
        }
      })
      CONTINENTS.forEach((continent) => {
        continent.countries.forEach((code) => {
          if (nextSet.has(code)) {
            next.push(code)
            nextSet.delete(code)
          }
        })
      })
      nextSet.forEach((code) => next.push(code))

      return {
        ...prev,
        countries: next,
        name: prev.name.trim() ? prev.name : (!allOn && suggestedName ? suggestedName : prev.name),
      }
    })
    if (modalError) setModalError('')
  }

  const removeCountryCodes = (codes: string[]) => {
    const drop = new Set(codes.map((code) => code.toUpperCase()))
    setZoneForm((prev) => ({
      ...prev,
      countries: prev.countries.filter((code) => !drop.has(code.toUpperCase())),
    }))
  }

  const countryFilter = countryInput.trim().toLowerCase()
  const selectedCountrySet = useMemo(
    () => new Set(zoneForm.countries.map((code) => code.toUpperCase())),
    [zoneForm.countries],
  )
  const regionChips = useMemo(
    () => regionTokens(zoneForm.countries, takenCountryCodes, (code) => countryNameMap.get(code) || code),
    [zoneForm.countries, takenCountryCodes, countryNameMap],
  )
  const knownCountryCodes = useMemo(
    () => CONTINENTS.flatMap((continent) => [...continent.countries]),
    [],
  )
  const selectableCountryCodes = useMemo(
    () => knownCountryCodes.filter((code) => selectedCountrySet.has(code) || !takenCountryCodes.has(code)),
    [knownCountryCodes, selectedCountrySet, takenCountryCodes],
  )
  const everywhereChecked = selectableCountryCodes.length > 0
    && selectableCountryCodes.every((code) => selectedCountrySet.has(code))
    && zoneForm.countries.every((code) => selectableCountryCodes.includes(code.toUpperCase()))
  const everywhereIndeterminate = zoneForm.countries.length > 0 && !everywhereChecked

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
      header: 'Zone Name',
      accessorKey: 'name',
      cell: ({ getValue }) => <span className="shipping-name">{String(getValue() || '—')}</span>,
    },
    {
      header: 'Regions',
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
      header: 'Shipping Method',
      id: 'shippingMethod',
      cell: ({ row }) => {
        const methods = [
          ...new Set(
            rates
              .filter((rate) => zoneIdOf(rate) === row.original._id)
              .map((rate) => (rate.method === 'weight' ? 'Weight' : 'Flat')),
          ),
        ]
        if (!methods.length) return '—'
        return (
          <span className="shipping-methods-cell">
            {methods.map((method) => (
              <span key={method} className="shipping-method">{method}</span>
            ))}
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
      header: 'Zone Name',
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
              <div className="zone-region-picker">
                <div className="zone-region-picker__field">
                  {regionChips.map((token) => (
                    <span key={token.key} className="zone-region-picker__chip">
                      {token.label}
                      <button type="button" onClick={() => removeCountryCodes(token.codes)} aria-label={`Remove ${token.label}`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="zone-region-picker__input"
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    placeholder={regionChips.length ? '' : 'Start typing to filter zones'}
                    aria-label="Filter zones"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                  />
                </div>
                <div className="zone-region-picker__tree">
                  {(!countryFilter || 'everywhere'.includes(countryFilter)) && (
                    <div className="zone-region-row">
                      <span className="zone-region-row__chevron zone-region-row__chevron--spacer" aria-hidden="true" />
                      <TriCheckbox
                        checked={everywhereChecked}
                        indeterminate={everywhereIndeterminate}
                        disabled={selectableCountryCodes.length === 0}
                        onChange={() => toggleCountryCodes(selectableCountryCodes, 'Everywhere')}
                        label="Everywhere"
                      />
                    </div>
                  )}
                  {CONTINENTS.map((continent) => {
                    const continentMatch = !countryFilter || continent.name.toLowerCase().includes(countryFilter)
                    const countries = continent.countries
                      .map((code) => ({
                        code,
                        name: countryNameMap.get(code) || code,
                        taken: takenCountryCodes.has(code) && !selectedCountrySet.has(code),
                      }))
                      .filter((country) => {
                        if (continentMatch) return true
                        return country.name.toLowerCase().includes(countryFilter) || country.code.toLowerCase().includes(countryFilter)
                      })
                      .sort((a, b) => a.name.localeCompare(b.name))
                    if (countryFilter && !countries.length) return null
                    const selectable = continent.countries.filter((code) => selectedCountrySet.has(code) || !takenCountryCodes.has(code))
                    const selectedHere = continent.countries.filter((code) => selectedCountrySet.has(code))
                    const checked = selectable.length > 0 && selectable.every((code) => selectedCountrySet.has(code))
                    const open = countryFilter ? countries.length > 0 : openContinents.has(continent.id)
                    return (
                      <div key={continent.id}>
                        <div className="zone-region-row">
                          <button
                            type="button"
                            className="zone-region-row__chevron"
                            aria-expanded={open}
                            aria-label={`${open ? 'Collapse' : 'Expand'} ${continent.name}`}
                            onClick={() => {
                              setOpenContinents((prev) => {
                                const next = new Set(prev)
                                if (next.has(continent.id)) next.delete(continent.id)
                                else next.add(continent.id)
                                return next
                              })
                            }}
                          >
                            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <TriCheckbox
                            checked={checked}
                            indeterminate={selectedHere.length > 0 && !checked}
                            disabled={selectable.length === 0}
                            onChange={() => toggleCountryCodes(selectable, continent.name)}
                            label={continent.name}
                          />
                        </div>
                        {open && countries.map((country) => (
                          <div
                            key={country.code}
                            className={`zone-region-row zone-region-row--child${country.taken ? ' is-disabled' : ''}`}
                            title={country.taken ? 'Already used in another zone' : undefined}
                          >
                            <TriCheckbox
                              checked={selectedCountrySet.has(country.code)}
                              disabled={country.taken}
                              onChange={() => toggleCountryCodes([country.code], country.name)}
                              label={country.name}
                            />
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  {countryFilter && !'everywhere'.includes(countryFilter) && CONTINENTS.every((continent) => {
                    const continentMatch = continent.name.toLowerCase().includes(countryFilter)
                    if (continentMatch) return false
                    return !continent.countries.some((code) => {
                      const name = countryNameMap.get(code) || code
                      return name.toLowerCase().includes(countryFilter) || code.toLowerCase().includes(countryFilter)
                    })
                  }) && (
                    <div className="zone-region-picker__empty">No countries found</div>
                  )}
                </div>
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

import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet } from 'lucide-react'
import Select from 'react-select'
import { subscribersApi } from '../api/endpoints'
import type { Subscriber } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { countrySelectStyles } from '../utils/countrySelectStyles'
import { isoDateParam, isWithinIsoDates } from '../utils/dateQuery'
import { useModuleCan } from '../components/rbac/useModuleCan'

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

const formatDate = (value?: string) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

type CountryOption = { code: string; label: string }

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

function buildCountryOptions(): CountryOption[] {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
  return COUNTRY_CODES
    .map((code) => ({ code, label: displayNames?.of(code) || code }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const COUNTRY_OPTIONS = buildCountryOptions()
const COUNTRY_LABEL_TO_CODE = new Map(COUNTRY_OPTIONS.map((c) => [c.label.toLowerCase(), c.code]))

const normalizeCountryCode = (value?: string | null): string => {
  const raw = (value || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  return COUNTRY_LABEL_TO_CODE.get(raw.toLowerCase()) || upper
}

const getRawCountry = (row: Subscriber): string => {
  const r = row as Subscriber & {
    country_code?: string | null
    countryCode?: string | null
    countryName?: string | null
  }
  return (
    r.country ||
    r.country_name ||
    r.country_code ||
    r.countryCode ||
    r.countryName ||
    ''
  )
}

const getCountryCode = (row: Subscriber) => normalizeCountryCode(getRawCountry(row))

const getCountryLabel = (row: Subscriber) => {
  const code = getCountryCode(row)
  return (
    row.country_name ||
    (row as Subscriber & { countryName?: string | null }).countryName ||
    COUNTRY_OPTIONS.find((c) => c.code === code)?.label ||
    getRawCountry(row) ||
    '-'
  )
}

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

function downloadSubscribersExcel(rows: Subscriber[]) {
  const headers = ['#', 'Email', 'Country', 'Subscribed At']
  const lines = rows.map((row, idx) => [
    row.id ?? idx + 1,
    row.email ?? '-',
    getCountryLabel(row),
    formatDate(row.createdAt),
  ])
  const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function Subscribers() {
  const { canExport } = useModuleCan('subscribers')
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<Subscriber[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [fromDate, setFromDate] = useState(() => isoDateParam(searchParams.get('fromDate')))
  const [toDate, setToDate] = useState(() => isoDateParam(searchParams.get('toDate')))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    setLoading(true)
    setError('')
    subscribersApi
      .getAll({ search: debouncedSearch.trim() || undefined })
      .then((res) => setData(toArray<Subscriber>(res.data)))
      .catch(() => setError('Failed to load subscribers'))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  const filteredData = data.filter((row) => {
    if (countries.length && !countries.includes(getCountryCode(row).toUpperCase())) return false
    return isWithinIsoDates(row.createdAt, fromDate, toDate)
  })

  const columns: ColumnDef<Subscriber>[] = [
    { header: '#', accessorKey: 'id', cell: ({ row }) => row.original.id ?? row.index + 1 },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Country', id: 'country', cell: ({ row }) => getCountryLabel(row.original) },
    {
      header: 'Subscribed At',
      accessorKey: 'createdAt',
      cell: ({ getValue }) => formatDate(getValue() as string | undefined),
    },
  ]

  if (loading && data.length === 0 && !search) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscribers</h1>
          <p className="page-subtitle">All newsletter subscribers.</p>
        </div>
      </div>

      <div className="card filter-toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From</span>
          <input type="date" className="input" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To</span>
          <input type="date" className="input" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </label>
        <div style={{ minWidth: 280, maxWidth: 420, width: '100%' }}>
          <Select
            isMulti
            options={COUNTRY_OPTIONS.map((c) => ({ value: c.code, label: c.label }))}
            value={COUNTRY_OPTIONS
              .filter((c) => countries.includes(c.code))
              .map((c) => ({ value: c.code, label: c.label }))}
            onChange={(selected) => setCountries((selected ?? []).map((item) => item.value))}
            placeholder="Filter countries..."
            closeMenuOnSelect={false}
            menuPortalTarget={document.body}
            menuPosition="fixed"
            styles={countrySelectStyles}
          />
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        data={filteredData}
        columns={columns}
        searchPlaceholder="Search subscribers..."
        serverSearch={{ value: search, onChange: setSearch }}
        headerRight={canExport ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadSubscribersExcel(filteredData)}>
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
        ) : undefined}
      />
    </>
  )
}

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Check, Copy, FileSpreadsheet } from 'lucide-react'
import Select from 'react-select'
import { reportsApi } from '../api/endpoints'
import type { PaymentReportItem } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { countrySelectStyles } from '../utils/countrySelectStyles'
import { isoDateParam } from '../utils/dateQuery'
import { useModuleCan } from '../components/rbac/useModuleCan'

function normalizePayload(payload: unknown): { totalRevenue: number; payments: PaymentReportItem[] } {
  if (!payload || typeof payload !== 'object') return { totalRevenue: 0, payments: [] }
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as {
    totalRevenue?: number
    payments?: unknown
  }
  return {
    totalRevenue: Number(data.totalRevenue ?? 0),
    payments: Array.isArray(data.payments) ? (data.payments as PaymentReportItem[]) : [],
  }
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

const getPaymentCountryCode = (row: PaymentReportItem): string =>
  normalizeCountryCode(row.country)

const getPaymentCountryLabel = (row: PaymentReportItem): string => {
  const code = getPaymentCountryCode(row)
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.label || row.country || '-'
}

function filterPaymentsByCountry(payments: PaymentReportItem[], countries: string[]) {
  if (!countries.length) return payments
  const selected = new Set(countries.map((code) => code.toUpperCase()))
  return payments.filter((row) => selected.has(getPaymentCountryCode(row)))
}

function sumPaymentRevenue(payments: PaymentReportItem[]) {
  return payments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
}

const formatAed = (value?: number | null) =>
  `AED ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className="payment-email">
      <span className="payment-email__text">{email}</span>
      <button
        type="button"
        className="payment-email__copy"
        onClick={() => void copy()}
        aria-label={copied ? 'Email copied' : 'Copy email'}
        title={copied ? 'Copied' : 'Copy email'}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  )
}

export function PaymentReport() {
  const { canExport } = useModuleCan('payment-report')
  const [searchParams] = useSearchParams()
  const [fromDate, setFromDate] = useState(() => isoDateParam(searchParams.get('fromDate')))
  const [toDate, setToDate] = useState(() => isoDateParam(searchParams.get('toDate')))
  const [countries, setCountries] = useState<string[]>([])
  const [rows, setRows] = useState<PaymentReportItem[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    const countryParam = countries.length ? countries : undefined
    reportsApi
      .getPaymentReport({ fromDate, toDate, country: countryParam })
      .then((res) => {
        const parsed = normalizePayload(res.data)
        const filteredPayments = filterPaymentsByCountry(parsed.payments, countries)
        setRows(filteredPayments)
        setTotalRevenue(
          countries.length ? sumPaymentRevenue(filteredPayments) : parsed.totalRevenue,
        )
      })
      .catch(() => setError('Failed to load payment report'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportExcel = async () => {
    if (!canExport) return
    try {
      setExporting(true)
      const res = await reportsApi.exportPaymentReport({ fromDate, toDate, country: countries.length ? countries : undefined })
      const blob = new Blob([res.data], {
        type: res.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payment-report-${fromDate || 'all'}-to-${toDate || 'all'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to export payment report')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnDef<PaymentReportItem>[] = [
    { header: 'Transaction ID', accessorKey: 'transactionId', cell: ({ getValue }) => (getValue() as string) || '-' },
    { header: 'User', accessorKey: 'userName', cell: ({ getValue }) => (getValue() as string) || '-' },
    {
      header: 'Email',
      accessorKey: 'userEmail',
      cell: ({ getValue }) => {
        const email = String(getValue() || '').trim()
        return email ? <CopyEmail email={email} /> : '-'
      },
    },
    { header: 'Item', accessorKey: 'item', cell: ({ getValue }) => (getValue() as string) || '-' },
    { header: 'Country', id: 'country', cell: ({ row }) => getPaymentCountryLabel(row.original) },
    { header: 'Type', accessorKey: 'type', cell: ({ getValue }) => (getValue() as string) || '-' },
    {
      header: 'Amount (AED)',
      id: 'amount',
      cell: ({ row }) => formatAed(row.original.amount),
    },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => (getValue() as string) || '-' },
    { header: 'Date', accessorKey: 'date', cell: ({ getValue }) => (getValue() as string) || '-' },
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment Report</h1>
          <p className="page-subtitle">Collected order revenue, same total as the dashboard for the same dates. Amounts are in AED.</p>
        </div>
      </div>

      <div className="card payment-filter-card">
        <div className="payment-filter-bar">
        <div className="payment-filter-fields">
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>From Date</div>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>To Date</div>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Country</div>
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
          <div className="payment-filter-actions">
            <button type="button" className="btn btn-primary" onClick={load}>
              Apply Filter
            </button>
            {canExport && (
            <button type="button" className="btn btn-primary" onClick={exportExcel} disabled={exporting}>
              <FileSpreadsheet size={16} />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            )}
          </div>
        </div>
        </div>
      </div>

      <div className="card payment-revenue-card">
        <div className="payment-revenue-card__label">Total revenue</div>
        <div className="payment-revenue-card__value">{formatAed(totalRevenue)}</div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable data={rows} columns={columns} searchPlaceholder="Search name, email, transaction, or item..." />
    </>
  )
}

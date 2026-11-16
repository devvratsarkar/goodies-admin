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

const COUNTRY_LABEL_TO_CODE = (() => {
  const map = new Map<string, string>()
  const displayNames =
    typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
  for (const code of COUNTRY_CODES) {
    const label = displayNames?.of(code)?.toLowerCase()
    if (label) map.set(label, code)
  }
  map.set('uk', 'GB')
  map.set('usa', 'US')
  map.set('uae', 'AE')
  return map
})()

/** Canonical key for grouping country stats (ISO code when possible). */
export function normalizeCountryKey(country?: string | null): string {
  const raw = (country ?? '').trim()
  if (!raw) return 'UNKNOWN'
  const upper = raw.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  return COUNTRY_LABEL_TO_CODE.get(raw.toLowerCase()) ?? raw.toLowerCase()
}

/** Human-readable country name for charts and tables. */
export function getCountryDisplayLabel(country?: string | null): string {
  const key = normalizeCountryKey(country)
  if (key === 'UNKNOWN') return 'Unknown'
  if (/^[A-Z]{2}$/.test(key)) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(key) ?? key
    } catch {
      return key
    }
  }
  const trimmed = (country ?? '').trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : key
}

export function mergeCountryCountPie<T extends { country?: string; count?: number }>(
  items: T[],
  topN = 10,
) {
  const merged = new Map<string, { country: string; count: number }>()
  for (const item of items) {
    const key = normalizeCountryKey(item.country)
    const count = Number(item.count) || 0
    const prev = merged.get(key)
    merged.set(key, {
      country: key,
      count: (prev?.count ?? 0) + count,
    })
  }
  return Array.from(merged.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map((item) => ({
      ...item,
      label: `${getCountryDisplayLabel(item.country)} (${item.count})`,
    }))
}

let countryNameOptions: string[] | null = null

/** Sorted country names for dropdowns. */
export function getCountryNameOptions(): string[] {
  if (countryNameOptions) return countryNameOptions
  const displayNames =
    typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
  countryNameOptions = COUNTRY_CODES
    .map((code) => displayNames?.of(code) || code)
    .filter((name, index, list) => list.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b))
  return countryNameOptions
}

/** Match a stored country name or code to a dropdown option. */
export function matchCountryName(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  const options = getCountryNameOptions()
  const exact = options.find((name) => name.toLowerCase() === raw.toLowerCase())
  if (exact) return exact
  const label = getCountryDisplayLabel(raw)
  if (!label || label === 'Unknown') return raw
  return options.find((name) => name.toLowerCase() === label.toLowerCase()) || raw
}

export function mergeCountryAmountPie<T extends { country?: string; amount?: number }>(
  items: T[],
  topN = 10,
) {
  const merged = new Map<string, { country: string; amount: number }>()
  for (const item of items) {
    const key = normalizeCountryKey(item.country)
    const amount = Number(item.amount) || 0
    const prev = merged.get(key)
    merged.set(key, {
      country: key,
      amount: Number(((prev?.amount ?? 0) + amount).toFixed(2)),
    })
  }
  return Array.from(merged.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN)
    .map((item) => ({
      ...item,
      label: getCountryDisplayLabel(item.country),
    }))
}

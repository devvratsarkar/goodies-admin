export type TimeMode = 'monthly' | 'yearly'

export type MonthRow = {
  year: number
  month: number
  orders: number
  revenue: number
  newMembers: number
}

export type CustomersByCountry = {
  id: string
  name: string
  count: number
  code?: string
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Real calendar date in `YYYY-MM-DD`, or null when the text is empty or impossible. */
export function parseIsoDate(iso: string): Date | null {
  const match = ISO_DATE.exec(iso.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function formatIsoDate(iso: string) {
  const date = parseIsoDate(iso)
  if (!date) return iso
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export type DateFilterError = {
  message: string
  from: boolean
  to: boolean
}

function dateBoundError(label: 'From' | 'To', value: string, today: string): DateFilterError | null {
  if (!value) return null
  if (!parseIsoDate(value)) {
    return { message: `${label} date is not a valid date.`, from: label === 'From', to: label === 'To' }
  }
  if (value > today) {
    return {
      message: `${label} date cannot be after today (${formatIsoDate(today)}).`,
      from: label === 'From',
      to: label === 'To',
    }
  }
  return null
}

/** Each filled date is checked on its own. The order is checked only when both are filled. */
export function getDateFilterError(fromDate: string, toDate: string, now = new Date()): DateFilterError | null {
  const from = fromDate.trim()
  const to = toDate.trim()
  const today = todayIso(now)
  return (
    dateBoundError('From', from, today) ??
    dateBoundError('To', to, today) ??
    (from && to && from > to
      ? { message: 'From date must be on or before the to date.', from: true, to: true }
      : null)
  )
}

function periodLabel(row: MonthRow) {
  const month = MONTH_LABELS[row.month - 1]
  if (!month) return String(row.year)
  return `${month} ${row.year}`
}

export function countSeries(rows: MonthRow[], pick: (row: MonthRow) => number) {
  return rows.map((row) => ({ period: periodLabel(row), count: pick(row) }))
}

export function revenueSeries(rows: MonthRow[]) {
  return rows.map((row) => ({ period: periodLabel(row), amount: row.revenue }))
}

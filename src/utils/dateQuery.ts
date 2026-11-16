export function isoDateParam(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export function isWithinIsoDates(value: string | null | undefined, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return true
  if (!value) return false
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return false
  if (fromDate && time < new Date(`${fromDate}T00:00:00`).getTime()) return false
  if (toDate && time > new Date(`${toDate}T23:59:59.999`).getTime()) return false
  return true
}

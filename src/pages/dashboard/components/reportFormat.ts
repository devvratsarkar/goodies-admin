const ARABIC_CHAR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

/** Catalog names store English and Arabic in one string ("MANGO SNACK مانغو"); split them for display. */
export function splitBilingual(value: string | null | undefined): { name: string; nameAr?: string } {
  const text = String(value ?? '').trim()
  const index = text.search(ARABIC_CHAR)
  if (index <= 0) return { name: text }
  return { name: text.slice(0, index).trim(), nameAr: text.slice(index).trim() }
}

export const formatCount = (value: number) => Number(value || 0).toLocaleString('en-US')

export const formatAed = (value: number) =>
  `AED ${new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`

/** `paused` keeps the last data while the date filter is half-filled. */
export type ReportPanelProps = { fromDate?: string; toDate?: string; paused?: boolean }

export const reportRange = (fromDate?: string, toDate?: string) =>
  fromDate && toDate ? { fromDate, toDate } : undefined

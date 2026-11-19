import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { FileSpreadsheet, Eye } from 'lucide-react'
import { contactUsApi } from '../api/endpoints'
import type { ContactUs } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
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

const text = (value?: string | null) => {
  const trimmed = String(value ?? '').trim()
  return trimmed || '-'
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`

function downloadContactEnquiriesExcel(rows: ContactUs[]) {
  const headers = ['First name', 'Last name', 'Phone', 'Email', 'Message', 'Date']
  const lines = rows.map((row) => [
    text(row.first_name),
    text(row.last_name),
    text(row.phone_number),
    text(row.email),
    text(row.message),
    formatDate(row.createdAt),
  ])
  const csv = [headers, ...lines].map((line) => line.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `contact-enquiries-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function ContactEnquiries() {
  const { canExport } = useModuleCan('contact-enquiries')
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<ContactUs[]>([])
  const [fromDate, setFromDate] = useState(() => isoDateParam(searchParams.get('fromDate')))
  const [toDate, setToDate] = useState(() => isoDateParam(searchParams.get('toDate')))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewEnquiry, setViewEnquiry] = useState<ContactUs | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    setLoading(true)
    setError('')
    contactUsApi
      .getAll({ search: debouncedSearch.trim() || undefined })
      .then((res) => setData(toArray<ContactUs>(res.data)))
      .catch(() => setError('Failed to load contact enquiries'))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  const columns: ColumnDef<ContactUs>[] = [
    {
      header: 'Action',
      id: 'actions',
      cell: ({ row }) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => setViewEnquiry(row.original)}
          title="View message"
        >
          <Eye size={16} />
        </button>
      ),
    },
    { header: 'First name', accessorKey: 'first_name', cell: ({ getValue }) => text(getValue() as string) },
    { header: 'Last name', accessorKey: 'last_name', cell: ({ getValue }) => text(getValue() as string) },
    { header: 'Phone', accessorKey: 'phone_number', cell: ({ getValue }) => text(getValue() as string) },
    { header: 'Email', accessorKey: 'email', cell: ({ getValue }) => text(getValue() as string) },
    {
      header: 'Message',
      accessorKey: 'message',
      cell: ({ getValue, row }) => {
        const value = text(getValue() as string)
        return (
          <span
            style={{ cursor: 'pointer', color: 'var(--accent)' }}
            onClick={() => setViewEnquiry(row.original)}
            title="Click to view full message"
          >
            {value.length > 100 ? `${value.slice(0, 100)}...` : value}
          </span>
        )
      },
    },
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: ({ getValue }) => formatDate(getValue() as string | undefined),
    },
  ]

  const visibleRows = data.filter((row) => isWithinIsoDates(row.createdAt, fromDate, toDate))

  if (loading && data.length === 0 && !search) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contact Enquiries</h1>
          <p className="page-subtitle">All messages from contact-us form.</p>
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
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DataTable
        data={visibleRows}
        columns={columns}
        searchPlaceholder="Search name, email, phone, or message..."
        serverSearch={{ value: search, onChange: setSearch }}
        headerRight={canExport ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadContactEnquiriesExcel(visibleRows)}>
            <FileSpreadsheet size={16} />
            Export Excel
          </button>
        ) : undefined}
      />

      {viewEnquiry && (
        <Modal title="Enquiry Details" onClose={() => setViewEnquiry(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px 12px', fontSize: '0.95rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>First name</span>
              <span>{text(viewEnquiry.first_name)}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Last name</span>
              <span>{text(viewEnquiry.last_name)}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Phone</span>
              <span>{text(viewEnquiry.phone_number)}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Email</span>
              <span>{text(viewEnquiry.email)}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Date</span>
              <span>{formatDate(viewEnquiry.createdAt)}</span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Message</span>
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '12px 16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6,
                maxHeight: 300,
                overflowY: 'auto',
              }}>
                {text(viewEnquiry.message)}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

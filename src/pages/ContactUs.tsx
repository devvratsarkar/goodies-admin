import { useState, useEffect } from 'react'
import { contactUsApi } from '../api/endpoints'
import type { ContactUs } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import type { ColumnDef } from '@tanstack/react-table'

export function ContactUs() {
  const [data, setData] = useState<ContactUs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState<ContactUs | null>(null)

  useEffect(() => {
    contactUsApi
      .getAll()
      .then((res) => {
        const d = (res.data as { data?: ContactUs[] })?.data
        setData(Array.isArray(d) ? d : [])
      })
      .catch(() => setError('Failed to load contact messages'))
      .finally(() => setLoading(false))
  }, [])

  const columns: ColumnDef<ContactUs, unknown>[] = [
    { header: 'First name', accessorKey: 'first_name' },
    { header: 'Last name', accessorKey: 'last_name' },
    { header: 'Phone', accessorKey: 'phone_number' },
    { header: 'Email', accessorKey: 'email' },
    {
      header: 'Message',
      accessorKey: 'message',
      cell: ({ row, getValue }) => {
        const full = (getValue() as string) ?? ''
        const short = full.length > 80 ? `${full.slice(0, 80)}...` : full || '—'
        return (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              padding: 0,
              justifyContent: 'flex-start',
              textAlign: 'left',
              whiteSpace: 'normal',
              maxWidth: 420,
            }}
            onClick={() => setActive(row.original)}
            title="View full message"
          >
            {short}
          </button>
        )
      },
    },
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined
        return v ? new Date(v).toLocaleString() : '—'
      },
    },
  ]

  if (loading) return <div className="page-loading">Loading...</div>
  if (error) return <div className="alert alert-error">{error}</div>

  return (
    <>
      <h1 className="page-title">Contact Enquiry</h1>
      <p className="page-subtitle">View contact form submissions.</p>
      <DataTable data={data} columns={columns} searchPlaceholder="Search contacts..." />

      {active && (
        <Modal title="Enquiry message" onClose={() => setActive(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
              <strong>First name</strong>
              <span>{active.first_name || '—'}</span>
              <strong>Last name</strong>
              <span>{active.last_name || '—'}</span>
              <strong>Phone</strong>
              <span>{active.phone_number || '—'}</span>
              <strong>Email</strong>
              <span>{active.email || '—'}</span>
              <strong>Date</strong>
              <span>{active.createdAt ? new Date(active.createdAt).toLocaleString() : '—'}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Message</strong>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  color: 'var(--text)',
                }}
              >
                {active.message || '—'}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

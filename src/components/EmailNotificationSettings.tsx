import { useEffect, useState } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { emailNotificationsApi } from '../api/endpoints'
import type { EmailNotificationSetting } from '../types/api'
import { DataTable } from './ui/DataTable'
import { Modal } from './ui/Modal'
import { FormField } from './ui/FormField'
import { useModuleCan } from './rbac/useModuleCan'

type EmailForm = {
  enabled: boolean
  recipients: string
  cc_receipients: string
  subject: string
  heading: string
  additional_content: string
}

const initialForm: EmailForm = {
  enabled: true,
  recipients: '',
  cc_receipients: '',
  subject: '',
  heading: '',
  additional_content: '',
}

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { data?: unknown }
  if (Array.isArray(root.data)) return root.data as T[]
  return []
}

export function EmailNotificationSettings() {
  const { canEdit } = useModuleCan('email-settings')
  const [rows, setRows] = useState<EmailNotificationSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<EmailNotificationSetting | null>(null)
  const [form, setForm] = useState<EmailForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  const load = (term = debouncedSearch) => {
    setLoading(true)
    setError('')
    emailNotificationsApi
      .getAll({ search: term.trim() || undefined })
      .then((res) => setRows(toArray<EmailNotificationSetting>(res.data)))
      .catch(() => setError('Failed to load email settings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const openEdit = (row: EmailNotificationSetting) => {
    setEditing(row)
    setForm({
      enabled: row.enabled !== false,
      recipients: row.recipients || '',
      cc_receipients: row.cc_receipients || '',
      subject: row.subject || '',
      heading: row.heading || '',
      additional_content: row.additional_content || '',
    })
  }

  const closeModal = () => {
    setEditing(null)
    setForm(initialForm)
  }

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit) return
    if (!editing) return
    setSubmitting(true)
    setError('')
    try {
      await emailNotificationsApi.update(editing.key, form)
      setSuccess('Email setting updated')
      closeModal()
      load()
    } catch {
      setError('Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<EmailNotificationSetting>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
            onClick={() => openEdit(row.original)}
            title="Edit email"
            aria-label="Edit email"
          >
            <Pencil size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      header: 'Email',
      accessorKey: 'label',
      cell: ({ row }) => row.original.label || row.original.key,
    },
    {
      header: 'Subject',
      accessorKey: 'subject',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: 'Recipients',
      accessorKey: 'recipients',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: 'Status',
      accessorKey: 'enabled',
      cell: ({ getValue }) => {
        const enabled = getValue() !== false
        return (
          <span className={`order-status ${enabled ? 'order-status--success' : 'order-status--danger'}`}>
            <span className="order-status__dot" />
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
        )
      },
    },
  ]

  if (loading && rows.length === 0 && !search) return <div className="page-loading">Loading...</div>

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <DataTable
        className="shipping-table"
        data={rows}
        columns={columns}
        searchPlaceholder="Search email settings..."
        serverSearch={{ value: search, onChange: setSearch }}
      />

      {editing && (
        <Modal title={editing.label || editing.key} onClose={closeModal}>
          <form className="modal-form" onSubmit={handleUpdate}>
            <label className="form-check">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable this email notification
            </label>
            <FormField
              label="Recipient(s)"
              hint="Use customer for the person this email is about, admin for store admins, or type email addresses. Separate with commas. Leave empty to keep the previous recipient."
            >
              <input
                className="input"
                value={form.recipients}
                onChange={(e) => setForm((prev) => ({ ...prev, recipients: e.target.value }))}
                placeholder="customer, admin, ops@example.com"
              />
            </FormField>
            <FormField
              label="CC recipient(s)"
              hint="Same rules: customer, admin, or specific emails. Leave empty for no CC."
            >
              <input
                className="input"
                value={form.cc_receipients}
                onChange={(e) => setForm((prev) => ({ ...prev, cc_receipients: e.target.value }))}
                placeholder="admin, copy@example.com"
              />
            </FormField>
            <FormField label="Subject" hint="Placeholders: {site_title}, {order_number}">
              <input
                className="input"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </FormField>
            <FormField label="Email heading">
              <input
                className="input"
                value={form.heading}
                onChange={(e) => setForm((prev) => ({ ...prev, heading: e.target.value }))}
              />
            </FormField>
            <FormField label="Additional content">
              <textarea
                className="textarea"
                rows={4}
                value={form.additional_content}
                onChange={(e) => setForm((prev) => ({ ...prev, additional_content: e.target.value }))}
              />
            </FormField>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !canEdit}>
                {submitting ? 'Saving...' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

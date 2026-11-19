import { useState, useEffect } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { authApi } from '../api/endpoints'
import type { User } from '../types/api'
import { DataTable } from '../components/ui/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

export function Users() {
  const [data, setData] = useState<User[]>([])
  const [totalCount, setTotalCount] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    setLoading(true)
    setError('')
    authApi
      .getAllUsers({ search: debouncedSearch.trim() || undefined, limit: 500 })
      .then((res) => {
        const body = res.data as {
          data?: { data?: User[]; pagination?: { total?: number } }
        }
        const list = body?.data?.data ?? []
        const pagination = body?.data?.pagination
        setData(Array.isArray(list) ? list : [])
        setTotalCount(pagination?.total)
      })
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  const columns: ColumnDef<User, unknown>[] = [
    {
      header: 'Name',
      id: 'name',
      accessorFn: (row) => [row.first_name, row.last_name].filter(Boolean).join(' '),
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    { header: 'Email', accessorKey: 'email', cell: ({ getValue }) => (getValue() as string) || '—' },
    // { header: 'Phone', accessorKey: 'phone', cell: ({ getValue }) => (getValue() as string) || '—' },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: ({ getValue }) => {
        const r = getValue() as User['role']
        return (typeof r === 'object' && r?.name) || r || '—'
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return v ? <span className={`badge ${v === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{v}</span> : '—'
      },
    },
    {
      header: 'KYC',
      accessorKey: 'kyc_status',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return v ? <span className={`badge ${v === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>{v}</span> : '—'
      },
    },
    {
      header: 'Created',
      id: 'created',
      cell: ({ row }) => {
        const v = row.original.createdAt ?? row.original.created_at
        return v ? new Date(v).toLocaleString() : '—'
      },
    },
  ]

  if (loading && data.length === 0 && !search) return <div className="page-loading">Loading users...</div>

  return (
    <>
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">View all users.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search users..."
        serverSearch={{ value: search, onChange: setSearch }}
        totalCount={totalCount}
        pageSize={10}
      />
    </>
  )
}

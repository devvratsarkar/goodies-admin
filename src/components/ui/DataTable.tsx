import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  totalCount?: number
  pageSize?: number
  pageSizeOptions?: number[]
  headerRight?: ReactNode
  /** Rendered inside the table card, above the search toolbar. */
  headerContent?: ReactNode
  /** Rendered under the rows, from the full filtered set rather than the current page. */
  summary?: (rows: T[]) => ReactNode
  className?: string
  /** When set, search is controlled by the parent (usually server-side search). */
  serverSearch?: {
    value: string
    onChange: (value: string) => void
  }
  /** When set, pagination is server-driven: data = current page, totalCount from API, onPageChange fetches new page */
  serverPagination?: {
    pageIndex: number
    pageSize: number
    totalCount: number
    onPageChange: (pageIndex: number, pageSize: number) => void
  }
}

export function DataTable<T extends object>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  totalCount,
  pageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  headerRight,
  headerContent,
  summary,
  className,
  serverSearch,
  serverPagination,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [clientPagination, setClientPagination] = useState({ pageIndex: 0, pageSize })

  const isServer = !!serverPagination
  const isServerSearch = !!serverSearch
  const skipClientFilter = isServer || isServerSearch
  const paginationState = isServer
    ? { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize }
    : clientPagination

  const globalFilterFn = (row: any, columnId: string, filterValue: unknown) => {
    const raw = row.getValue(columnId)
    const hay = String(raw ?? '').toLowerCase()
    const needle = String(filterValue ?? '').toLowerCase()
    return hay.includes(needle)
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: isServerSearch ? undefined : globalFilter,
      pagination: paginationState,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: isServerSearch ? undefined : setGlobalFilter,
    onPaginationChange: isServer ? undefined : setClientPagination,
    getCoreRowModel: getCoreRowModel(),
    ...(isServer ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    ...(skipClientFilter ? {} : { getFilteredRowModel: getFilteredRowModel() }),
    globalFilterFn,
    manualPagination: isServer,
    manualFiltering: skipClientFilter,
    pageCount: isServer && serverPagination ? Math.max(1, Math.ceil(serverPagination.totalCount / serverPagination.pageSize)) : undefined,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  })

  const canSearch = true
  const pageCount = isServer && serverPagination
    ? Math.max(1, Math.ceil(serverPagination.totalCount / serverPagination.pageSize))
    : table.getPageCount()
  const total = isServer && serverPagination ? serverPagination.totalCount : (totalCount ?? data.length)
  const filteredCount = skipClientFilter ? data.length : table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSizeVal = table.getState().pagination.pageSize
  const normalizedPageSizeOptions = Array.from(new Set([pageSizeVal, ...pageSizeOptions]))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
  const start = total > 0 ? pageIndex * pageSizeVal + 1 : 0
  const end = total > 0 ? Math.min((pageIndex + 1) * pageSizeVal, total) : 0
  const rowsForRender = isServer ? table.getSortedRowModel().rows : table.getRowModel().rows

  const handlePageChange = (newPageIndex: number, newPageSize: number) => {
    if (isServer && serverPagination) {
      serverPagination.onPageChange(newPageIndex, newPageSize)
    } else {
      setClientPagination((p) => ({ ...p, pageIndex: newPageIndex, pageSize: newPageSize }))
    }
  }

  return (
    <div className={className ? `card ${className}` : 'card'}>
      {headerContent}
      {canSearch && (
        <div className="table-toolbar">
          <div className="table-search">
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder={searchPlaceholder}
              value={isServerSearch ? serverSearch.value : globalFilter}
              onChange={(e) => (isServerSearch ? serverSearch.onChange(e.target.value) : setGlobalFilter(e.target.value))}
              style={{ paddingLeft: 40 }}
            />
          </div>
          {headerRight && (
            <div style={{ flex: '0 0 auto' }}>
              {headerRight}
            </div>
          )}
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    style={{
                      cursor: h.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[h.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowsForRender.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No data
                </td>
              </tr>
            ) : (
              rowsForRender.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {summary?.((skipClientFilter ? table.getCoreRowModel() : table.getFilteredRowModel()).rows.map((row) => row.original))}
      <div className="table-footer">
        <span>
          {total > 0 || filteredCount > 0 ? (
            <>
              {pageCount > 1 && `Page ${pageIndex + 1} of ${pageCount} · `}
              {isServer || filteredCount === data.length
                ? `Showing ${start}-${end} of ${total}`
                : `Showing ${table.getRowModel().rows.length} of ${filteredCount} (filtered from ${total})`}
            </>
          ) : (
            'No records'
          )}
        </span>
        <div className="table-footer-controls">
          {pageCount > 1 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => handlePageChange(pageIndex - 1, pageSizeVal)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!table.getCanNextPage()}
                onClick={() => handlePageChange(pageIndex + 1, pageSizeVal)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          {data.length > 0 && normalizedPageSizeOptions.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Rows per page</span>
              <select
                className="select"
                value={pageSizeVal}
                onChange={(e) => {
                  const size = Number(e.target.value)
                  handlePageChange(0, size)
                }}
                style={{ width: 'auto', padding: '4px 8px', minWidth: 56 }}
              >
                {normalizedPageSizeOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel,
  type GridValidRowModel,
} from '@mui/x-data-grid'

const DATA_GRID_MAX_PAGE_SIZE = 100

type MuiDataTableProps = {
  rows: GridValidRowModel[]
  columns: GridColDef[]
  getRowId: (row: GridValidRowModel) => string
  loading: boolean
  paginationModel: GridPaginationModel
  onPaginationModelChange: (model: GridPaginationModel) => void
  hideFooter?: boolean
  pageSizeOptions?: number[]
  density?: 'standard' | 'compact'
  showIndex?: boolean
  /** Keep the column header and pager in place and scroll the rows. */
  bodyScroll?: boolean
  sortingMode?: 'client' | 'server'
  sortModel?: GridSortModel
  onSortModelChange?: (model: GridSortModel) => void
  sortingOrder?: Array<'asc' | 'desc' | null | undefined>
} & (
  | { paginationMode: 'client'; rowCount?: never }
  | { paginationMode: 'server'; rowCount: number }
)

export function MuiDataTable({
  rows,
  columns,
  getRowId,
  loading,
  paginationMode,
  rowCount,
  paginationModel,
  onPaginationModelChange,
  hideFooter = false,
  pageSizeOptions = [10, 25, 50],
  density = 'standard',
  showIndex = false,
  bodyScroll = false,
  sortingMode,
  sortModel,
  onSortModelChange,
  sortingOrder,
}: MuiDataTableProps) {
  const compact = density === 'compact'
  const rowHeight = compact ? 52 : 76
  const headerHeight = compact ? 38 : 46
  const ownPager =
    !hideFooter &&
    (paginationModel.pageSize > DATA_GRID_MAX_PAGE_SIZE ||
      pageSizeOptions.some((size) => size > DATA_GRID_MAX_PAGE_SIZE))
  const totalRows = paginationMode === 'server' ? rowCount ?? 0 : rows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(paginationModel.pageSize, 1)))
  const safePage = Math.min(paginationModel.page, pageCount - 1)
  const visibleRows =
    ownPager && paginationMode === 'client'
      ? rows.slice(safePage * paginationModel.pageSize, (safePage + 1) * paginationModel.pageSize)
      : rows
  const rangeStart = totalRows === 0 ? 0 : safePage * paginationModel.pageSize + 1
  const rangeEnd = totalRows === 0 ? 0 : Math.min(totalRows, (safePage + 1) * paginationModel.pageSize)
  const indexColumn: GridColDef = {
    field: '__index',
    headerName: '#',
    width: 56,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) =>
      paginationModel.page * paginationModel.pageSize + params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
  }
  const grid = (
    <DataGrid
      rows={visibleRows}
      columns={showIndex ? [indexColumn, ...columns] : columns}
      getRowId={getRowId}
      loading={loading}
      paginationMode={ownPager ? 'server' : paginationMode}
      {...(ownPager ? { rowCount: visibleRows.length } : paginationMode === 'server' ? { rowCount } : {})}
      paginationModel={ownPager ? { page: 0, pageSize: DATA_GRID_MAX_PAGE_SIZE } : paginationModel}
      onPaginationModelChange={ownPager ? undefined : onPaginationModelChange}
      pageSizeOptions={ownPager ? [DATA_GRID_MAX_PAGE_SIZE] : pageSizeOptions}
      hideFooter={hideFooter || ownPager}
      disableColumnMenu
      disableRowSelectionOnClick
      {...(sortingMode
        ? {
            sortingMode,
            sortModel,
            onSortModelChange,
            sortingOrder,
          }
        : {})}
      autoHeight={!bodyScroll}
      rowHeight={rowHeight}
      columnHeaderHeight={headerHeight}
      className={compact ? 'mui-table--compact' : undefined}
      sx={{
        width: '100%',
        minWidth: 0,
        ...(bodyScroll
          ? {
              height: `min(${headerHeight + Math.max(visibleRows.length, 3) * rowHeight}px, calc(100dvh - 250px))`,
              maxHeight: 'calc(100dvh - 250px)',
            }
          : {}),
        border: 'none',
        color: 'var(--text)',
        fontFamily: 'var(--font-sans)',
        backgroundColor: 'transparent',
        '& .MuiDataGrid-columnHeaders, & .MuiDataGrid-columnHeader': {
          backgroundColor: 'var(--bg-elevated)',
        },
        '& .MuiDataGrid-columnHeaderTitle': {
          fontWeight: 600,
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
        },
        '& .MuiDataGrid-columnSeparator': { display: 'none' },
        '& .MuiDataGrid-cell': {
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          py: 1,
        },
        '& .MuiDataGrid-cell > *': {
          alignSelf: 'center',
          maxHeight: '100%',
        },
        '& .products-actions-cell': {
          overflow: 'visible',
        },
        '& .products-actions-cell > *': {
          maxHeight: 'none',
          pointerEvents: 'auto',
        },
        '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-cell:focus-within': {
          outline: 'none',
        },
        '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--bg-hover)' },
        '& .MuiDataGrid-footerContainer': {
          borderTop: '1px solid var(--border)',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
        },
        '& .MuiTablePagination-toolbar': {
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: '4px',
          minHeight: 52,
        },
        '& .MuiTablePagination-root, & .MuiIconButton-root': { color: 'var(--text-muted)' },
        '& .MuiDataGrid-cellEmpty, & .MuiDataGrid-scrollbarFiller': { p: 0, minWidth: 0 },
      }}
    />
  )

  if (!ownPager) return grid

  return (
    <div className={bodyScroll ? 'mui-table mui-table--scroll' : 'mui-table'}>
      {grid}
      <div className="mui-table-pager">
        <label className="mui-table-pager__size">
          Rows per page:
          <select
            className="select"
            value={paginationModel.pageSize}
            onChange={(event) =>
              onPaginationModelChange({ page: 0, pageSize: Number(event.target.value) })
            }
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span className="mui-table-pager__range">
          {rangeStart}–{rangeEnd} of {totalRows}
        </span>
        <button
          type="button"
          className="mui-table-pager__nav"
          aria-label="Previous page"
          disabled={safePage <= 0}
          onClick={() => onPaginationModelChange({ page: safePage - 1, pageSize: paginationModel.pageSize })}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="mui-table-pager__nav"
          aria-label="Next page"
          disabled={safePage >= pageCount - 1}
          onClick={() => onPaginationModelChange({ page: safePage + 1, pageSize: paginationModel.pageSize })}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

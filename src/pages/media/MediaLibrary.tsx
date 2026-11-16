import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Copy, Grid2x2, LayoutList, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { mediaApi } from '../../api/endpoints'
import { getProfileImageUrl } from '../../api/client'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { adminConfirm } from '../../utils/adminConfirm'
import { getApiErrorMessage } from '../../utils/apiError'
import type { MediaAsset, MediaGalleryPage } from '../../types/api'
import { AddMedia } from './AddMedia'
import { EditMedia } from './EditMedia'
import { ReplaceMedia } from './ReplaceMedia'
import { useModuleCan } from '../../components/rbac/useModuleCan'

type MediaFile = {
  id: string
  name: string
  url: string
  alt: string
  title?: string
  caption?: string
  description?: string
  fileName: string
  fileType?: string
  fileSize?: number
  dimensions?: string
  uploadedBy?: string
  status: boolean
  createdAt?: string
  updatedAt?: string
  deletable: boolean
}

type ViewMode = 'grid' | 'list'

const LIMIT_OPTIONS = [10, 20, 50]
const DEFAULT_LIMIT = 20

function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function mediaDateError(fromDate: string, toDate: string) {
  const today = todayIso()
  if (fromDate && fromDate > today) {
    return { message: 'From date cannot be after today.', from: true, to: false }
  }
  if (toDate && toDate > today) {
    return { message: 'To date cannot be after today.', from: false, to: true }
  }
  if (fromDate && toDate && fromDate > toDate) {
    return { message: 'From date must be on or before the to date.', from: true, to: true }
  }
  return null
}

function fileNameFromUrl(url: string) {
  const path = url.split('?')[0]?.split('#')[0] ?? url
  const name = path.split('/').filter(Boolean).pop() || 'image'
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function textOrEmpty(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function readMediaPage(payload: { data?: MediaGalleryPage } | undefined): MediaGalleryPage {
  const page = payload?.data
  const list = Array.isArray(page?.list) ? page.list : []
  const pagination = page?.pagination
  const total = Number(pagination?.total)
  const totalPages = Number(pagination?.totalPages)
  return {
    list,
    pagination: {
      page: Number(pagination?.page) || 1,
      limit: Number(pagination?.limit) || DEFAULT_LIMIT,
      total: Number.isFinite(total) ? total : list.length,
      totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    },
  }
}

function fileTypeFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  const types: Record<string, string> = {
    webp: 'image/webp',
    png: 'image/png',
    avif: 'image/avif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return ext ? types[ext] || '' : ''
}

function uploadedByName(value: MediaAsset['createdBy']) {
  if (!value || typeof value === 'string') return ''
  return textOrEmpty(value.name) || textOrEmpty(value.email)
}

function normalizeLibraryItem(item: MediaAsset): MediaFile | null {
  const url = textOrEmpty(item.file_url)
  if (!url) return null
  const title = textOrEmpty(item.title)
  const alt = textOrEmpty(item.alternative_text)
  const caption = textOrEmpty(item.caption)
  const description = textOrEmpty(item.description)
  const fileName = textOrEmpty(item.file_name) || fileNameFromUrl(url)
  const fileType = textOrEmpty(item.file_type) || fileTypeFromName(fileName)
  const fileSize = typeof item.file_size === 'number' && Number.isFinite(item.file_size) ? item.file_size : undefined
  const dimensions = typeof item.dimensions === 'string' ? item.dimensions.trim() : ''
  const uploadedBy = uploadedByName(item.createdBy)
  return {
    id: textOrEmpty(item._id) || textOrEmpty(item.id) || url,
    name: fileName,
    url,
    alt,
    title: title || undefined,
    caption: caption || undefined,
    description: description || undefined,
    fileName,
    fileType: fileType || undefined,
    fileSize,
    dimensions: dimensions || undefined,
    uploadedBy: uploadedBy || undefined,
    status: item.status !== false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    deletable: true,
  }
}

function readMediaAsset(payload: unknown): MediaAsset | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as MediaAsset & { data?: MediaAsset }
  if (record.file_url) return record
  if (record.data?.file_url) return record.data
  return null
}

function MediaPreview({ url, alt, className, version }: { url: string; alt: string; className?: string; version?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const base = getProfileImageUrl(url)
  const src = base && version ? `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}` : base
  if (!src || failedUrl === url) {
    return <span className={className ? `media-tile__missing ${className}` : 'media-tile__missing'}>No preview</span>
  }
  return <img className={className} src={src} alt={alt} decoding="async" loading="lazy" onError={() => setFailedUrl(url)} />
}

function formatUploadedOn(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatFileSize(size?: number) {
  if (size == null || !Number.isFinite(size)) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function inDateRange(createdAt: string | undefined, from: string, to: string) {
  if (!from && !to) return true
  if (!createdAt) return false
  const time = new Date(createdAt).getTime()
  if (Number.isNaN(time)) return false
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false
  if (to && time > new Date(`${to}T23:59:59`).getTime()) return false
  return true
}

export function MediaLibrary() {
  const { canCreate, canEdit, canDelete } = useModuleCan('media')
  const [items, setItems] = useState<MediaFile[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const today = todayIso()
  const dateError = mediaDateError(fromDate, toDate)
  const rangeReady = Boolean(fromDate && toDate) && !dateError
  const appliedFrom = rangeReady ? fromDate : ''
  const appliedTo = rangeReady ? toDate : ''
  const hasDateFilter = Boolean(fromDate || toDate)
  const toIsBound = Boolean(toDate) && !mediaDateError('', toDate)
  const fromIsBound = Boolean(fromDate) && !mediaDateError(fromDate, '')
  const fromMax = toIsBound ? toDate : today
  const toMin = fromIsBound ? fromDate : undefined
  const [view, setView] = useState<ViewMode>('grid')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)
  const copiedTimer = useRef<number | null>(null)
  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const loadId = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++loadId.current
    setLoading(true)
    setError('')
    try {
      const res = await mediaApi.getAll({
        page: page + 1,
        limit,
        search: debouncedSearch.trim(),
        status: 'all',
      })
      if (requestId !== loadId.current) return
      const gallery = readMediaPage(res.data)
      const library = gallery.list
        .map((item) => normalizeLibraryItem(item))
        .filter((item): item is MediaFile => Boolean(item))
      setItems(library)
      setTotal(gallery.pagination.total)
      setTotalPages(gallery.pagination.totalPages)
    } catch (err) {
      if (requestId !== loadId.current) return
      setItems([])
      setTotal(0)
      setTotalPages(1)
      setError(getApiErrorMessage(err, 'Could not load the media library.'))
    } finally {
      if (requestId === loadId.current) setLoading(false)
    }
  }, [page, limit, debouncedSearch, reloadKey])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => items.filter((item) => inDateRange(item.createdAt, appliedFrom, appliedTo)),
    [items, appliedFrom, appliedTo],
  )
  const pageCount = Math.max(1, totalPages)
  const safePage = Math.min(page, pageCount - 1)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const selectedFileUrl = selected ? getProfileImageUrl(selected.url) || selected.url : ''

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch])

  useEffect(() => {
    setUrlCopied(false)
    return () => {
      if (copiedTimer.current != null) window.clearTimeout(copiedTimer.current)
    }
  }, [selectedId])

  const copyUrl = async (item: MediaFile) => {
    const url = getProfileImageUrl(item.url) || item.url
    try {
      await navigator.clipboard.writeText(url)
      setUrlCopied(true)
      setSuccess('File URL copied.')
      setError('')
      if (copiedTimer.current != null) window.clearTimeout(copiedTimer.current)
      copiedTimer.current = window.setTimeout(() => setUrlCopied(false), 1600)
    } catch {
      setUrlCopied(false)
      setError('Could not copy the file URL.')
    }
  }

  const uploadDropped = async (nextFiles: File[]) => {
    if (!canCreate) return
    const images = nextFiles.filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      setError('Choose an image file.')
      return
    }
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      for (const image of images) {
        await mediaApi.add(image)
      }
      setSuccess(images.length === 1 ? 'Image added to the library.' : `${images.length} images added to the library.`)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed.'))
    } finally {
      setUploading(false)
    }
  }

  const removeItem = async (item: MediaFile) => {
    if (!canDelete || !item.deletable) return
    if (!(await adminConfirm(`Delete “${item.name}” from the media library? This cannot be undone.`))) return
    setError('')
    setSuccess('')
    try {
      await mediaApi.delete(item.id)
      if (selectedId === item.id) setSelectedId(null)
      setSuccess('Media deleted.')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete this file.'))
    }
  }

  const clearDates = () => {
    setFromDate('')
    setToDate('')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Media</h1>
          <p className="page-subtitle">Upload images and reuse them, the same way a WordPress media library works.</p>
        </div>
        {canCreate && (
        <button type="button" className="btn btn-primary" onClick={() => setUploadOpen(true)}>
          <Plus size={18} /> Add media
        </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className={`media-library${selected ? '' : ' is-closed'}`}>
        <div className="card media-library__main">
          <div className="media-toolbar">
            <div className="media-search">
              <Search size={16} />
              <input
                className="input"
                value={search}
                placeholder="Search media"
                aria-label="Search media"
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? (
                <button
                  type="button"
                  className="media-search__clear"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <label className="dashboard-date-field">
              From
              <input
                type="date"
                className={`input${dateError?.from ? ' is-invalid' : ''}`}
                value={fromDate}
                max={fromMax}
                aria-invalid={dateError?.from || undefined}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label className="dashboard-date-field">
              To
              <input
                type="date"
                className={`input${dateError?.to ? ' is-invalid' : ''}`}
                value={toDate}
                min={toMin}
                max={today}
                aria-invalid={dateError?.to || undefined}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
            {hasDateFilter ? (
              <button type="button" className="btn btn-ghost dashboard-clear-btn" onClick={clearDates}>
                Clear filters
              </button>
            ) : null}
            <label className="dashboard-date-field media-limit">
              Limit
              <select
                className="select"
                value={limit}
                aria-label="Items per page"
                onChange={(event) => {
                  setLimit(Number(event.target.value))
                  setPage(0)
                }}
              >
                {LIMIT_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="media-view" role="group" aria-label="Library view">
              <button
                type="button"
                className={`btn btn-icon${view === 'grid' ? ' is-active' : ''}`}
                aria-pressed={view === 'grid'}
                aria-label="Grid view"
                onClick={() => setView('grid')}
              >
                <Grid2x2 size={16} />
              </button>
              <button
                type="button"
                className={`btn btn-icon${view === 'list' ? ' is-active' : ''}`}
                aria-pressed={view === 'list'}
                aria-label="List view"
                onClick={() => setView('list')}
              >
                <LayoutList size={16} />
              </button>
            </div>
          </div>
          {dateError ? (
            <p className="dashboard-date-alert" role="alert">
              <AlertCircle size={15} aria-hidden />
              <span>{dateError.message}</span>
            </p>
          ) : null}

          <div
            className={`media-drop${dragOver ? ' is-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              if (!canCreate || uploading) return
              void uploadDropped(Array.from(event.dataTransfer.files))
            }}
          >
            {loading ? (
              <p className="media-empty">Loading media…</p>
            ) : visible.length === 0 ? (
              <div className="media-empty">
                <Upload size={28} />
                <p>No media yet. Drop images here or use Add media.</p>
              </div>
            ) : view === 'grid' ? (
              <div className="media-grid">
                {visible.map((item) => {
                  const selected = selectedId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`media-tile${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setSelectedId(selected ? null : item.id)}
                    >
                      <MediaPreview url={item.url} alt={item.alt} version={item.updatedAt} />
                      {selected && (
                        <span className="media-tile__check" aria-hidden>
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                      <span className="media-tile__name">{item.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <ul className="media-list">
                {visible.map((item) => {
                  const selected = selectedId === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`media-row${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => setSelectedId(selected ? null : item.id)}
                      >
                        <MediaPreview url={item.url} alt="" version={item.updatedAt} />
                        <span className="media-row__name">{item.name}</span>
                        <span className="media-row__meta">{formatUploadedOn(item.createdAt)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="media-footer">
            <span>{total.toLocaleString()} {total === 1 ? 'item' : 'items'}</span>
            <div className="media-pager">
              <button type="button" className="btn" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                Previous
              </button>
              <span>{safePage + 1} / {pageCount}</span>
              <button type="button" className="btn" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          </div>
        </div>

        {selected && (
          <aside className="card media-detail">
            <div className="media-detail__head">
              <h2>Attachment details</h2>
              <button type="button" className="btn btn-icon" aria-label="Close details" onClick={() => setSelectedId(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="media-detail__stage">
              <MediaPreview className="media-detail__preview" url={selected.url} alt={selected.alt || selected.name} version={selected.updatedAt} />
              <div className="media-detail__actions">
                <button
                  type="button"
                  className={`btn btn-icon${urlCopied ? ' is-copied' : ''}`}
                  aria-label={urlCopied ? 'Copied' : 'Copy URL'}
                  title={urlCopied ? 'Copied' : 'Copy URL'}
                  onClick={() => void copyUrl(selected)}
                >
                  {urlCopied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} />}
                </button>
                {canEdit && (
                <button type="button" className="btn btn-icon" aria-label="Edit" title="Edit" onClick={() => setEditOpen(true)}>
                  <Pencil size={16} />
                </button>
                )}
                {/* Replace image is hidden for now.
                <button type="button" className="btn btn-icon" aria-label="Replace image" title="Replace image" onClick={() => setReplaceOpen(true)}>
                  <ImageUp size={16} />
                </button>
                */}
                {canDelete && selected.deletable && (
                  <button type="button" className="btn btn-icon btn-danger" aria-label="Delete" title="Delete" onClick={() => void removeItem(selected)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="media-detail__body">
            <dl className="media-detail__meta">
              <div>
                <dt>Uploaded on</dt>
                <dd>{formatUploadedOn(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Uploaded by</dt>
                <dd>{selected.uploadedBy || '—'}</dd>
              </div>
              <div>
                <dt>File name</dt>
                <dd>{selected.fileName}</dd>
              </div>
              <div>
                <dt>File type</dt>
                <dd>{selected.fileType || '—'}</dd>
              </div>
              <div>
                <dt>File size</dt>
                <dd>{formatFileSize(selected.fileSize)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>{selected.dimensions || '—'}</dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>{selected.title || '—'}</dd>
              </div>
              <div>
                <dt>Alternative text</dt>
                <dd>{selected.alt || '—'}</dd>
              </div>
              <div>
                <dt>Caption</dt>
                <dd>{selected.caption || '—'}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{selected.description || '—'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt>File URL</dt>
                <dd className="media-detail__url">
                  <a href={selectedFileUrl} target="_blank" rel="noopener noreferrer">
                    {selectedFileUrl}
                  </a>
                </dd>
              </div>
            </dl>
            </div>
          </aside>
        )}
      </div>

      {uploadOpen && (
        <AddMedia
          onClose={() => setUploadOpen(false)}
          onUploaded={(message) => {
            setSuccess(message)
            setError('')
            setReloadKey((key) => key + 1)
          }}
          onError={setError}
        />
      )}
      {editOpen && selected && (
        <EditMedia
          item={selected}
          onClose={() => setEditOpen(false)}
          onSaved={(message) => {
            setSuccess(message)
            setError('')
            setReloadKey((key) => key + 1)
          }}
          onError={setError}
        />
      )}
      {replaceOpen && selected && (
        <ReplaceMedia
          item={selected}
          onClose={() => setReplaceOpen(false)}
          onReplaced={(message, payload) => {
            const next = readMediaAsset(payload)
            const file = next ? normalizeLibraryItem(next) : null
            setSuccess(message)
            setError('')
            if (!file || !selected) {
              setReloadKey((key) => key + 1)
              return
            }
            const id = file.id || selected.id
            setItems((current) => current.map((item) => (
              item.id === selected.id ? { ...item, ...file, id, updatedAt: file.updatedAt || new Date().toISOString() } : item
            )))
            setSelectedId(id)
          }}
          onError={setError}
        />
      )}
    </>
  )
}

import { useEffect, useState } from 'react'
import { Check, Search, Upload, X } from 'lucide-react'
import { mediaApi } from '../../api/endpoints'
import { getProfileImageUrl } from '../../api/client'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { MediaAsset } from '../../types/api'
import { Modal } from '../ui/Modal'

type ImageSourcePickerProps = {
  title: string
  multiple?: boolean
  onClose: () => void
  onSelect: (picked: { files: File[]; urls: string[] }) => void
}

type LibraryItem = { id: string; url: string; name: string }

function fileNameFromUrl(url: string) {
  const name = url.split('?')[0]?.split('/').filter(Boolean).pop() || 'Image'
  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

function toLibraryItem(item: MediaAsset): LibraryItem | null {
  const url = item.file_url?.trim()
  if (!url) return null
  if (item.file_type && !item.file_type.startsWith('image/')) return null
  return {
    id: item._id || item.id || url,
    url,
    name: item.file_name?.trim() || fileNameFromUrl(url),
  }
}

function FileThumb({ file }: { file: File }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return src ? <img src={src} alt="" /> : <span className="image-source__preview-missing" />
}

export function ImageSourcePicker({ title, multiple = false, onClose, onSelect }: ImageSourcePickerProps) {
  const [tab, setTab] = useState<'upload' | 'library'>('library')
  const [files, setFiles] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [items, setItems] = useState<LibraryItem[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const query = useDebouncedValue(search, 300)

  useEffect(() => {
    let ignore = false
    mediaApi
      .getAll({ page, limit: 12, search: query, status: 'all' })
      .then((res) => {
        if (ignore) return
        const data = res.data?.data
        setItems((data?.list ?? []).map(toLibraryItem).filter((item): item is LibraryItem => Boolean(item)))
        setPages(data?.pagination?.totalPages || 1)
        setError('')
      })
      .catch(() => {
        if (!ignore) setError('Could not load the media library.')
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [page, query])

  const addFiles = (list: File[]) => {
    const images = list.filter((file) => file.type.startsWith('image/'))
    if (!images.length) return
    setUrls([])
    setFiles((current) => (multiple ? [...current, ...images] : images.slice(0, 1)))
  }

  const toggleUrl = (url: string) => {
    setFiles([])
    setUrls((current) => {
      if (!multiple) return current[0] === url ? [] : [url]
      return current.includes(url) ? current.filter((item) => item !== url) : [...current, url]
    })
  }

  const picked = tab === 'upload' ? files : urls

  return (
    <Modal title={title} onClose={onClose} className="modal-media">
      <div className="image-source">
        <div className="image-source__tabs">
          <button type="button" className={`image-source__tab${tab === 'upload' ? ' is-active' : ''}`} onClick={() => setTab('upload')}>
            Upload files
          </button>
          <button type="button" className={`image-source__tab${tab === 'library' ? ' is-active' : ''}`} onClick={() => setTab('library')}>
            Media Library
          </button>
        </div>

        <div className="image-source__stage">
          <div className="image-source__panel" hidden={tab !== 'upload'}>
              {files.length === 0 ? (
                <label
                  className={`media-upload${dragOver ? ' is-over' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragOver(false)
                    addFiles(Array.from(event.dataTransfer.files))
                  }}
                >
                  <span className="media-upload__icon">
                    <Upload size={20} />
                  </span>
                  <span className="media-upload__title">{multiple ? 'Drop images here' : 'Drop an image here'}</span>
                  <span className="media-upload__hint">or click to browse · PNG, JPG, WEBP, GIF</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple={multiple}
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files ?? []))
                      event.target.value = ''
                    }}
                  />
                </label>
              ) : (
                <div
                  className={`image-source__chosen${dragOver ? ' is-over' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragOver(false)
                    addFiles(Array.from(event.dataTransfer.files))
                  }}
                >
                  <div className="image-source__previews">
                    {files.map((file) => (
                      <figure key={`${file.name}-${file.size}-${file.lastModified}`}>
                        <FileThumb file={file} />
                        <figcaption>{file.name}</figcaption>
                        <button
                          type="button"
                          className="image-source__remove"
                          aria-label={`Remove ${file.name}`}
                          onClick={() => setFiles((current) => current.filter((entry) => entry !== file))}
                        >
                          <X size={14} />
                        </button>
                      </figure>
                    ))}
                  </div>
                  <label className="image-source__replace">
                    <Upload size={16} />
                    <span>{multiple ? 'Add more images' : 'Choose a different image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple={multiple}
                      onChange={(event) => {
                        addFiles(Array.from(event.target.files ?? []))
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
          </div>
          <div className="image-source__panel" hidden={tab !== 'library'}>
              <div className="media-search image-source__search">
                <Search size={16} />
                <input
                  className="input"
                  value={search}
                  placeholder="Search media"
                  aria-label="Search media"
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                />
              </div>
              {error ? <p className="image-source__note">{error}</p> : null}
              {loading ? <p className="media-empty">Loading media…</p> : null}
              {!loading && items.length === 0 ? <p className="media-empty">No images found.</p> : null}
              <div className="media-grid">
                {items.map((item) => {
                  const selected = urls.includes(item.url)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`media-tile${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => toggleUrl(item.url)}
                    >
                      <img src={getProfileImageUrl(item.url)} alt="" />
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
              <div className="image-source__pager">
                <button type="button" className="btn" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </button>
                <span>{page} / {pages}</span>
                <button type="button" className="btn" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)}>
                  Next
                </button>
              </div>
          </div>
        </div>

        <div className="modal-footer image-source__footer">
          <span className="media-upload__count">{picked.length ? `${picked.length} selected` : 'Nothing selected'}</span>
          <div className="image-source__actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={picked.length === 0}
              onClick={() => onSelect(tab === 'upload' ? { files, urls: [] } : { files: [], urls })}
            >
              {multiple ? 'Add to gallery' : 'Use this image'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { getProfileImageUrl } from '../../api/client'
import { FormField } from '../ui/FormField'
import { ImageSourcePicker } from './ImageSourcePicker'

export function imageFieldValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return trimmed.replace(/^\/+/, '')
}

function fileName(value: string) {
  const clean = value.split('?')[0]
  return decodeURIComponent(clean.split('/').pop() || 'Image')
}

function useFileUrls(files: File[]) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls])
  return urls
}

function Tile({ src, name, onRemove, removeLabel }: { src: string; name?: string; onRemove?: () => void; removeLabel: string }) {
  return (
    <div className="product-image-tile">
      <div className="product-image-tile__frame">
        <img src={src} alt="" />
        {onRemove ? (
          <button type="button" className="product-image-tile__remove" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
            <X size={14} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>
      {name ? (
        <span className="product-image-tile__name" title={name}>
          {name}
        </span>
      ) : null}
    </div>
  )
}

type Props = {
  label: string
  hint?: string
  required?: boolean
  error?: string
  multiple?: boolean
  file?: File | null
  files?: File[]
  url?: string
  urls?: string[]
  existing?: string
  existingList?: string[]
  fallbackSrc?: string
  onFileChange?: (file: File | null) => void
  onFilesChange?: (files: File[]) => void
  onUrlChange?: (url: string) => void
  onUrlsChange?: (urls: string[]) => void
  onExistingChange?: (value: string) => void
  onExistingListChange?: (values: string[]) => void
}

export function ImageSourceField({
  label,
  hint,
  required,
  error,
  multiple = false,
  file = null,
  files = [],
  url = '',
  urls = [],
  existing = '',
  existingList = [],
  fallbackSrc,
  onFileChange,
  onFilesChange,
  onUrlChange,
  onUrlsChange,
  onExistingChange,
  onExistingListChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const filePreviews = useFileUrls(multiple ? files : file ? [file] : [])
  const ownSrc = filePreviews[0] || (url.trim() ? getProfileImageUrl(url) : '') || (existing.trim() ? getProfileImageUrl(existing) : '')
  const chosen = multiple ? existingList.length + files.length + urls.length > 0 : Boolean(ownSrc)

  return (
    <FormField label={label} hint={hint} required={required} error={error}>
      <div className="product-image-field">
        <button type="button" className="btn image-source-trigger" onClick={() => setOpen(true)}>
          {multiple ? 'Add images' : chosen ? 'Replace image' : 'Select image'}
        </button>
        {multiple ? (
          chosen && (
            <div className="product-image-grid">
              {existingList.map((item, index) => (
                <Tile
                  key={`existing-${item}-${index}`}
                  src={getProfileImageUrl(item) || ''}
                  name={fileName(item)}
                  removeLabel="Remove image"
                  onRemove={() => onExistingListChange?.(existingList.filter((_, i) => i !== index))}
                />
              ))}
              {files.map((item, index) => (
                <Tile
                  key={`file-${item.name}-${item.size}-${index}`}
                  src={filePreviews[index]}
                  name={item.name}
                  removeLabel="Remove image"
                  onRemove={() => onFilesChange?.(files.filter((_, i) => i !== index))}
                />
              ))}
              {urls.map((item, index) => (
                <Tile
                  key={`url-${item}-${index}`}
                  src={getProfileImageUrl(item) || ''}
                  name={fileName(item)}
                  removeLabel="Remove image"
                  onRemove={() => onUrlsChange?.(urls.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          )
        ) : (
          (ownSrc || fallbackSrc) && (
            <div className="product-image-grid">
              <Tile
                src={ownSrc || fallbackSrc || ''}
                name={file?.name || fileName(url || existing || 'Image')}
                removeLabel="Remove image"
                onRemove={
                  file || url.trim() || (existing.trim() && onExistingChange)
                    ? () => {
                        if (file) onFileChange?.(null)
                        else if (url.trim()) onUrlChange?.('')
                        else onExistingChange?.('')
                      }
                    : undefined
                }
              />
            </div>
          )
        )}
      </div>
      {open && (
        <ImageSourcePicker
          title={label}
          multiple={multiple}
          onClose={() => setOpen(false)}
          onSelect={({ files: pickedFiles, urls: pickedUrls }) => {
            if (multiple) {
              if (pickedFiles.length) onFilesChange?.([...files, ...pickedFiles])
              if (pickedUrls.length) onUrlsChange?.([...new Set([...urls, ...pickedUrls])])
            } else if (pickedFiles[0]) {
              onFileChange?.(pickedFiles[0])
              onUrlChange?.('')
            } else if (pickedUrls[0]) {
              onFileChange?.(null)
              onUrlChange?.(pickedUrls[0])
            }
            setOpen(false)
          }}
        />
      )}
    </FormField>
  )
}

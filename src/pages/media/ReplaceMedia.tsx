import { useEffect, useState } from 'react'
import { ImageUp, X } from 'lucide-react'
import { mediaApi } from '../../api/endpoints'
import { getApiErrorMessage } from '../../utils/apiError'
import { Modal } from '../../components/ui/Modal'

type ReplaceMediaItem = {
  id: string
  title?: string
  alt: string
  caption?: string
  description?: string
  status: boolean
}

type ReplaceMediaProps = {
  item: ReplaceMediaItem
  onClose: () => void
  onReplaced: (message: string, payload: unknown) => void
  onError: (message: string) => void
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function UploadThumb({ file }: { file: File }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (!src) return <span className="media-upload__thumb" />
  return <img className="media-upload__thumb" src={src} alt="" />
}

export function ReplaceMedia({ item, onClose, onReplaced, onError }: ReplaceMediaProps) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)

  const close = () => {
    if (saving) return
    onClose()
  }

  const chooseFile = (incoming: File[]) => {
    const image = incoming.find((entry) => entry.type.startsWith('image/'))
    if (!image) {
      setNote('Choose an image file.')
      return
    }
    setNote(incoming.length > 1 ? 'Only the first image will replace the current file.' : '')
    setFile(image)
  }

  const replace = async () => {
    if (!file) {
      setNote('Choose an image file.')
      return
    }
    setSaving(true)
    onError('')
    try {
      const updated = await mediaApi.update(item.id, {
        file,
        alternative_text: item.alt,
        title: item.title ?? '',
        caption: item.caption ?? '',
        description: item.description ?? '',
        status: item.status,
      })
      onReplaced('Image replaced.', updated.data)
      onClose()
    } catch (err) {
      onError(getApiErrorMessage(err, 'Could not replace this image.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Replace image" onClose={close}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void replace()
        }}
      >
        <p className="media-upload__note">
          The new image replaces the current file. Title, alternative text, caption, description, and status stay as they are.
        </p>
        {file && (
          <div className="media-upload__item">
            <UploadThumb file={file} />
            <div className="media-upload__meta">
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)}</span>
            </div>
            <button
              type="button"
              className="btn btn-icon"
              aria-label={`Remove ${file.name}`}
              disabled={saving}
              onClick={() => setFile(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <label
          className={`media-upload${file ? ' is-compact' : ''}${dragOver ? ' is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            chooseFile(Array.from(event.dataTransfer.files))
          }}
        >
          {file ? (
            <>
              <ImageUp size={16} />
              <span>Choose a different image</span>
            </>
          ) : (
            <>
              <span className="media-upload__icon">
                <ImageUp size={20} />
              </span>
              <span className="media-upload__title">Drop a replacement image</span>
              <span className="media-upload__hint">or click to browse · PNG, JPG, WEBP, GIF</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              chooseFile(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </label>
        {note ? <p className="media-upload__note">{note}</p> : null}
        <div className="modal-footer media-upload__footer">
          <span className="media-upload__count">{file ? '1 image selected' : 'No image selected'}</span>
          <div className="media-upload__actions">
            <button type="button" className="btn" disabled={saving} onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !file}>
              {saving ? 'Replacing…' : 'Replace image'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

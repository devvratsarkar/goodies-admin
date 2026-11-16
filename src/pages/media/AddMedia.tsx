import { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { mediaApi } from '../../api/endpoints'
import { getApiErrorMessage } from '../../utils/apiError'
import { Modal } from '../../components/ui/Modal'

type AddMediaProps = {
  onClose: () => void
  onUploaded: (message: string) => void
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

export function AddMedia({ onClose, onUploaded, onError }: AddMediaProps) {
  const [files, setFiles] = useState<File[]>([])
  const [queueNote, setQueueNote] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const close = () => {
    if (uploading) return
    onClose()
  }

  const queueImages = (incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      setQueueNote('Only image files can be added.')
      return
    }
    setQueueNote(images.length < incoming.length ? 'Files that are not images were skipped.' : '')
    setFiles((current) => {
      const next = [...current]
      for (const image of images) {
        const duplicate = next.some(
          (file) => file.name === image.name && file.size === image.size && file.lastModified === image.lastModified,
        )
        if (!duplicate) next.push(image)
      }
      return next
    })
  }

  const removeQueued = (target: File) => {
    setFiles((current) => current.filter((file) => file !== target))
  }

  const upload = async () => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      setQueueNote('Choose an image file.')
      return
    }
    setUploading(true)
    onError('')
    try {
      for (const image of images) {
        await mediaApi.add(image)
      }
      onUploaded(images.length === 1 ? 'Image added to the library.' : `${images.length} images added to the library.`)
      onClose()
    } catch (err) {
      onError(getApiErrorMessage(err, 'Upload failed.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="Add media" onClose={close}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void upload()
        }}
      >
        {files.length > 0 && (
          <ul className="media-upload__queue">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`} className="media-upload__item">
                <UploadThumb file={file} />
                <div className="media-upload__meta">
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-icon"
                  aria-label={`Remove ${file.name}`}
                  disabled={uploading}
                  onClick={() => removeQueued(file)}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label
          className={`media-upload${files.length > 0 ? ' is-compact' : ''}${dragOver ? ' is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            queueImages(Array.from(event.dataTransfer.files))
          }}
        >
          {files.length === 0 ? (
            <>
              <span className="media-upload__icon">
                <Upload size={20} />
              </span>
              <span className="media-upload__title">Drop images here</span>
              <span className="media-upload__hint">or click to browse · PNG, JPG, WEBP, GIF</span>
            </>
          ) : (
            <>
              <Upload size={16} />
              <span>Add more images</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              queueImages(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </label>
        {queueNote ? <p className="media-upload__note">{queueNote}</p> : null}
        <div className="modal-footer media-upload__footer">
          <span className="media-upload__count">
            {files.length === 0 ? 'No images selected' : `${files.length} selected`}
          </span>
          <div className="media-upload__actions">
            <button type="button" className="btn" disabled={uploading} onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading || files.length === 0}>
              {uploading ? 'Uploading…' : files.length > 1 ? `Upload ${files.length} images` : 'Upload'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

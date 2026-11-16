import { useState } from 'react'
import { mediaApi } from '../../api/endpoints'
import { getApiErrorMessage } from '../../utils/apiError'
import { FormField } from '../../components/ui/FormField'
import { Modal } from '../../components/ui/Modal'

type EditMediaItem = {
  id: string
  title?: string
  alt: string
  caption?: string
  description?: string
  status: boolean
}

type EditMediaProps = {
  item: EditMediaItem
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}

export function EditMedia({ item, onClose, onSaved, onError }: EditMediaProps) {
  const [title, setTitle] = useState(item.title ?? '')
  const [alternativeText, setAlternativeText] = useState(item.alt)
  const [caption, setCaption] = useState(item.caption ?? '')
  const [description, setDescription] = useState(item.description ?? '')
  const [status, setStatus] = useState(item.status)
  const [saving, setSaving] = useState(false)

  const close = () => {
    if (saving) return
    onClose()
  }

  const save = async () => {
    setSaving(true)
    onError('')
    try {
      await mediaApi.update(item.id, {
        title,
        alternative_text: alternativeText,
        caption,
        description,
        status,
      })
      onSaved('Media details updated.')
      onClose()
    } catch (err) {
      onError(getApiErrorMessage(err, 'Could not update this media.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit media" onClose={close}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <FormField label="Title" htmlFor="media-edit-title">
          <input id="media-edit-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </FormField>
        <FormField label="Alternative text" htmlFor="media-edit-alt">
          <input id="media-edit-alt" className="input" value={alternativeText} onChange={(event) => setAlternativeText(event.target.value)} />
        </FormField>
        <FormField label="Caption" htmlFor="media-edit-caption">
          <input id="media-edit-caption" className="input" value={caption} onChange={(event) => setCaption(event.target.value)} />
        </FormField>
        <FormField label="Description" htmlFor="media-edit-description">
          <textarea id="media-edit-description" className="input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </FormField>
        <label className="form-check">
          <input type="checkbox" checked={status} onChange={(event) => setStatus(event.target.checked)} />
          Active
        </label>
        <div className="modal-footer">
          <button type="button" className="btn" disabled={saving} onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

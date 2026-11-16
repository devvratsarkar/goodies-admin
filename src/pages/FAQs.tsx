import { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import { faqsApi } from '../api/endpoints'
import { revalidateStore } from '../api/revalidateStore'
import { confirmDeleteItem } from '../utils/adminConfirm'
import { getApiErrorMessage } from '../utils/apiError'
import { faqValidationSchema } from '../validation/validation'
import type { FAQ } from '../types/api'
import { ArticleMdxEditor } from '../components/ArticleMdxEditor'
import { DataTable } from '../components/ui/DataTable'
import { Modal } from '../components/ui/Modal'
import { FormField } from '../components/ui/FormField'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react'
import { useModuleCan } from '../components/rbac/useModuleCan'

const QUESTION_LIMIT = 100
const ANSWER_LIMIT = 300
const emptyFaq = { question: '', answer: '' }

function answerPreview(value: string) {
  const text = value.replace(/[#>*_`[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 60 ? `${text.slice(0, 60)}...` : text
}

export function FAQs() {
  const { canCreate, canEdit, canDelete } = useModuleCan('faqs')
  const [data, setData] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError('')
    faqsApi
      .getAll()
      .then((res) => {
        const d = (res.data as { data?: FAQ[] })?.data
        const list = Array.isArray(d) ? d : (d && typeof d === 'object' && 'list' in d ? (d as { list?: FAQ[] }).list ?? [] : [])
        setData(Array.isArray(list) ? list : [])
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), [])

  const formik = useFormik({
    initialValues: emptyFaq,
    validationSchema: faqValidationSchema,
    onSubmit: async (values) => {
      setError('')
      const payload = { question: values.question.trim(), answer: values.answer.trim() }
      try {
        if (editingId) {
          await faqsApi.update(editingId, payload)
          setSuccess('FAQ updated')
        } else {
          await faqsApi.create(payload)
          setSuccess('FAQ created')
        }
        await revalidateStore(['faqs'])
        closeModal()
        load()
      } catch (err) {
        setError(getApiErrorMessage(err, editingId ? 'Update failed' : 'Create failed'))
      }
    },
  })

  const closeModal = () => {
    setModal(null)
    setEditingId(null)
    formik.resetForm({ values: emptyFaq })
  }

  const openCreate = () => {
    setEditingId(null)
    formik.resetForm({ values: emptyFaq })
    setModal('create')
  }

  const openEdit = (row: FAQ) => {
    setEditingId(row._id)
    formik.resetForm({ values: { question: row.question, answer: row.answer } })
    setModal('edit')
  }

  const fieldError = (name: 'question' | 'answer') =>
    formik.submitCount > 0 ? formik.errors[name] || '' : ''

  const handleDelete = async (id: string, question?: string) => {
    if (!canDelete) return
    if (!(await confirmDeleteItem(question))) return
    try {
      await faqsApi.delete(id)
      await revalidateStore(['faqs'])
      setSuccess('Deleted')
      load()
    } catch {
      setError('Delete failed')
    }
  }

  const columns: ColumnDef<FAQ, unknown>[] = [
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="table-actions">
          {canEdit && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(row.original)} title="Edit">
            <Pencil size={16} />
          </button>
          )}
          {canDelete && (
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(row.original._id, row.original.question)} title="Delete">
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    {
      header: 'Question',
      accessorKey: 'question',
      cell: ({ getValue }) => {
        const text = String(getValue() ?? '')
        return <span style={{ maxWidth: 280 }}>{text.length > 60 ? `${text.slice(0, 60)}...` : text}</span>
      },
    },
    {
      header: 'Answer',
      accessorKey: 'answer',
      cell: ({ getValue }) => <span style={{ maxWidth: 280 }}>{answerPreview(String(getValue() ?? ''))}</span>,
    },
  ]

  if (loading) return <div className="page-loading">Loading...</div>

  const questionError = fieldError('question')
  const answerError = fieldError('answer')

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">FAQs</h1>
          <p className="page-subtitle">Manage frequently asked questions.</p>
        </div>
        {canCreate && (
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Add FAQ
        </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <DataTable data={data} columns={columns} searchPlaceholder="Search FAQs..." />

      {modal && (
        <Modal title={modal === 'create' ? 'Create FAQ' : 'Edit FAQ'} onClose={closeModal} wide>
          <form noValidate onSubmit={formik.handleSubmit}>
            <FormField
              label="Question"
              htmlFor="faq-question"
              required
              hint={`${formik.values.question.length} / ${QUESTION_LIMIT}`}
              error={questionError}
            >
              <input
                id="faq-question"
                name="question"
                type="text"
                maxLength={QUESTION_LIMIT}
                className={`input${questionError ? ' is-invalid' : ''}`}
                value={formik.values.question}
                onChange={(e) => formik.setFieldValue('question', e.target.value.slice(0, QUESTION_LIMIT))}
                placeholder="What is this service?"
              />
            </FormField>

            <FormField
              label="Answer"
              required
              hint={`${formik.values.answer.length} / ${ANSWER_LIMIT}`}
              error={answerError}
            >
              <div className={`faq-answer-editor${answerError ? ' is-invalid' : ''}`}>
                <ArticleMdxEditor
                  key={editingId || 'create'}
                  markdown={formik.values.answer}
                  maxLength={ANSWER_LIMIT}
                  onChange={(answer) => formik.setFieldValue('answer', answer.slice(0, ANSWER_LIMIT))}
                  placeholder="This is the answer."
                />
              </div>
            </FormField>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={formik.isSubmitting}>
                <HelpCircle size={18} /> {formik.isSubmitting ? 'Saving...' : modal === 'create' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { Country } from 'country-state-city'
import { getIn, useFormik } from 'formik'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Select from 'react-select'
import type { StylesConfig } from 'react-select'
import { codMethodsApi, type CodMethodPayload } from '../../api/endpoints'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { adminConfirm } from '../../utils/adminConfirm'
import type { CodMethod } from '../../types/api'
import { MuiDataTable } from '../../components/ui/MuiDataTable'
import { FormField } from '../../components/ui/FormField'
import { Modal } from '../../components/ui/Modal'
import { countrySelectStyles } from '../../utils/countrySelectStyles'
import { useModuleCan } from '../../components/rbac/useModuleCan'
import { addCodMethodValidationSchema } from '../../validation/validation'

type Method = 'flat' | 'weight'
type CountryOption = { value: string; label: string }

const emptyForm = {
  countryCode: '',
  method: 'flat' as Method,
  flatCost: '',
  baseCost: '',
  perKg: '',
  stepKg: '1',
  skipKg: '0',
  isFree: false,
  status: true,
}

type CodForm = typeof emptyForm

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string } } }
  return err?.response?.data?.message || fallback
}

function readPage(payload: unknown) {
  const data = (payload as { data?: unknown } | null)?.data
  if (Array.isArray(data)) return { list: data as CodMethod[], total: data.length }
  const page = data as { list?: CodMethod[]; pagination?: { total?: number } } | undefined
  const list = Array.isArray(page?.list) ? page.list : []
  return { list, total: Number(page?.pagination?.total ?? list.length) }
}

function priceLabel(row: CodMethod) {
  if (row.is_free) return 'Free'
  if (row.method === 'weight') {
    const skip = Number(row.skip_kg || 0)
    const base = Number(row.base_cost || 0).toFixed(2)
    const perKg = Number(row.per_kg || 0).toFixed(2)
    return `AED ${base} + ${perKg}/kg${skip ? `, first ${skip} kg included` : ''}`
  }
  return `AED ${Number(row.flat_cost || 0).toFixed(2)}`
}

function formFromRow(row: CodMethod): CodForm {
  return {
    countryCode: row.country_code || '',
    method: row.method === 'weight' ? 'weight' : 'flat',
    flatCost: row.flat_cost == null ? '' : String(row.flat_cost),
    baseCost: row.base_cost == null ? '' : String(row.base_cost),
    perKg: row.per_kg == null ? '' : String(row.per_kg),
    stepKg: row.step_kg == null ? '1' : String(row.step_kg),
    skipKg: row.skip_kg == null ? '0' : String(row.skip_kg),
    isFree: Boolean(row.is_free),
    status: row.status !== false,
  }
}

function payloadFromForm(values: CodForm, country: CountryOption): CodMethodPayload {
  const payload: CodMethodPayload = {
    country: country.label,
    country_code: country.value,
    method: values.method,
    is_free: values.isFree,
    status: values.status,
  }
  if (values.isFree) return payload
  if (values.method === 'flat') {
    payload.flat_cost = Number(values.flatCost)
    return payload
  }
  payload.base_cost = Number(values.baseCost)
  payload.per_kg = Number(values.perKg)
  payload.step_kg = Number(values.stepKg || 1)
  payload.skip_kg = Number(values.skipKg || 0)
  return payload
}

export function CodMethods() {
  const { canCreate, canEdit, canDelete } = useModuleCan('payment-settings')
  const [rows, setRows] = useState<CodMethod[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 })
  const debouncedSearch = useDebouncedValue(search, search.trim() ? 350 : 0)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')
  const editingIdRef = useRef<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const countryOptions = useMemo<CountryOption[]>(
    () =>
      Country.getAllCountries()
        .map((country) => ({ value: country.isoCode, label: country.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  )

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    codMethodsApi
      .getAll({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: debouncedSearch.trim() || undefined,
      })
      .then((res) => {
        if (ignore) return
        const page = readPage(res.data)
        setRows(page.list)
        setTotal(page.total)
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err, 'Failed to load COD methods'))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadKey])

  const formik = useFormik<CodForm>({
    initialValues: emptyForm,
    validationSchema: addCodMethodValidationSchema,
    onSubmit: async (values, { resetForm }) => {
      const country = countryOptions.find((option) => option.value === values.countryCode)
      if (!country) return
      setSubmitting(true)
      setModalError('')
      const payload = payloadFromForm(values, country)
      const id = editingIdRef.current
      try {
        if (id) await codMethodsApi.update(id, payload)
        else await codMethodsApi.create(payload)
        setSuccess(id ? 'COD method updated' : 'COD method added')
        setOpen(false)
        editingIdRef.current = null
        setEditingId(null)
        resetForm()
        setReloadKey((key) => key + 1)
      } catch (err) {
        setModalError(getErrorMessage(err, id ? 'Failed to update COD method' : 'Failed to add COD method'))
      } finally {
        setSubmitting(false)
      }
    },
  })

  const form = formik.values
  const selectedCountry = countryOptions.find((option) => option.value === form.countryCode) ?? null
  const fieldError = (path: string) => {
    if (formik.submitCount < 1) return ''
    const message = getIn(formik.errors, path)
    return typeof message === 'string' ? message : ''
  }

  const close = () => {
    setOpen(false)
    setModalError('')
    editingIdRef.current = null
    setEditingId(null)
    formik.resetForm()
  }

  const openCreate = () => {
    editingIdRef.current = null
    setEditingId(null)
    setModalError('')
    formik.resetForm({ values: emptyForm })
    setOpen(true)
  }

  const openEdit = (row: CodMethod) => {
    editingIdRef.current = row._id
    setEditingId(row._id)
    setModalError('')
    formik.resetForm({ values: formFromRow(row) })
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!canDelete) return
    if (!(await adminConfirm('Are you sure you want to delete this COD method?'))) return
    setError('')
    setSuccess('')
    try {
      await codMethodsApi.delete(id)
      setSuccess('COD method deleted')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete COD method'))
    }
  }

  const columns: GridColDef<CodMethod>[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      minWidth: 110,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      headerAlign: 'center',
      cellClassName: 'products-actions-cell',
      renderCell: ({ row }) => (
        <div className="table-actions" onClick={(event) => event.stopPropagation()}>
          {canEdit && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--edit"
            title="Edit COD method"
            aria-label="Edit COD method"
            onClick={() => openEdit(row)}
          >
            <Pencil size={16} />
          </button>
          )}
          {canDelete && (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon action-icon action-icon--delete"
            title="Delete COD method"
            aria-label="Delete COD method"
            onClick={() => handleDelete(row._id)}
          >
            <Trash2 size={16} />
          </button>
          )}
        </div>
      ),
    },
    { field: 'country', headerName: 'Country', flex: 1.4, minWidth: 180 },
    {
      field: 'method',
      headerName: 'Method',
      width: 120,
      valueGetter: (_value, row) => (row.method === 'weight' ? 'Weight' : 'Flat'),
    },
    {
      field: 'price',
      headerName: 'Price',
      flex: 1,
      minWidth: 180,
      sortable: false,
      valueGetter: (_value, row) => priceLabel(row),
    },
    {
      field: 'is_free',
      headerName: 'Free',
      width: 90,
      valueGetter: (_value, row) => (row.is_free ? 'Yes' : 'No'),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      minWidth: 140,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      cellClassName: 'cod-status-cell',
      renderCell: ({ row }) => (
        <span className={row.status === false ? 'badge badge-danger' : 'badge badge-success'}>
          {row.status === false ? 'Inactive' : 'Active'}
        </span>
      ),
    },
  ]

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="card">
        <div className="product-filter-bar">
          <div className="filter-toolbar-row">
            <div style={{ position: 'relative', maxWidth: 280, flex: '1 1 220px' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                className="input"
                placeholder="Search COD methods..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPaginationModel((current) => ({ ...current, page: 0 }))
                }}
                style={{ paddingLeft: 40 }}
              />
            </div>
            {canCreate && (
            <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={openCreate}>
              <Plus size={18} /> Add COD method
            </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <MuiDataTable
            rows={rows}
            columns={columns}
            getRowId={(row) => String(row._id)}
            loading={loading}
            paginationMode="server"
            rowCount={total}
            paginationModel={paginationModel}
            onPaginationModelChange={(model) =>
              setPaginationModel((current) => ({
                page: model.pageSize === current.pageSize ? model.page : 0,
                pageSize: model.pageSize,
              }))
            }
            pageSizeOptions={[10, 25, 50]}
            density="compact"
            showIndex
          />
        </div>
      </div>
      {open && (
        <Modal title={editingId ? 'Update COD method' : 'Add COD method'} onClose={close}>
          <form className="cod-method-form" onSubmit={formik.handleSubmit}>
            <div className="cod-method-form__scroll">
            {modalError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{modalError}</div>}
            <FormField label="Country" required error={fieldError('countryCode')}>
              <Select
                options={countryOptions}
                value={selectedCountry}
                onChange={(option) => formik.setFieldValue('countryCode', option?.value ?? '')}
                placeholder="Select country"
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={countrySelectStyles as unknown as StylesConfig<CountryOption, false>}
              />
            </FormField>
            <FormField label="Method" required error={fieldError('method')}>
              <select
                className="select"
                value={form.method}
                onChange={(event) => formik.setFieldValue('method', event.target.value)}
              >
                <option value="flat">Flat</option>
                <option value="weight">Weight</option>
              </select>
            </FormField>
            {form.method === 'flat' ? (
              <FormField label="Flat cost (AED)" required={!form.isFree} error={fieldError('flatCost')}>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`input${fieldError('flatCost') ? ' is-invalid' : ''}`}
                  value={form.flatCost}
                  onChange={(event) => formik.setFieldValue('flatCost', event.target.value)}
                  disabled={form.isFree}
                />
              </FormField>
            ) : (
              <>
                <FormField label="Base cost (AED)" required={!form.isFree} hint="Starting price for the shipment." error={fieldError('baseCost')}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`input${fieldError('baseCost') ? ' is-invalid' : ''}`}
                    value={form.baseCost}
                    onChange={(event) => formik.setFieldValue('baseCost', event.target.value)}
                    disabled={form.isFree}
                  />
                </FormField>
                <FormField label="Per kg (AED)" required={!form.isFree} error={fieldError('perKg')}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`input${fieldError('perKg') ? ' is-invalid' : ''}`}
                    value={form.perKg}
                    onChange={(event) => formik.setFieldValue('perKg', event.target.value)}
                    disabled={form.isFree}
                  />
                </FormField>
                <FormField label="Step kg" required={!form.isFree} hint="Charge per kg is applied in steps of this size." error={fieldError('stepKg')}>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className={`input${fieldError('stepKg') ? ' is-invalid' : ''}`}
                    value={form.stepKg}
                    onChange={(event) => formik.setFieldValue('stepKg', event.target.value)}
                    disabled={form.isFree}
                  />
                </FormField>
                <FormField label="Skip kg" hint="Kilograms already included in the base cost." error={fieldError('skipKg')}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={`input${fieldError('skipKg') ? ' is-invalid' : ''}`}
                    value={form.skipKg}
                    onChange={(event) => formik.setFieldValue('skipKg', event.target.value)}
                    disabled={form.isFree}
                  />
                </FormField>
              </>
            )}
            <div className="categories-form-toggles">
              <label className="categories-toggle-card">
                <span>Free</span>
                <span className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.isFree}
                    aria-label={form.isFree ? 'Charge for this method' : 'Make this method free'}
                    onChange={(event) => formik.setFieldValue('isFree', event.target.checked)}
                  />
                  <span className="toggle-switch-track" aria-hidden>
                    <span className="toggle-switch-thumb" />
                  </span>
                </span>
              </label>
              <label className="categories-toggle-card">
                <span>Active</span>
                <span className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.status}
                    aria-label={form.status ? 'Deactivate method' : 'Activate method'}
                    onChange={(event) => formik.setFieldValue('status', event.target.checked)}
                  />
                  <span className="toggle-switch-track" aria-hidden>
                    <span className="toggle-switch-thumb" />
                  </span>
                </span>
              </label>
            </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={close} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

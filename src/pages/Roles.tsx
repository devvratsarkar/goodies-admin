import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { accessApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { useRbac } from '../context/RbacContext'
import { FormField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Modal'
import { confirmDeleteItem } from '../utils/adminConfirm'
import { passwordRuleError } from '../utils/password'
import { ACTIONS, MODULES, type Action, type ModuleKey, type Permissions } from '../rbac'
import type { AccessRole, StaffMember } from '../types/api'

function listFrom<T>(payload: unknown): T[] {
  const body = payload as { data?: unknown } | undefined
  return Array.isArray(body?.data) ? (body.data as T[]) : []
}

function apiMessage(err: unknown, fallback: string) {
  const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return message || fallback
}

function samePermissions(a: Permissions, b: Permissions) {
  return MODULES.every((mod) => {
    const left = [...(a[mod.key] ?? [])].sort().join()
    const right = [...(b[mod.key] ?? [])].sort().join()
    return left === right
  })
}

const PASSWORD_HINT = 'At least 8 characters, with uppercase, lowercase, a number, and a special character.'
const ROLE_DESCRIPTION_LIMIT = 100

export function Roles() {
  const { profile } = useAuth()
  const { access, can } = useRbac()
  const [roles, setRoles] = useState<AccessRole[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<Permissions>({})
  const [saving, setSaving] = useState(false)
  const [roleModal, setRoleModal] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [roleFormError, setRoleFormError] = useState('')
  const [savingRoleForm, setSavingRoleForm] = useState(false)
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userRoleId, setUserRoleId] = useState('')
  const [userError, setUserError] = useState('')
  const [savingUser, setSavingUser] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffMember | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRoleId, setEditRoleId] = useState('')
  const [editStatus, setEditStatus] = useState(true)
  const [editUserError, setEditUserError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [busyUserId, setBusyUserId] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const panel: 'permissions' | 'staff' = location.pathname.startsWith('/staff') ? 'staff' : 'permissions'
  const showPanel = (next: 'permissions' | 'staff') => {
    const target = next === 'staff' ? '/staff' : '/roles'
    if (location.pathname !== target) navigate(target)
  }

  const selected = roles.find((role) => role._id === selectedId) ?? roles[0]
  const isOwnRole = !access.all && Boolean(selected && access.role?._id === selected._id)
  const locked = !selected || selected.is_super || isOwnRole || !can('roles', 'edit')
  const dirty = Boolean(selected) && !samePermissions(draft, selected.permissions as Permissions)
  const pickedRoleId = roles.some((role) => role._id === userRoleId) ? userRoleId : roles.find((role) => !role.is_super)?._id ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rolesRes, staffRes] = await Promise.all([accessApi.roles(), accessApi.staff()])
      setRoles(listFrom<AccessRole>(rolesRes.data))
      setStaff(listFrom<StaffMember>(staffRes.data))
    } catch (err) {
      setError(apiMessage(err, 'Failed to load roles'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selectedKey = `${selected?._id ?? ''}:${selected?.updatedAt ?? ''}`
  useEffect(() => {
    setDraft((selected?.permissions as Permissions) ?? {})
    // Reset only when a different role is picked or it was saved, so user-count updates keep unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  const toggle = (module: ModuleKey, action: Action, checked: boolean) => {
    if (locked) return
    setDraft((current) => {
      const next = new Set(current[module] ?? [])
      if (checked) {
        next.add(action)
        next.add('view')
      } else if (action === 'view') {
        next.clear()
      } else {
        next.delete(action)
      }
      return { ...current, [module]: ACTIONS.filter((item) => next.has(item)) }
    })
  }

  const setColumn = (action: Action, checked: boolean) => {
    MODULES.forEach((mod) => toggle(mod.key, action, checked))
  }

  const saveRole = async () => {
    if (!selected || locked) return
    setSaving(true)
    setError('')
    try {
      const res = await accessApi.updateRole(selected._id, { permissions: draft })
      const updated = (res.data as { data?: AccessRole }).data
      if (updated) {
        setRoles((list) => list.map((role) => (
          role._id === updated._id ? { ...role, ...updated, description: updated.description ?? role.description } : role
        )))
      }
      flash(`${selected.name} saved`)
    } catch (err) {
      setError(apiMessage(err, 'Failed to save role'))
    } finally {
      setSaving(false)
    }
  }

  const openRoleModal = () => {
    setEditingRoleId('')
    setNewRoleName('')
    setNewRoleDescription('')
    setRoleFormError('')
    setRoleModal(true)
  }

  const openEditRole = () => {
    if (!selected || locked) return
    setEditingRoleId(selected._id)
    setNewRoleName(selected.name)
    setNewRoleDescription((selected.description ?? '').slice(0, ROLE_DESCRIPTION_LIMIT))
    setRoleFormError('')
    setRoleModal(true)
  }

  const closeRoleModal = () => {
    if (savingRoleForm) return
    setRoleModal(false)
  }

  const saveRoleDetails = async (event: FormEvent) => {
    event.preventDefault()
    const name = newRoleName.trim()
    const description = newRoleDescription.trim().slice(0, ROLE_DESCRIPTION_LIMIT)
    if (!name) {
      setRoleFormError('Role name is required.')
      return
    }
    setSavingRoleForm(true)
    setRoleFormError('')
    setError('')
    try {
      if (editingRoleId) {
        const res = await accessApi.updateRole(editingRoleId, { name, description })
        const updated = (res.data as { data?: AccessRole }).data
        setRoles((list) => list.map((role) => {
          if (role._id !== editingRoleId) return role
          return { ...role, ...updated, name, description }
        }))
        flash('Role updated')
      } else {
        const res = await accessApi.createRole({ name, description, permissions: {} })
        const created = (res.data as { data?: AccessRole }).data
        if (created) {
          setRoles((list) => [...list, { ...created, description: created.description ?? description }])
          setSelectedId(created._id)
        }
        flash('Role added')
      }
      setRoleModal(false)
    } catch (err) {
      setRoleFormError(apiMessage(err, editingRoleId ? 'Failed to update role' : 'Failed to create role'))
    } finally {
      setSavingRoleForm(false)
    }
  }

  const deleteRole = async () => {
    if (!selected || selected.is_super || selected.is_system) return
    if (!(await confirmDeleteItem(selected.name))) return
    setError('')
    try {
      await accessApi.deleteRole(selected._id)
      setRoles((list) => list.filter((role) => role._id !== selected._id))
      setSelectedId('')
      flash('Role deleted')
    } catch (err) {
      setError(apiMessage(err, 'Failed to delete role'))
    }
  }

  const addUser = async (event: FormEvent) => {
    event.preventDefault()
    const ruleError = passwordRuleError(password)
    if (ruleError) {
      setUserError(ruleError)
      return
    }
    setSavingUser(true)
    setUserError('')
    try {
      const res = await accessApi.createStaff({
        name: userName.trim(),
        email: email.trim(),
        password,
        role_id: pickedRoleId,
      })
      const created = (res.data as { data?: StaffMember }).data
      if (created) setStaff((list) => [created, ...list])
      setRoles((list) => list.map((role) => (role._id === pickedRoleId ? { ...role, user_count: role.user_count + 1 } : role)))
      setUserName('')
      setEmail('')
      setPassword('')
      flash('User added')
    } catch (err) {
      setUserError(apiMessage(err, 'Failed to add user'))
    } finally {
      setSavingUser(false)
    }
  }

  const updateUser = async (user: StaffMember, data: { role_id?: string; status?: boolean }) => {
    setBusyUserId(user._id)
    setError('')
    try {
      const res = await accessApi.updateStaff(user._id, data)
      const updated = (res.data as { data?: StaffMember }).data
      const role = data.role_id ? roles.find((item) => item._id === data.role_id) : undefined
      const nextRole = role ? { _id: role._id, name: role.name, is_super: role.is_super } : user.role
      setStaff((list) => list.map((item) => {
        if (item._id !== user._id) return item
        return {
          ...item,
          ...updated,
          status: data.status ?? updated?.status ?? item.status,
          role: data.role_id ? (updated?.role ?? nextRole) : (updated?.role ?? item.role),
        }
      }))
      if (data.role_id && data.role_id !== user.role?._id) {
        setRoles((list) => list.map((item) => {
          if (item._id === data.role_id) return { ...item, user_count: item.user_count + 1 }
          if (item._id === user.role?._id) return { ...item, user_count: Math.max(0, item.user_count - 1) }
          return item
        }))
      }
    } catch (err) {
      setError(apiMessage(err, 'Failed to update user'))
    } finally {
      setBusyUserId('')
    }
  }

  const openEditUser = (user: StaffMember) => {
    setEditingUser(user)
    setEditName(user.name || '')
    setEditEmail(user.email || '')
    setEditPassword('')
    setEditRoleId(user.role?._id ?? '')
    setEditStatus(Boolean(user.status))
    setEditUserError('')
  }

  const closeEditUser = () => {
    if (savingEdit) return
    setEditingUser(null)
  }

  const saveUser = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingUser) return
    const name = editName.trim()
    const nextEmail = editEmail.trim()
    if (!name) {
      setEditUserError('Name is required.')
      return
    }
    if (!nextEmail) {
      setEditUserError('Email is required.')
      return
    }
    const ruleError = editPassword ? passwordRuleError(editPassword) : ''
    if (ruleError) {
      setEditUserError(ruleError)
      return
    }
    if (!editRoleId) {
      setEditUserError('Select a role.')
      return
    }
    setSavingEdit(true)
    setEditUserError('')
    try {
      const previousRoleId = editingUser.role?._id
      const payload: { name: string; email: string; role_id: string; status: boolean; password?: string } = {
        name,
        email: nextEmail,
        role_id: editRoleId,
        status: editStatus,
      }
      if (editPassword) payload.password = editPassword
      const res = await accessApi.updateStaff(editingUser._id, payload)
      const updated = (res.data as { data?: StaffMember }).data
      const role = roles.find((item) => item._id === editRoleId)
      const nextRole = role ? { _id: role._id, name: role.name, is_super: role.is_super } : editingUser.role
      setStaff((list) => list.map((item) => (
        item._id === editingUser._id
          ? { ...item, ...updated, name, email: nextEmail, status: editStatus, role: updated?.role ?? nextRole }
          : item
      )))
      if (previousRoleId !== editRoleId) {
        setRoles((list) => list.map((item) => {
          if (item._id === editRoleId) return { ...item, user_count: item.user_count + 1 }
          if (item._id === previousRoleId) return { ...item, user_count: Math.max(0, item.user_count - 1) }
          return item
        }))
      }
      setEditingUser(null)
      flash('User updated')
    } catch (err) {
      setEditUserError(apiMessage(err, 'Failed to update user'))
    } finally {
      setSavingEdit(false)
    }
  }

  const removeUser = async (user: StaffMember) => {
    if (!(await confirmDeleteItem(user.name || user.email))) return
    setBusyUserId(user._id)
    setError('')
    try {
      await accessApi.deleteStaff(user._id)
      setStaff((list) => list.filter((item) => item._id !== user._id))
      setRoles((list) => list.map((role) => (role._id === user.role?._id ? { ...role, user_count: Math.max(0, role.user_count - 1) } : role)))
    } catch (err) {
      setError(apiMessage(err, 'Failed to delete user'))
    } finally {
      setBusyUserId('')
    }
  }

  const columnState = useMemo(
    () => Object.fromEntries(ACTIONS.map((action) => [action, MODULES.every((mod) => (draft[mod.key] ?? []).includes(action))])) as Record<Action, boolean>,
    [draft],
  )

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles & access</h1>
          <p className="page-subtitle">Choose what each role can do, then give staff a role. Staff sign in with their email and password.</p>
        </div>
        <div className="rbac-tabs" role="tablist" aria-label="Roles sections">
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'permissions'}
            className={`rbac-tab${panel === 'permissions' ? ' is-active' : ''}`}
            onClick={() => showPanel('permissions')}
          >
            Permissions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === 'staff'}
            className={`rbac-tab${panel === 'staff' ? ' is-active' : ''}`}
            onClick={() => showPanel('staff')}
          >
            Staff users
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {panel === 'permissions' && <div className="rbac-layout">
        <aside className="card rbac-side">
          <div className="rbac-side__head">
            <h2>Roles</h2>
          </div>
          <div className="rbac-role-list">
            {roles.map((role) => (
              <button
                key={role._id}
                type="button"
                className={`rbac-role${role._id === selected?._id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(role._id)}
              >
                <span className="rbac-role__name">{role.name}</span>
                <span className="rbac-role__meta">
                  {role.user_count} user{role.user_count === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
          {can('roles', 'create') && (
            <div className="rbac-create">
              <button type="button" className="btn btn-primary" onClick={openRoleModal}>
                Add role
              </button>
            </div>
          )}
        </aside>

        {selected && (
          <section className="card rbac-editor">
            <div className="rbac-editor__head">
              <div>
                <h2>{selected.name}</h2>
                {selected.description?.trim() && <p>{selected.description}</p>}
                {selected.is_super && <p>Full access to everything. This role cannot be changed.</p>}
                {isOwnRole && <p>This is your role. Ask a Super Admin to change it.</p>}
              </div>
              <div className="rbac-editor__actions">
                {!locked && (
                  <button type="button" className="btn btn-sm rbac-edit-btn" onClick={openEditRole}>
                    <Pencil size={14} />
                    Edit
                  </button>
                )}
                {!locked && dirty && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(selected.permissions as Permissions)} disabled={saving}>
                    Discard
                  </button>
                )}
                {!locked && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveRole()} disabled={!dirty || saving}>
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                )}
                {can('roles', 'delete') && !selected.is_super && !selected.is_system && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => void deleteRole()}>Delete</button>
                )}
              </div>
            </div>

            <div className="rbac-matrix-wrap">
              <table className="rbac-matrix">
                <thead>
                  <tr>
                    <th>Module</th>
                    {ACTIONS.map((action) => (
                      <th key={action}>
                        <label className="rbac-matrix__col">
                          {!locked && (
                            <input
                              type="checkbox"
                              aria-label={`${action} every module`}
                              checked={columnState[action]}
                              onChange={(event) => setColumn(action, event.target.checked)}
                            />
                          )}
                          <span>{action[0].toUpperCase() + action.slice(1)}</span>
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.flatMap((mod, index) => {
                    const rows: ReactElement[] = []
                    if (index === 0 || MODULES[index - 1].group !== mod.group) {
                      rows.push(
                        <tr key={mod.group} className="rbac-matrix-group">
                          <td colSpan={ACTIONS.length + 1}>{mod.group}</td>
                        </tr>,
                      )
                    }
                    rows.push(
                      <tr key={mod.key}>
                        <td>{mod.label}</td>
                        {ACTIONS.map((action) => (
                          <td key={action}>
                            <input
                              type="checkbox"
                              aria-label={`${action} ${mod.label}`}
                              checked={selected.is_super || (draft[mod.key] ?? []).includes(action)}
                              disabled={locked}
                              onChange={(event) => toggle(mod.key, action, event.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>,
                    )
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>}

      {panel === 'staff' && <section className="card rbac-team">
        <div className="rbac-editor__head">
          <div>
            <h2>Staff users</h2>
            <p>Add a person and choose which role they get after login.</p>
          </div>
        </div>

        {can('staff', 'create') && (
          <form className="rbac-member-form" onSubmit={(event) => void addUser(event)}>
            <label className="rbac-field">
              <span>Name</span>
              <input className="input" value={userName} placeholder="Jane Doe" onChange={(event) => setUserName(event.target.value)} />
            </label>
            <label className="rbac-field">
              <span>Email</span>
              <input className="input" type="email" value={email} placeholder="jane@example.com" onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="rbac-field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={password}
                placeholder={PASSWORD_HINT}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="rbac-field">
              <span>Role</span>
              <select className="select" value={pickedRoleId} onChange={(event) => setUserRoleId(event.target.value)}>
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>{role.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingUser || !userName.trim() || !email.trim() || !password || !pickedRoleId}
            >
              {savingUser ? 'Adding...' : 'Add user'}
            </button>
            {userError && <p className="rbac-user-error">{userError}</p>}
          </form>
        )}

        {staff.length === 0 ? (
          <p className="rbac-empty">No staff users yet.</p>
        ) : (
          <div className="rbac-matrix-wrap">
            <table className="rbac-team-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {staff.map((user) => {
                  const self = user._id === profile?._id
                  const busy = busyUserId === user._id
                  return (
                    <tr key={user._id}>
                      <td>{[user.name, user.last_name].filter(Boolean).join(' ') || '-'}</td>
                      <td>{user.email}</td>
                      <td>
                        <select
                          className="select"
                          value={user.role?._id ?? ''}
                          disabled={busy || self || !can('staff', 'edit')}
                          onChange={(event) => void updateUser(user, { role_id: event.target.value })}
                        >
                          {!user.role && <option value="">No role</option>}
                          {roles.map((role) => (
                            <option key={role._id} value={role._id}>{role.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className={`toggle-switch toggle-switch--sm${busy || self || !can('staff', 'edit') ? ' is-disabled' : ''}`}>
                          <input
                            type="checkbox"
                            aria-label={`${user.email} active`}
                            checked={user.status}
                            disabled={busy || self || !can('staff', 'edit')}
                            onChange={(event) => void updateUser(user, { status: event.target.checked })}
                          />
                          <span className="toggle-switch-track" aria-hidden>
                            <span className="toggle-switch-thumb" />
                          </span>
                        </label>
                      </td>
                      <td>
                        <div className="rbac-team-actions">
                          {can('staff', 'edit') && !self && (
                            <button type="button" className="btn btn-sm rbac-edit-btn" disabled={busy} onClick={() => openEditUser(user)}>
                              <Pencil size={14} />
                              Edit
                            </button>
                          )}
                          {can('staff', 'delete') && !self && (
                            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void removeUser(user)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>}

      {editingUser && (
        <Modal title="Update user" onClose={closeEditUser}>
          <form onSubmit={(event) => void saveUser(event)}>
            {editUserError && <div className="alert alert-error">{editUserError}</div>}
            <FormField label="Name" htmlFor="staff-name" required>
              <input id="staff-name" className="input" value={editName} autoFocus onChange={(event) => setEditName(event.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="staff-email" required>
              <input id="staff-email" className="input" type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
            </FormField>
            <FormField label="Password" htmlFor="staff-password" hint={`Leave blank to keep the current password. ${PASSWORD_HINT}`}>
              <input
                id="staff-password"
                className="input"
                type="password"
                value={editPassword}
                autoComplete="new-password"
                onChange={(event) => setEditPassword(event.target.value)}
              />
            </FormField>
            <FormField label="Role" htmlFor="staff-role" required>
              <select id="staff-role" className="select" value={editRoleId} onChange={(event) => setEditRoleId(event.target.value)}>
                {!editRoleId && <option value="">Select a role</option>}
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>{role.name}</option>
                ))}
              </select>
            </FormField>
            <label className="toggle-switch" htmlFor="staff-active">
              <input id="staff-active" type="checkbox" checked={editStatus} onChange={(event) => setEditStatus(event.target.checked)} />
              <span className="toggle-switch-track" aria-hidden>
                <span className="toggle-switch-thumb" />
              </span>
              <span className="toggle-switch-label">Active</span>
            </label>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeEditUser} disabled={savingEdit}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingEdit || !editName.trim() || !editEmail.trim() || !editRoleId}>
                {savingEdit ? 'Saving...' : 'Save user'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {roleModal && (
        <Modal title={editingRoleId ? 'Edit role' : 'Add role'} onClose={closeRoleModal}>
          <form onSubmit={(event) => void saveRoleDetails(event)}>
            {roleFormError && <div className="alert alert-error">{roleFormError}</div>}
            <FormField label="Role name" htmlFor="role-name" required>
              <input
                id="role-name"
                className="input"
                value={newRoleName}
                maxLength={50}
                autoFocus
                onChange={(event) => setNewRoleName(event.target.value)}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="role-description"
              hint={`${newRoleDescription.length} / ${ROLE_DESCRIPTION_LIMIT}`}
            >
              <textarea
                id="role-description"
                className="textarea"
                rows={3}
                maxLength={ROLE_DESCRIPTION_LIMIT}
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value.slice(0, ROLE_DESCRIPTION_LIMIT))}
              />
            </FormField>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeRoleModal} disabled={savingRoleForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingRoleForm || !newRoleName.trim()}>
                {savingRoleForm ? 'Saving...' : editingRoleId ? 'Save role' : 'Add role'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

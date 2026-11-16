import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useRbac } from '../../context/RbacContext'
import { MODULES, permissionForPath } from '../../rbac'

export function PermissionGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { can, roleName, firstAllowedPath } = useRbac()
  const required = permissionForPath(pathname)

  if (!required || can(required.module, required.action)) return children

  const label = MODULES.find((mod) => mod.key === required.module)?.label ?? 'this page'

  return (
    <div className="rbac-denied card">
      <h1>This page is locked</h1>
      <p>{roleName} cannot {required.action} {label}.</p>
      <Link to={firstAllowedPath} className="btn btn-primary">Open an allowed page</Link>
    </div>
  )
}

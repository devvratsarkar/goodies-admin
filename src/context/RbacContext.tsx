import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { MODULES, type Action, type ModuleKey } from '../rbac'
import type { AdminAccess } from '../types/api'

type RbacValue = {
  access: AdminAccess
  roleName: string
  can: (module: ModuleKey, action: Action) => boolean
  firstAllowedPath: string
}

const RbacContext = createContext<RbacValue | null>(null)

/** Used when the API does not send access, which means it does not restrict this account either. */
const FULL_ACCESS: AdminAccess = { all: true, owner: true, role: null, permissions: {} }

export function RbacProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const access = profile?.access ?? FULL_ACCESS
  const profileRole = typeof profile?.role === 'string' ? profile.role : profile?.role?.name
  const roleName = access.role?.name || profileRole || 'Admin'

  const can = (module: ModuleKey, action: Action) =>
    access.all || (access.permissions[module] ?? []).includes(action)

  const firstAllowedPath = MODULES.find((mod) => can(mod.key, 'view'))?.path ?? '/profile'

  return (
    <RbacContext.Provider value={{ access, roleName, can, firstAllowedPath }}>
      {children}
    </RbacContext.Provider>
  )
}

export function useRbac() {
  const ctx = useContext(RbacContext)
  if (!ctx) throw new Error('useRbac must be used within RbacProvider')
  return ctx
}

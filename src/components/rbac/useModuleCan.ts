import { useRbac } from '../../context/RbacContext'
import type { ModuleKey } from '../../rbac'

export function useModuleCan(module: ModuleKey) {
  const { can } = useRbac()
  return {
    canCreate: can(module, 'create'),
    canEdit: can(module, 'edit'),
    canDelete: can(module, 'delete'),
    canExport: can(module, 'export'),
  }
}

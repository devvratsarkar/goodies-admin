import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { PermissionGate } from '../rbac/PermissionGate'

const COMPACT_QUERY = '(max-width: 1023px)'

export function Layout() {
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches,
  )
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch {
      // ignore
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY)
    const onChange = () => {
      setIsCompact(media.matches)
      if (!media.matches) setNavOpen(false)
    }
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const collapseLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <div className={`app-layout${isCompact ? ' nav-compact' : ''}${!isCompact && sidebarCollapsed ? ' sidebar-collapsed' : ''}${navOpen ? ' nav-open' : ''}`}>
      {isCompact && navOpen && (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} />
      )}
      <Sidebar
        collapsed={!isCompact && sidebarCollapsed}
        drawer={isCompact}
        hidden={isCompact && !navOpen}
        onClose={() => setNavOpen(false)}
        onNavigate={() => setNavOpen(false)}
      />
      {!isCompact && (
        <button
          type="button"
          className="sidebar-rail-toggle"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={collapseLabel}
          title={collapseLabel}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}
      <div className="main-content">
        <Header
          compact={isCompact}
          onOpenMenu={() => setNavOpen(true)}
        />
        <main className="content-area">
          <PermissionGate>
            <Outlet />
          </PermissionGate>
        </main>
      </div>
    </div>
  )
}

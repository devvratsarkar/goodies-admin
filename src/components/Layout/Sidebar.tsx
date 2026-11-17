import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  LineChart,
  Boxes,
  HelpCircle,
  // Store,
  Package,
  ShoppingCart,
  Truck,
  Mail,
  Mails,
  Users,
  User,
  LogOut,
  X,
  Globe,
  Megaphone,
  CreditCard,
  Ruler,
  TicketPercent,
  ReceiptText,
  Banknote,
  Newspaper,
  FolderTree,
  Ban,
  Images,
  Star,
  Shield,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getProfileImageUrl } from '../../api/client'
import { globalSettingsApi } from '../../api/endpoints'
import { useAuth } from '../../context/AuthContext'
import { useRbac } from '../../context/RbacContext'
import type { ModuleKey } from '../../rbac'

const FALLBACK_LOGO = '/public/goodies.webp'

function settingsRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}
  const body = payload as { data?: unknown }
  const nested = body.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Record<string, unknown>
  return payload as Record<string, unknown>
}

function setFavicon(href?: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!href) return
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = href
}

const navSections: {
  title: string
  items: { to: string; icon: typeof LayoutDashboard; label: string; module: ModuleKey }[]
}[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
      { to: '/analytics', icon: LineChart, label: 'Analytics', module: 'analytics' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { to: '/categories', icon: Boxes, label: 'Categories', module: 'categories' },
      // { to: '/brands', icon: Store, label: 'Brands' },
      // { to: '/colors', icon: Palette, label: 'Colors' },
      { to: '/sizes', icon: Ruler, label: 'Sizes', module: 'sizes' },
      { to: '/products', icon: Package, label: 'Products', module: 'products' },
      { to: '/reviews', icon: Star, label: 'Reviews', module: 'reviews' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/blog-categories', icon: FolderTree, label: 'Blog Categories', module: 'blog-categories' },
      { to: '/articles', icon: Newspaper, label: 'Blogs', module: 'articles' },
      { to: '/faqs', icon: HelpCircle, label: 'FAQs', module: 'faqs' },
    ],
  },
  {
    title: 'Media',
    items: [
      { to: '/media', icon: Images, label: 'Media', module: 'media' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/coupons', icon: TicketPercent, label: 'Coupons', module: 'coupons' },
      { to: '/orders', icon: ShoppingCart, label: 'Orders', module: 'orders' },
      { to: '/order-cancellations', icon: Ban, label: 'Cancellations', module: 'order-cancellations' },
      { to: '/shipping-rates', icon: Truck, label: 'Shipping', module: 'shipping-rates' },
      { to: '/exchange-rates', icon: Banknote, label: 'Exchange Rates', module: 'exchange-rates' },
      { to: '/payment-report', icon: ReceiptText, label: 'Payment Report', module: 'payment-report' },
    ],
  },
  {
    title: 'Audience',
    items: [
      { to: '/customers', icon: Users, label: 'Customers', module: 'customers' },
      { to: '/contact-enquiries', icon: Mail, label: 'Contact Enquiries', module: 'contact-enquiries' },
      { to: '/subscribers', icon: Users, label: 'Subscribers', module: 'subscribers' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { to: '/global-settings', icon: Globe, label: 'Global settings', module: 'global-settings' },
      { to: '/page-notices', icon: Megaphone, label: 'Page notices', module: 'page-notices' },
      { to: '/payment-settings', icon: CreditCard, label: 'Payment settings', module: 'payment-settings' },
      { to: '/smtp-settings', icon: Mail, label: 'SMTP settings', module: 'smtp-settings' },
      { to: '/email-settings', icon: Mails, label: 'Email settings', module: 'email-settings' },
      { to: '/roles', icon: Shield, label: 'Roles & access', module: 'roles' },
    ],
  },
]

export function Sidebar({
  collapsed,
  drawer = false,
  hidden = false,
  onClose,
  onNavigate,
}: {
  collapsed: boolean
  drawer?: boolean
  hidden?: boolean
  onClose: () => void
  onNavigate?: () => void
}) {
  const { logout } = useAuth()
  const { can } = useRbac()
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.module, 'view')),
    }))
    .filter((section) => section.items.length > 0)
  const [logoUrl, setLogoUrl] = useState<string>()
  const [logoFailed, setLogoFailed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let ignore = false
    const loadBrand = () => {
      globalSettingsApi
        .get()
        .then((res) => {
          if (ignore) return
          const settings = settingsRecord(res.data)
          const logo = typeof settings.logo === 'string' ? getProfileImageUrl(settings.logo) : undefined
          const icon = typeof settings.icon_image === 'string' ? getProfileImageUrl(settings.icon_image) : undefined
          setLogoUrl(logo)
          setLogoFailed(false)
          setFavicon(icon)
        })
        .catch(() => {})
    }
    loadBrand()
    window.addEventListener('global-settings-saved', loadBrand)
    return () => {
      ignore = true
      window.removeEventListener('global-settings-saved', loadBrand)
    }
  }, [])

  const logoSrc = !logoFailed && logoUrl ? logoUrl : FALLBACK_LOGO

  return (
    <aside className="sidebar" inert={hidden ? true : undefined}>
      <div className="sidebar-brand">
        <img
          src={logoSrc}
          alt=""
          className="sidebar-logo"
          onError={() => setLogoFailed(true)}
        />
        <div className="sidebar-brand-copy">
          <span className="sidebar-brand-text">Goodies</span>
          <span className="sidebar-brand-sub">Admin</span>
        </div>
        {drawer && (
          <button type="button" className="sidebar-toggle" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="sidebar-nav">
        {visibleSections.map((section) => (
          <div key={section.title} className="sidebar-nav-section">
            <div className="sidebar-nav-section-title">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => {
                  const onTrash = location.pathname.startsWith('/categories/trash')
                  const active =
                    item.to === '/categories'
                      ? location.pathname === '/categories' ||
                        (location.pathname.startsWith('/categories/') && !onTrash)
                      : item.to === '/categories/trash'
                        ? onTrash
                        : isActive
                  return `sidebar-link ${active ? 'active' : ''}`
                }}
                end={item.to === '/'}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
              >
                <item.icon size={20} />
                <span className="sidebar-link-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <NavLink
          to="/profile"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          title={collapsed ? 'Profile' : undefined}
          onClick={onNavigate}
        >
          <User size={20} />
          <span className="sidebar-link-label">Profile</span>
        </NavLink>
        <button
          type="button"
          className="sidebar-link sidebar-link--button"
          title={collapsed ? 'Logout' : undefined}
          onClick={() => {
            onNavigate?.()
            logout()
          }}
        >
          <LogOut size={20} />
          <span className="sidebar-link-label">Logout</span>
        </button>
      </div>
    </aside>
  )
}

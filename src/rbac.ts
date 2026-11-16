export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const
export type Action = (typeof ACTIONS)[number]

export const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview', path: '/' },
  { key: 'categories', label: 'Categories', group: 'Catalog', path: '/categories' },
  { key: 'sizes', label: 'Sizes', group: 'Catalog', path: '/sizes' },
  { key: 'products', label: 'Products', group: 'Catalog', path: '/products' },
  { key: 'reviews', label: 'Reviews', group: 'Catalog', path: '/reviews' },
  { key: 'blog-categories', label: 'Blog categories', group: 'Content', path: '/blog-categories' },
  { key: 'articles', label: 'Blogs', group: 'Content', path: '/articles' },
  { key: 'faqs', label: 'FAQs', group: 'Content', path: '/faqs' },
  { key: 'media', label: 'Media', group: 'Media', path: '/media' },
  { key: 'coupons', label: 'Coupons', group: 'Sales', path: '/coupons' },
  { key: 'orders', label: 'Orders', group: 'Sales', path: '/orders' },
  { key: 'order-cancellations', label: 'Cancellations', group: 'Sales', path: '/order-cancellations' },
  { key: 'shipping-rates', label: 'Shipping', group: 'Sales', path: '/shipping-rates' },
  { key: 'exchange-rates', label: 'Exchange rates', group: 'Sales', path: '/exchange-rates' },
  { key: 'payment-report', label: 'Payment report', group: 'Sales', path: '/payment-report' },
  { key: 'customers', label: 'Customers', group: 'Audience', path: '/customers' },
  { key: 'contact-enquiries', label: 'Contact enquiries', group: 'Audience', path: '/contact-enquiries' },
  { key: 'subscribers', label: 'Subscribers', group: 'Audience', path: '/subscribers' },
  { key: 'global-settings', label: 'Global settings', group: 'Settings', path: '/global-settings' },
  { key: 'page-notices', label: 'Page notices', group: 'Settings', path: '/page-notices' },
  { key: 'payment-settings', label: 'Payment settings', group: 'Settings', path: '/payment-settings' },
  { key: 'smtp-settings', label: 'SMTP settings', group: 'Settings', path: '/smtp-settings' },
  { key: 'email-settings', label: 'Email settings', group: 'Settings', path: '/email-settings' },
  { key: 'roles', label: 'Roles & access', group: 'Settings', path: '/roles' },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']
export type Permissions = Partial<Record<ModuleKey, Action[]>>

export function permissionForPath(pathname: string): { module: ModuleKey; action: Action } | null {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return null
  if (pathname.startsWith('/coupon-usage')) return { module: 'coupons', action: 'view' }

  const match = MODULES.filter(
    (mod) => mod.path !== '/' && (pathname === mod.path || pathname.startsWith(`${mod.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length)[0]

  if (!match) return pathname === '/' ? { module: 'dashboard', action: 'view' } : null
  if (pathname.includes('/new')) return { module: match.key, action: 'create' }
  if (pathname.endsWith('/edit')) return { module: match.key, action: 'edit' }
  return { module: match.key, action: 'view' }
}

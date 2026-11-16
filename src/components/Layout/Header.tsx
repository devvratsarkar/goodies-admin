import { Menu } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useRbac } from '../../context/RbacContext'
import { getProfileImageCandidates } from '../../api/client'
import { ThemeToggle } from '../ThemeToggle'
import { useEffect, useMemo, useState } from 'react'
import type { AdminProfile } from '../../types/api'

function friendlyName(value: string) {
  const trimmed = value.trim()
  if (trimmed.length > 2 && trimmed === trimmed.toUpperCase()) {
    return trimmed.toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase())
  }
  return trimmed
}

function roleLabel(role: AdminProfile['role']) {
  const raw = typeof role === 'string' ? role : role?.name
  const text = raw?.replace(/[_-]+/g, ' ').trim()
  if (!text || text === '[object Object]') return ''
  if (text === text.toUpperCase()) return text.toLowerCase().replace(/\b\p{L}/gu, (char) => char.toUpperCase())
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function Header({
  compact,
  onOpenMenu,
}: {
  compact: boolean
  onOpenMenu: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const { access } = useRbac()
  const [avatarIndex, setAvatarIndex] = useState(0)
  const name = friendlyName(
    profile?.name
      ? [profile.name, profile.last_name].filter(Boolean).join(' ')
      : profile?.email ?? 'Admin',
  )
  const roleName = access.role?.name || roleLabel(profile?.role)

  const initials =
    profile?.name
      ? [profile.name, profile.last_name]
          .filter(Boolean)
          .map((n) => n!.charAt(0).toUpperCase())
          .join('')
      : profile?.email
        ? profile.email.charAt(0).toUpperCase()
        : 'A'

  const goToProfile = () => {
    navigate('/profile')
  }

  const avatarCandidates = useMemo(
    () => getProfileImageCandidates(profile?.profile_pic),
    [profile?.profile_pic]
  )
  const profileImgUrl = avatarCandidates[avatarIndex]

  useEffect(() => {
    setAvatarIndex(0)
  }, [profile?.profile_pic])

  const breadcrumbs = useMemo(() => {
    const staticLabels: Record<string, string> = {
      'global-settings': 'Global Settings',
      'page-notices': 'Page notices',
      'payment-settings': 'Payment Settings',
      'smtp-settings': 'SMTP Settings',
      'email-settings': 'Email Settings',
      roles: 'Roles & access',
      'payment-report': 'Payment Report',
      'shipping-rates': 'Shipping',
      'exchange-rates': 'Exchange Rates',
      'order-cancellations': 'Order Cancellations',
      'contact-enquiries': 'Contact Enquiries',
      reviews: 'Reviews',
      'forgot-password': 'Forgot Password',
      'verify-otp': 'Verify OTP',
      'reset-password': 'Reset Password',
    }
    const detailLabels: Record<string, string> = {
      orders: 'Order Details',
      products: 'Product Details',
      articles: 'Edit Blog',
      categories: 'Edit Category',
      'order-cancellations': 'Cancellation Details',
    }

    const segments = location.pathname.split('/').filter(Boolean)
    const list = [{ label: 'Dashboard', path: '/' }]
    let runningPath = ''

    segments.forEach((segment, index) => {
      runningPath += `/${segment}`
      const isLast = index === segments.length - 1
      const prev = segments[index - 1]
      const isIdLike = /^[a-f0-9]{8,}$/i.test(segment) || /^\d+$/.test(segment)
      let label = staticLabels[segment]
      if (!label) {
        if (segment === 'new') label = 'Create'
        else if (segment === 'edit') label = 'Edit'
        else if (isIdLike && prev && detailLabels[prev]) label = detailLabels[prev]
        else label = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      }
      list.push({
        label,
        path: isLast ? location.pathname : runningPath,
      })
    })
    return list
  }, [location.pathname])

  const current = breadcrumbs[breadcrumbs.length - 1]
  const trail = breadcrumbs.slice(0, -1)
  return (
    <header className="header">
      <div className="header-left">
        {compact && (
          <button type="button" className="header-menu" onClick={onOpenMenu} aria-label="Open menu" title="Open menu">
            <Menu size={18} />
          </button>
        )}
        <div className="header-titles">
          {trail.length > 0 && (
            <nav className="header-breadcrumbs" aria-label="Breadcrumb">
              {trail.map((crumb, idx) => (
                <span key={`${crumb.path}-${idx}`} className="header-breadcrumb-item">
                  {idx > 0 && <span className="header-breadcrumb-sep">/</span>}
                  <Link to={crumb.path} className="header-breadcrumb-link">
                    {crumb.label}
                  </Link>
                </span>
              ))}
            </nav>
          )}
          <span className="header-title">{current?.label ?? 'Dashboard'}</span>
        </div>
      </div>
      <div className="header-right">
        <ThemeToggle />
        <button type="button" className="header-user" onClick={goToProfile} title="Open profile">
          {profileImgUrl ? (
            <img
              src={profileImgUrl}
              alt=""
              className="header-avatar"
              onError={() => {
                setAvatarIndex((i) => (i + 1 < avatarCandidates.length ? i + 1 : i))
              }}
            />
          ) : (
            <span className="header-avatar header-avatar--fallback" aria-hidden="true">
              {initials}
            </span>
          )}
          <span className="header-user-meta">
            <span className="header-user-name">{name}</span>
            {roleName ? <span className="header-user-role">{roleName}</span> : null}
          </span>
        </button>
      </div>
    </header>
  )
}

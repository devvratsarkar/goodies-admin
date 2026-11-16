import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export type DashboardKpiValueTone = 'default' | 'danger' | 'success'

interface DashboardCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  color: string
  hint?: string
  valueTone?: DashboardKpiValueTone
  loading?: boolean
  /** When set, the card navigates to this route on click. */
  to?: string
}

export function DashboardCard({
  icon: Icon,
  label,
  value,
  color,
  hint,
  valueTone = 'default',
  loading,
  to,
}: DashboardCardProps) {
  if (loading) {
    return (
      <div className="dashboard-kpi-card dashboard-kpi-card--skeleton" style={{ ['--kpi-accent' as string]: color }}>
        <div className="dashboard-kpi-card__body">
          <div className="dashboard-skeleton-line dashboard-skeleton-line-short dashboard-kpi-skel-label" />
          <div className="dashboard-skeleton-line dashboard-skeleton-line-long dashboard-kpi-skel-value" />
          <div className="dashboard-skeleton-line dashboard-skeleton-line-short dashboard-kpi-skel-hint" />
        </div>
        <div className="dashboard-kpi-icon dashboard-kpi-icon--skeleton" aria-hidden />
      </div>
    )
  }

  const valueClass =
    valueTone === 'danger'
      ? 'dashboard-kpi-value dashboard-kpi-value--danger'
      : valueTone === 'success'
        ? 'dashboard-kpi-value dashboard-kpi-value--success'
        : 'dashboard-kpi-value'

  const cardClass = to ? 'dashboard-kpi-card dashboard-kpi-card--clickable' : 'dashboard-kpi-card'
  const cardStyle = { ['--kpi-accent' as string]: color }

  const content = (
    <>
      <div className="dashboard-kpi-card__body">
        <p className="dashboard-kpi-label">{label}</p>
        <p className={valueClass}>{value}</p>
        {hint ? <p className="dashboard-kpi-hint">{hint}</p> : null}
      </div>
      <div className="dashboard-kpi-icon" style={{ backgroundColor: `color-mix(in oklab, ${color} 22%, transparent)`, color }}>
        <Icon size={20} strokeWidth={2} />
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={cardClass} style={cardStyle} aria-label={label}>
        {content}
      </Link>
    )
  }

  return (
    <div className={cardClass} style={cardStyle}>
      {content}
    </div>
  )
}

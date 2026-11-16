import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  rightContent?: ReactNode
}

export function SectionHeader({ title, subtitle, rightContent }: SectionHeaderProps) {
  return (
    <div className="dashboard-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {rightContent ? <div className="dashboard-header-actions">{rightContent}</div> : null}
    </div>
  )
}

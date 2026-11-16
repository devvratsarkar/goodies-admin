import type { CSSProperties, ReactNode } from 'react'
import { EmptyState } from './EmptyState'

interface ChartCardProps {
  title: string
  /** Top accent stripe color (e.g. chart theme). */
  accent?: string
  /** Span full width in the dashboard chart grid. */
  wide?: boolean
  /** Extra class on the chart body, for taller panels such as the map. */
  panelClassName?: string
  actions?: ReactNode
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  isEmpty?: boolean
  children: ReactNode
}

export function ChartCard({
  title,
  accent,
  wide,
  panelClassName,
  actions,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  children,
}: ChartCardProps) {
  return (
    <div
      className={`card dashboard-chart-card${wide ? ' dashboard-chart-card--wide' : ''}`}
      style={accent ? ({ ['--chart-accent' as string]: accent } as CSSProperties) : undefined}
    >
      <div className="dashboard-chart-header">
        <h3 className="dashboard-chart-title">{title}</h3>
        {actions ? <div className="dashboard-chart-actions">{actions}</div> : null}
      </div>
      <div className={`dashboard-chart-panel${panelClassName ? ` ${panelClassName}` : ''}`}>
        {isLoading ? (
          <div className="dashboard-chart-skeleton" />
        ) : isError ? (
          <div className="dashboard-error-state">
            <p>Failed to load chart data.</p>
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div
            className="dashboard-chart-content"
            onMouseDown={(event) => {
              const target = event.target
              if (target instanceof Element && target.closest('.recharts-surface')) {
                event.preventDefault()
              }
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

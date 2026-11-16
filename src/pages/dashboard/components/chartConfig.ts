import type { CSSProperties } from 'react'

export const DASHBOARD_TOOLTIP_CONTENT_STYLE: CSSProperties = {
  backgroundColor: 'var(--dash-tooltip-bg)',
  border: '1px solid var(--dash-tooltip-border)',
  borderRadius: 10,
  color: 'var(--dash-tooltip-text)',
  boxShadow: 'var(--dash-tooltip-shadow)',
  padding: '10px 12px',
}

export const DASHBOARD_TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: 'var(--dash-tooltip-text)',
}

export const DASHBOARD_TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: 'var(--dash-tooltip-muted)',
  marginBottom: 4,
  fontWeight: 600,
}

export const DASHBOARD_TOOLTIP_WRAPPER_STYLE: CSSProperties = {
  zIndex: 30,
  outline: 'none',
}

/** Shared Recharts tooltip props for dashboard charts (theme-aware, not clipped). */
export const dashboardTooltipProps = {
  contentStyle: DASHBOARD_TOOLTIP_CONTENT_STYLE,
  itemStyle: DASHBOARD_TOOLTIP_ITEM_STYLE,
  labelStyle: DASHBOARD_TOOLTIP_LABEL_STYLE,
  wrapperStyle: DASHBOARD_TOOLTIP_WRAPPER_STYLE,
}

export const DASHBOARD_COLORS = {
  orders: '#3b82f6',
  revenue: '#10b981',
  members: '#8b5cf6',
  users: '#3b82f6',
  books: '#f59e0b',
  reviews: '#ef4444',
  pending: '#d97706',
  aov: '#0891b2',
  completed: '#059669',
  customers: '#7c3aed',
  cancelled: '#ef4444',
  coupons: '#db2777',
  shipping: '#0284c7',
  subscribers: '#0f766e',
  enquiries: '#ea580c',
} as const

/** Multi-color revenue bars (matches dashboard accent style). */
export const REVENUE_BAR_FILLS = ['#8b5cf6', '#10b981', '#3b82f6'] as const

export const CHART_AXIS_TICK = { fontSize: 11, fill: '#94a3b8' }

/** Show every month, angled so neighbouring labels such as Aug, Sep, and Oct stay readable. */
export const CHART_MONTH_X_AXIS = {
  axisLine: false,
  tickLine: false,
  interval: 0,
  minTickGap: 0,
  angle: -55,
  textAnchor: 'end' as const,
  height: 78,
  tick: { fontSize: 10, fill: '#94a3b8' },
}

/** Yearly charts have fewer points — labels can stay horizontal. */
export const CHART_YEAR_X_AXIS = {
  axisLine: false,
  tickLine: false,
  interval: 0,
  minTickGap: 4,
  tick: { fontSize: 12, fill: '#94a3b8' },
}

/** Positive left margin so Y-axis labels (especially currency) are not clipped. */
export const CHART_MARGIN_MONTH = { top: 12, right: 12, left: 4, bottom: 4 }
export const CHART_MARGIN_YEAR = { top: 12, right: 12, left: 4, bottom: 0 }

export const CHART_Y_AXIS = {
  axisLine: false,
  tickLine: false,
  tick: CHART_AXIS_TICK,
  width: 36,
}

/** Wider axis so compact AED values are not clipped. */
export const CHART_Y_AXIS_CURRENCY = {
  axisLine: false,
  tickLine: false,
  tick: CHART_AXIS_TICK,
  width: 72,
}

export const PIE_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#22c55e',
  '#0ea5e9',
  '#a855f7',
  '#14b8a6',
]

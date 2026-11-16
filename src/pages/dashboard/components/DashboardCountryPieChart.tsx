import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts'
import {
  DASHBOARD_TOOLTIP_CONTENT_STYLE,
  DASHBOARD_TOOLTIP_ITEM_STYLE,
  DASHBOARD_TOOLTIP_LABEL_STYLE,
  PIE_PALETTE,
  dashboardTooltipProps,
} from './chartConfig'

export type CountryPieRow = Record<string, unknown> & {
  label?: string
  country?: string
  count?: number
  amount?: number
}

function getCountryDisplayName(row?: CountryPieRow): string {
  if (!row) return 'Unknown'
  const label = String(row.label ?? '').trim()
  if (label) {
    const withoutCount = label.replace(/\s*\([\d,.]+\)\s*$/, '').trim()
    return withoutCount || label
  }
  const code = String(row.country ?? '').trim()
  if (!code) return 'Unknown'
  if (code.length === 2) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) ?? code
    } catch {
      return code
    }
  }
  return code
}

type PieTooltipPayload = {
  payload?: CountryPieRow
  value?: number
}

function CountryPieTooltip({
  active,
  payload,
  metricLabel,
  formatValue,
}: {
  active?: boolean
  payload?: PieTooltipPayload[]
  metricLabel: string
  formatValue: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const row = entry.payload
  const country = getCountryDisplayName(row)
  const value = Number(entry.value ?? row?.count ?? row?.amount ?? 0)

  return (
    <div className="recharts-default-tooltip" style={DASHBOARD_TOOLTIP_CONTENT_STYLE}>
      <p className="recharts-tooltip-label" style={DASHBOARD_TOOLTIP_LABEL_STYLE}>
        {country}
      </p>
      <p className="recharts-tooltip-item" style={{ ...DASHBOARD_TOOLTIP_ITEM_STYLE, margin: 0 }}>
        <span>{metricLabel}: </span>
        <span style={{ fontWeight: 600 }}>{formatValue(value)}</span>
      </p>
    </div>
  )
}

export interface DashboardCountryPieChartProps {
  data: CountryPieRow[]
  dataKey: 'count' | 'amount'
  nameKey?: string
  /** Metric name shown after country, e.g. Users, Revenue, Members */
  metricLabel?: string
  formatValue?: (value: number) => string
  legendFormatter?: (value: unknown, entry: unknown, index: number) => ReactNode
}

/**
 * Pie + right legend. Recharts v3 `ResponsiveContainer` passes size via context to **built-in**
 * chart roots only — not to custom components — so we measure this wrapper with ResizeObserver.
 */
export function DashboardCountryPieChart({
  data,
  dataKey,
  nameKey = 'label',
  metricLabel = 'Value',
  formatValue = (value) => String(value),
  legendFormatter,
}: DashboardCountryPieChartProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 320, h: 280 })

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return

    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.max(1, Math.floor(r.width))
      const h = Math.max(1, Math.floor(r.height))
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const w = size.w
  const h = size.h

  const padX = 8
  const padY = 10
  const legendReserve = Math.min(170, Math.max(90, Math.round(w * 0.37)))
  const pieAreaW = Math.max(48, w - legendReserve - padX * 2)
  const cx = padX + pieAreaW / 2
  const cy = h / 2
  const outerRadius = Math.max(
    20,
    Math.min(Math.floor(pieAreaW / 2) - 4, Math.floor(h / 2) - padY, 105),
  )

  return (
    <div
      ref={rootRef}
      className="dashboard-country-pie-root"
      style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
    >
      <PieChart width={w} height={h} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx={cx}
          cy={cy}
          outerRadius={outerRadius}
          paddingAngle={0}
          stroke="none"
          isAnimationActive={w > 80}
        >
          {data.map((_, index) => (
            <Cell key={`pie-cell-${index}`} fill={PIE_PALETTE[index % PIE_PALETTE.length]} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          wrapperStyle={dashboardTooltipProps.wrapperStyle}
          cursor={{ fill: 'transparent' }}
          content={({ active, payload }) => (
            <CountryPieTooltip
              active={active}
              payload={payload as unknown as PieTooltipPayload[] | undefined}
              metricLabel={metricLabel}
              formatValue={formatValue}
            />
          )}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          wrapperStyle={{
            fontSize: 12,
            color: '#94a3b8',
            maxWidth: legendReserve - 6,
            paddingLeft: 4,
            wordBreak: 'break-word',
          }}
          {...(legendFormatter
            ? {
                formatter: (value: unknown, entry: unknown, index: number) => legendFormatter(value, entry, index),
              }
            : {})}
        />
      </PieChart>
    </div>
  )
}

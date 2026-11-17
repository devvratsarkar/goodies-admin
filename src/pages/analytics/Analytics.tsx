import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, AlertCircle, Eye, MousePointerClick, Percent, Radio, Users } from 'lucide-react'
import { analyticsApi } from '../../api/endpoints'
import { getApiErrorMessage } from '../../utils/apiError'
import type { AnalyticsReport } from '../../types/api'
import { ChartCard } from '../dashboard/components/ChartCard'
import {
  CHART_MARGIN_MONTH,
  CHART_Y_AXIS,
  DASHBOARD_COLORS,
  dashboardTooltipProps,
} from '../dashboard/components/chartConfig'
import { DashboardCard } from '../dashboard/components/DashboardCard'
import { SectionHeader } from '../dashboard/components/SectionHeader'
import { formatIsoDate, getDateFilterError, todayIso } from '../dashboard/components/dashboardSeries'

const GRID_STYLE = { stroke: 'rgba(148, 163, 184, 0.22)', strokeDasharray: '3 3' }
const EMPTY_REPORT: AnalyticsReport = {
  summary: { activeUsers: 0, sessions: 0, screenPageViews: 0, eventCount: 0, bounceRate: 0 },
  realtime: { activeUsers: 0 },
  timeseries: [],
  channels: [],
  topPages: [],
  countries: [],
}

function daysAgoIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return todayIso(date)
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatRate(value: number) {
  const percent = value > 0 && value <= 1 ? value * 100 : value
  return `${percent.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
}

function formatGaDate(value: string) {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value)
  const iso = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : value
  return formatIsoDate(iso)
}

export function Analytics() {
  const today = todayIso()
  const [fromDate, setFromDate] = useState(() => daysAgoIso(7))
  const [toDate, setToDate] = useState(today)
  const [report, setReport] = useState<AnalyticsReport>(EMPTY_REPORT)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const dateError = getDateFilterError(fromDate, toDate)
  const canQuery = Boolean(fromDate && toDate && !dateError)

  useEffect(() => {
    if (!canQuery) return
    let cancelled = false

    const load = (quiet: boolean) => {
      if (!quiet) {
        setLoading(true)
        setLoadError('')
      }
      analyticsApi
        .getReport({ fromDate, toDate })
        .then((response) => {
          if (cancelled) return
          setReport(response.data.data ?? EMPTY_REPORT)
        })
        .catch((error: unknown) => {
          if (cancelled || quiet) return
          setReport(EMPTY_REPORT)
          setLoadError(getApiErrorMessage(error, 'Could not load analytics.'))
        })
        .finally(() => {
          if (!cancelled && !quiet) setLoading(false)
        })
    }

    load(false)
    const timer = window.setInterval(() => load(true), 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [canQuery, fromDate, toDate])

  const summary = report.summary
  const timeseries = report.timeseries.map((point) => ({
    ...point,
    label: formatGaDate(point.date),
  }))
  const channels = report.channels.filter((row) => row.value > 0)
  const pages = report.topPages.filter((row) => row.value > 0)
  const countries = report.countries.filter((row) => row.value > 0)

  return (
    <div className="dashboard-page">
      <SectionHeader
        title="Analytics"
        subtitle={`${formatIsoDate(fromDate)} – ${formatIsoDate(toDate)}`}
        rightContent={
          <div className="dashboard-filter-bar">
            <div className="dashboard-filter-controls">
              <label className="dashboard-date-field">
                From
                <input
                  type="date"
                  className={`input${dateError?.from ? ' is-invalid' : ''}`}
                  value={fromDate}
                  max={toDate || today}
                  aria-invalid={dateError?.from || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>
              <label className="dashboard-date-field">
                To
                <input
                  type="date"
                  className={`input${dateError?.to ? ' is-invalid' : ''}`}
                  value={toDate}
                  min={fromDate || undefined}
                  max={today}
                  aria-invalid={dateError?.to || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>
            </div>
          </div>
        }
      />

      {dateError ? (
        <p className="dashboard-date-alert" role="alert">
          <AlertCircle size={15} aria-hidden />
          <span>{dateError.message}</span>
        </p>
      ) : null}
      {loadError ? (
        <p className="dashboard-date-alert" role="alert">
          <AlertCircle size={15} aria-hidden />
          <span>{loadError}</span>
        </p>
      ) : null}

      <div className="dashboard-kpi-grid">
        <DashboardCard
          icon={Radio}
          label="Active now"
          value={formatCount(report.realtime?.activeUsers ?? 0)}
          color={DASHBOARD_COLORS.completed}
          hint="Users in the last 30 minutes"
          loading={loading}
        />
        <DashboardCard
          icon={Users}
          label="Active users"
          value={formatCount(summary.activeUsers)}
          color={DASHBOARD_COLORS.users}
          hint="People who visited the store"
          loading={loading}
        />
        <DashboardCard
          icon={MousePointerClick}
          label="Sessions"
          value={formatCount(summary.sessions)}
          color={DASHBOARD_COLORS.members}
          hint="Visits in the selected dates"
          loading={loading}
        />
        <DashboardCard
          icon={Eye}
          label="Page views"
          value={formatCount(summary.screenPageViews)}
          color={DASHBOARD_COLORS.aov}
          hint="Screens viewed"
          loading={loading}
        />
        <DashboardCard
          icon={Activity}
          label="Events"
          value={formatCount(summary.eventCount)}
          color={DASHBOARD_COLORS.books}
          hint="All tracked events"
          loading={loading}
        />
        <DashboardCard
          icon={Percent}
          label="Bounce rate"
          value={formatRate(summary.bounceRate)}
          color={DASHBOARD_COLORS.enquiries}
          hint="Sessions that left quickly"
          loading={loading}
        />
      </div>

      <div className="dashboard-chart-grid dashboard-chart-grid--pair">
        <ChartCard
          title="Users and sessions"
          accent={DASHBOARD_COLORS.users}
          isLoading={loading}
          isEmpty={timeseries.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeseries} margin={CHART_MARGIN_MONTH} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis {...CHART_Y_AXIS} allowDecimals={false} />
              <Tooltip {...dashboardTooltipProps} />
              <Legend />
              <Line type="monotone" dataKey="activeUsers" name="Active users" stroke={DASHBOARD_COLORS.users} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="sessions" name="Sessions" stroke={DASHBOARD_COLORS.members} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Traffic channels" accent={DASHBOARD_COLORS.revenue} isLoading={loading} isEmpty={channels.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channels} margin={CHART_MARGIN_MONTH} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} />
              <YAxis {...CHART_Y_AXIS} allowDecimals={false} />
              <Tooltip {...dashboardTooltipProps} formatter={(value) => [formatCount(Number(value)), 'Sessions']} />
              <Bar dataKey="value" name="Sessions" fill={DASHBOARD_COLORS.revenue} radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="dashboard-chart-grid dashboard-chart-grid--pair">
        <section className="card">
          <div className="dashboard-chart-header">
            <h3 className="dashboard-chart-title">Top pages</h3>
          </div>
          {loading ? (
            <div className="dashboard-chart-skeleton" />
          ) : pages.length === 0 ? (
            <p className="page-subtitle" style={{ padding: '0 16px 16px' }}>No page views in these dates.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Views</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((row) => (
                    <tr key={row.path}>
                      <td>{row.path}</td>
                      <td>{formatCount(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="dashboard-chart-header">
            <h3 className="dashboard-chart-title">Countries</h3>
          </div>
          {loading ? (
            <div className="dashboard-chart-skeleton" />
          ) : countries.length === 0 ? (
            <p className="page-subtitle" style={{ padding: '0 16px 16px' }}>No country data in these dates.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Users</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((row) => (
                    <tr key={row.country}>
                      <td>{row.country}</td>
                      <td>{formatCount(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

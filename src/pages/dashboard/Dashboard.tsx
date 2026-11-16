import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertCircle,
  Ban,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  Inbox,
  Mail,
  ShoppingBag,
  TicketPercent,
  Truck,
  UserPlus,
  WalletCards,
} from 'lucide-react'
import {
  CHART_MARGIN_MONTH,
  CHART_MARGIN_YEAR,
  CHART_MONTH_X_AXIS,
  CHART_Y_AXIS,
  CHART_Y_AXIS_CURRENCY,
  CHART_YEAR_X_AXIS,
  DASHBOARD_COLORS,
  REVENUE_BAR_FILLS,
  dashboardTooltipProps,
} from './components/chartConfig'
import { dashboardApi } from '../../api/endpoints'
import { isoDateParam } from '../../utils/dateQuery'
import type { DashboardData, DashboardMonthPoint } from '../../types/api'
import { ChartCard } from './components/ChartCard'
import { CustomersWorldMap } from './components/CustomersWorldMap'
import { DashboardCard } from './components/DashboardCard'
import { DashboardCountryPieChart } from './components/DashboardCountryPieChart'
import { LeaderboardsPanel } from './components/LeaderboardsPanel'
import { PerformancePanel } from './components/PerformancePanel'
import { ProductsReportPanel } from './components/ProductsReportPanel'
import { RevenueTablePanel } from './components/RevenueTablePanel'
import { SalesSummaryPanel } from './components/SalesSummaryPanel'
import { SectionHeader } from './components/SectionHeader'
import {
  countSeries,
  formatIsoDate,
  getDateFilterError,
  revenueSeries,
  todayIso,
  type MonthRow,
  type TimeMode,
} from './components/dashboardSeries'

const GRID_STYLE = { stroke: 'rgba(148, 163, 184, 0.22)', strokeDasharray: '3 3' }

const toAed = (value?: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(value ?? 0)

const toCompactAed = (value?: number) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0)

const formatCount = (value: number) => value.toLocaleString('en-US')

function hasSeries(list: Array<{ count?: number; amount?: number }>) {
  return list.some((item) => Number(item.count ?? item.amount ?? 0) > 0)
}

function readDashboard(payload: unknown): DashboardData | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as { data?: unknown }
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as DashboardData
  if (!data?.totals || !Array.isArray(data.months)) return null
  return data
}

function toMonthRows(months: DashboardMonthPoint[]): MonthRow[] {
  return months.map((row) => ({
    year: row.year,
    month: row.month,
    orders: Number(row.orders || 0),
    revenue: Number(row.revenue || 0),
    newMembers: Number(row.newMembers || 0),
  }))
}

const EMPTY_TOTALS = {
  orders: 0,
  paid_pending: 0,
  revenue: 0,
  completed: 0,
  customers: 0,
  cancelled: 0,
  coupon_discount: 0,
  shipping: 0,
  subscribers: 0,
  enquiries: 0,
}

function groupParam(value: string | null): TimeMode {
  return value === 'yearly' ? 'yearly' : 'monthly'
}

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const fromDate = isoDateParam(searchParams.get('fromDate'))
  const toDate = isoDateParam(searchParams.get('toDate'))
  const timeMode = groupParam(searchParams.get('group'))
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const today = todayIso()

  const updateFilters = (next: { fromDate?: string; toDate?: string; timeMode?: TimeMode }) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      const from = next.fromDate ?? isoDateParam(current.get('fromDate'))
      const to = next.toDate ?? isoDateParam(current.get('toDate'))
      const mode = next.timeMode ?? groupParam(current.get('group'))
      if (from) params.set('fromDate', from)
      else params.delete('fromDate')
      if (to) params.set('toDate', to)
      else params.delete('toDate')
      if (mode === 'yearly') params.set('group', 'yearly')
      else params.delete('group')
      return params
    }, { replace: true })
  }

  const bothDatesSelected = Boolean(fromDate && toDate)
  const dateError = getDateFilterError(fromDate, toDate)
  const rangeReady = bothDatesSelected && !dateError
  const hasDateFilter = Boolean(fromDate || toDate)
  const monthly = timeMode === 'monthly'
  const canQuery = (!fromDate && !toDate) || rangeReady
  const reportFrom = rangeReady ? fromDate : undefined
  const reportTo = rangeReady ? toDate : undefined

  useEffect(() => {
    if (!canQuery) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    const group = timeMode === 'yearly' ? 'yearly' : 'month'
    dashboardApi
      .getData(rangeReady ? { fromDate, toDate, group } : { group })
      .then((res) => {
        if (cancelled) return
        const parsed = readDashboard(res.data)
        if (!parsed) {
          setLoadError('Failed to load dashboard')
          return
        }
        setDashboard(parsed)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canQuery, rangeReady, fromDate, toDate, timeMode])

  const totals = dashboard?.totals ?? EMPTY_TOTALS
  const rows = useMemo(() => toMonthRows(dashboard?.months ?? []), [dashboard?.months])
  const averageOrderValue = totals.orders > 0 ? Math.round(totals.revenue / totals.orders) : 0

  const ordersData = useMemo(() => countSeries(rows, (row) => row.orders), [rows])
  const revenueBars = useMemo(() => revenueSeries(rows), [rows])
  const memberBars = useMemo(() => countSeries(rows, (row) => row.newMembers), [rows])
  const customerCountries = useMemo(
    () =>
      (dashboard?.customers_by_country ?? []).map((country) => ({
        id: country.code,
        code: country.code,
        name: country.name,
        count: country.count,
      })),
    [dashboard?.customers_by_country],
  )
  const revenuePie = dashboard?.revenue_by_country ?? []
  const memberPie = dashboard?.members_by_country ?? []
  const thisMonth = dashboard?.this_month ?? { label: '', points: [] }

  const rangeLabel = rangeReady ? `${formatIsoDate(fromDate)} – ${formatIsoDate(toDate)}` : 'All dates'
  const periodHint = rangeReady ? 'In the selected dates' : 'All time'
  const toIsBound = Boolean(toDate) && !getDateFilterError('', toDate)
  const fromIsBound = Boolean(fromDate) && !getDateFilterError(fromDate, '')
  const fromMax = toIsBound ? toDate : today
  const toMin = fromIsBound ? fromDate : undefined

  const clearFilters = () => {
    updateFilters({ fromDate: '', toDate: '', timeMode: 'monthly' })
  }
  const listQuery = (path: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        if (value) params.set(key, value)
      })
    }
    if (rangeReady) {
      params.set('fromDate', fromDate)
      params.set('toDate', toDate)
    }
    const query = params.toString()
    return query ? `${path}?${query}` : path
  }
  const chartGrouping = monthly ? 'month' : 'year'
  const groupingHint = monthly ? 'One total for each month' : 'One total for each year'
  const xAxis = monthly ? CHART_MONTH_X_AXIS : CHART_YEAR_X_AXIS
  const chartMargin = monthly ? CHART_MARGIN_MONTH : CHART_MARGIN_YEAR

  return (
    <div className="dashboard-page">
      <SectionHeader
        title="Admin Dashboard"
        subtitle={rangeLabel}
        rightContent={
          <div className="dashboard-filter-bar">
            <div className="dashboard-filter-controls">
            <label className="dashboard-date-field">
              From
              <input
                type="date"
                className={`input${dateError?.from ? ' is-invalid' : ''}`}
                value={fromDate}
                max={fromMax}
                aria-invalid={dateError?.from || undefined}
                onChange={(event) => updateFilters({ fromDate: event.target.value })}
              />
            </label>
            <label className="dashboard-date-field">
              To
              <input
                type="date"
                className={`input${dateError?.to ? ' is-invalid' : ''}`}
                value={toDate}
                min={toMin}
                max={today}
                aria-invalid={dateError?.to || undefined}
                onChange={(event) => updateFilters({ toDate: event.target.value })}
              />
            </label>
            {hasDateFilter || !monthly ? (
              <button type="button" className="btn btn-ghost dashboard-clear-btn" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
            <div className="dashboard-switch" role="group" aria-label="Chart grouping">
              <button
                type="button"
                className={`btn ${monthly ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateFilters({ timeMode: 'monthly' })}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`btn ${timeMode === 'yearly' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => updateFilters({ timeMode: 'yearly' })}
              >
                Yearly
              </button>
            </div>
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
          icon={ShoppingBag}
          label="Orders Placed"
          value={formatCount(totals.orders)}
          color={DASHBOARD_COLORS.orders}
          hint={rangeReady ? 'Created in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/orders')}
        />
        <DashboardCard
          icon={Clock3}
          label="Paid Orders Pending"
          value={formatCount(totals.paid_pending)}
          color={DASHBOARD_COLORS.pending}
          hint="Paid, not yet processing"
          loading={loading}
          to={listQuery('/orders', { status: 'paid_pending' })}
        />
        <DashboardCard
          icon={WalletCards}
          label="Total Revenue"
          value={toAed(totals.revenue)}
          color={DASHBOARD_COLORS.revenue}
          hint="Collected in AED"
          valueTone="success"
          loading={loading}
          to={listQuery('/payment-report')}
        />
        <DashboardCard
          icon={CircleDollarSign}
          label="Avg. Order Value"
          value={toAed(averageOrderValue)}
          color={DASHBOARD_COLORS.aov}
          hint="Revenue per order placed"
          loading={loading}
          to={listQuery('/payment-report')}
        />
        <DashboardCard
          icon={CircleCheck}
          label="Completed Orders"
          value={formatCount(totals.completed)}
          color={DASHBOARD_COLORS.completed}
          hint={rangeReady ? 'Fulfilled in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/orders', { status: 'completed' })}
        />
        <DashboardCard
          icon={UserPlus}
          label="Total Customers"
          value={formatCount(totals.customers)}
          color={DASHBOARD_COLORS.customers}
          hint={rangeReady ? 'Registered in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/customers')}
        />
        <DashboardCard
          icon={Ban}
          label="Cancelled Orders"
          value={formatCount(totals.cancelled)}
          color={DASHBOARD_COLORS.cancelled}
          hint={rangeReady ? 'Cancelled in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/order-cancellations')}
        />
        <DashboardCard
          icon={TicketPercent}
          label="Coupon Discount"
          value={toAed(totals.coupon_discount)}
          color={DASHBOARD_COLORS.coupons}
          hint={rangeReady ? 'Discounts in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/coupons')}
        />
        <DashboardCard
          icon={Truck}
          label="Shipping Collected"
          value={toAed(totals.shipping)}
          color={DASHBOARD_COLORS.shipping}
          hint={rangeReady ? 'Shipping in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/payment-report')}
        />
        <DashboardCard
          icon={Mail}
          label="New Subscribers"
          value={formatCount(totals.subscribers)}
          color={DASHBOARD_COLORS.subscribers}
          hint={rangeReady ? 'Joined in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/subscribers')}
        />
        <DashboardCard
          icon={Inbox}
          label="Contact Enquiries"
          value={formatCount(totals.enquiries)}
          color={DASHBOARD_COLORS.enquiries}
          hint={rangeReady ? 'Received in the selected dates' : periodHint}
          loading={loading}
          to={listQuery('/contact-enquiries')}
        />
      </div>

      <section className="dashboard-analytics" aria-labelledby="dashboard-analytics-title">
        <h2 id="dashboard-analytics-title" className="dashboard-analytics__title">
          Analytics
        </h2>
        <div className="dashboard-analytics__body">
          <PerformancePanel fromDate={reportFrom} toDate={reportTo} paused={!canQuery} />
          <LeaderboardsPanel fromDate={reportFrom} toDate={reportTo} paused={!canQuery} />
          <SalesSummaryPanel fromDate={reportFrom} toDate={reportTo} paused={!canQuery} />
          <RevenueTablePanel fromDate={reportFrom} toDate={reportTo} paused={!canQuery} timeMode={timeMode} />
          <ProductsReportPanel
            key={`${reportFrom ?? ''}:${reportTo ?? ''}`}
            fromDate={reportFrom}
            toDate={reportTo}
            paused={!canQuery}
          />
        </div>
      </section>

      <div className="dashboard-chart-grid dashboard-chart-grid--pair">
        <ChartCard
          title={`Orders by ${chartGrouping}`}
          accent={DASHBOARD_COLORS.orders}
          isLoading={loading}
          isEmpty={!hasSeries(ordersData)}
          actions={<span className="dashboard-chart-hint">{groupingHint}</span>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ordersData} margin={chartMargin} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="period" {...xAxis} />
              <YAxis {...CHART_Y_AXIS} allowDecimals={false} />
              <Tooltip
                {...dashboardTooltipProps}
                cursor={{ stroke: DASHBOARD_COLORS.orders, strokeDasharray: '4 4' }}
                formatter={(value) => [formatCount(Number(value)), 'Orders']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke={DASHBOARD_COLORS.orders}
                strokeWidth={2.5}
                dot={{ r: 3, fill: DASHBOARD_COLORS.orders, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={`Revenue by ${chartGrouping}`}
          accent={DASHBOARD_COLORS.revenue}
          isLoading={loading}
          isEmpty={!hasSeries(revenueBars)}
          actions={<span className="dashboard-chart-hint">{groupingHint}</span>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueBars} margin={chartMargin} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="period" {...xAxis} />
              <YAxis {...CHART_Y_AXIS_CURRENCY} tickFormatter={(value) => toCompactAed(Number(value))} />
              <Tooltip {...dashboardTooltipProps} formatter={(value) => [toAed(Number(value)), 'Revenue']} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {revenueBars.map((bar, index) => (
                  <Cell key={bar.period} fill={REVENUE_BAR_FILLS[index % REVENUE_BAR_FILLS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="dashboard-chart-grid">
        <ChartCard
          title="This Month's Orders"
          accent={DASHBOARD_COLORS.orders}
          wide
          isLoading={loading}
          isEmpty={!hasSeries(thisMonth.points)}
          actions={<span className="dashboard-chart-note">{thisMonth.label}</span>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={thisMonth.points} margin={CHART_MARGIN_MONTH} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis {...CHART_Y_AXIS} allowDecimals={false} />
              <Tooltip {...dashboardTooltipProps} formatter={(value) => [formatCount(Number(value)), 'Orders']} />
              <Bar dataKey="count" fill={DASHBOARD_COLORS.orders} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={monthly ? 'New Members by Month' : 'New Members by Year'}
          accent={DASHBOARD_COLORS.members}
          wide
          isLoading={loading}
          isEmpty={!hasSeries(memberBars)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={memberBars} margin={chartMargin} accessibilityLayer={false}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="period" {...xAxis} />
              <YAxis {...CHART_Y_AXIS} allowDecimals={false} />
              <Tooltip {...dashboardTooltipProps} formatter={(value) => [formatCount(Number(value)), 'Members']} />
              <Bar dataKey="count" fill={DASHBOARD_COLORS.members} radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="dashboard-chart-grid dashboard-chart-grid--pair">
        <ChartCard title="Revenue by Country" accent={DASHBOARD_COLORS.members} isLoading={loading} isEmpty={!hasSeries(revenuePie)}>
          <DashboardCountryPieChart
            data={revenuePie}
            dataKey="amount"
            metricLabel="Revenue"
            formatValue={(value) => toCompactAed(value)}
            legendFormatter={(_, entry) => {
              const payload = (entry as { payload?: { label?: string; amount?: number } }).payload
              return `${payload?.label ?? 'Unknown'} — ${toCompactAed(payload?.amount)}`
            }}
          />
        </ChartCard>

        <ChartCard title="Members by Country" accent={DASHBOARD_COLORS.revenue} isLoading={loading} isEmpty={!hasSeries(memberPie)}>
          <DashboardCountryPieChart data={memberPie} dataKey="count" metricLabel="Members" />
        </ChartCard>
      </div>

      <ChartCard
        title="Customers by Country"
        accent={DASHBOARD_COLORS.orders}
        isLoading={loading}
        panelClassName="dashboard-chart-panel--map"
      >
        <CustomersWorldMap countries={customerCountries} />
      </ChartCard>
    </div>
  )
}

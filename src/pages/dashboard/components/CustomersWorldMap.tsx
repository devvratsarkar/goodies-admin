import { memo, useCallback, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import atlas from 'world-atlas/countries-50m.json'
import { useTheme } from '../../../context/ThemeContext'
import type { CustomersByCountry } from './dashboardSeries'

/** ISO alpha-2 to the numeric id used by the world map. */
const ATLAS_COUNTRY_IDS: Record<string, string> = {
  AF: '004', AL: '008', DZ: '012', AD: '020', AO: '024', AG: '028', AR: '032', AM: '051', AU: '036', AT: '040', AZ: '031',
  BS: '044', BH: '048', BD: '050', BB: '052', BY: '112', BE: '056', BZ: '084', BJ: '204', BT: '064', BO: '068', BA: '070', BW: '072', BR: '076', BN: '096', BG: '100', BF: '854', BI: '108',
  CV: '132', KH: '116', CM: '120', CA: '124', CF: '140', TD: '148', CL: '152', CN: '156', CO: '170', KM: '174', CG: '178', CD: '180', CR: '188', CI: '384', HR: '191', CU: '192', CY: '196', CZ: '203',
  DK: '208', DJ: '262', DM: '212', DO: '214', EC: '218', EG: '818', SV: '222', GQ: '226', ER: '232', EE: '233', SZ: '748', ET: '231',
  FJ: '242', FI: '246', FR: '250', GA: '266', GM: '270', GE: '268', DE: '276', GH: '288', GR: '300', GD: '308', GT: '320', GN: '324', GW: '624', GY: '328',
  HT: '332', HN: '340', HU: '348', IS: '352', IN: '356', ID: '360', IR: '364', IQ: '368', IE: '372', IL: '376', IT: '380',
  JM: '388', JP: '392', JO: '400', KZ: '398', KE: '404', KI: '296', KP: '408', KR: '410', KW: '414', KG: '417',
  LA: '418', LV: '428', LB: '422', LS: '426', LR: '430', LY: '434', LI: '438', LT: '440', LU: '442',
  MG: '450', MW: '454', MY: '458', MV: '462', ML: '466', MT: '470', MH: '584', MR: '478', MU: '480', MX: '484', FM: '583', MD: '498', MC: '492', MN: '496', ME: '499', MA: '504', MZ: '508', MM: '104',
  NA: '516', NR: '520', NP: '524', NL: '528', NZ: '554', NI: '558', NE: '562', NG: '566', MK: '807', NO: '578', OM: '512',
  PK: '586', PW: '585', PA: '591', PG: '598', PY: '600', PE: '604', PH: '608', PL: '616', PT: '620', QA: '634',
  RO: '642', RU: '643', RW: '646', KN: '659', LC: '662', VC: '670', WS: '882', SM: '674', ST: '678', SA: '682', SN: '686', RS: '688', SC: '690', SL: '694', SG: '702', SK: '703', SI: '705', SB: '090', SO: '706', ZA: '710', SS: '728', ES: '724', LK: '144', SD: '729', SR: '740', SE: '752', CH: '756', SY: '760',
  TW: '158', TJ: '762', TZ: '834', TH: '764', TL: '626', TG: '768', TO: '776', TT: '780', TN: '788', TR: '792', TM: '795',
  UG: '800', UA: '804', AE: '784', GB: '826', US: '840', UY: '858', UZ: '860', VU: '548', VA: '336', VE: '862', VN: '704', YE: '887', ZM: '894', ZW: '716',
}

type CountryProps = { name?: string }

const topology = atlas as unknown as Topology<{
  countries: GeometryCollection<CountryProps>
}>

const worldFeatures = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, CountryProps>

const WORLD_GEO: FeatureCollection<Geometry, CountryProps> = {
  type: 'FeatureCollection',
  features: worldFeatures.features.filter((item) => !/antarctic/i.test(item.properties?.name ?? '')),
}

const LIGHT_SCALE = ['#e7eef6', '#d3e4f8', '#9ec8f5', '#4d94ef', '#2563eb', '#1d4ed8'] as const
const DARK_SCALE = ['#243044', '#1b3a63', '#1d4f91', '#2563eb', '#3b82f6', '#7cb3ff'] as const

function colorBucket(count: number, max: number) {
  if (count <= 0 || max <= 0) return 0
  const ratio = count / max
  if (ratio > 0.72) return 5
  if (ratio > 0.45) return 4
  if (ratio > 0.22) return 3
  if (ratio > 0.08) return 2
  return 1
}

type HoverState = {
  name: string
  count: number
  x: number
  y: number
}

type MapShapesProps = {
  byId: Map<string, CustomersByCountry>
  max: number
  scale: readonly string[]
  stroke: string
  onHover: (event: MouseEvent<SVGPathElement>, name: string, count: number) => void
}

const MapShapes = memo(function MapShapes({ byId, max, scale, stroke, onHover }: MapShapesProps) {
  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: 132, center: [8, 22] }}
      width={820}
      height={420}
      aria-label="Customers by country"
    >
      <Geographies geography={WORLD_GEO}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const id = String(geo.id ?? '').padStart(3, '0')
            const known = byId.get(id)
            const name = known?.name ?? String(geo.properties?.name ?? 'Unknown')
            const count = known?.count ?? 0
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={scale[colorBucket(count, max)]}
                stroke={stroke}
                strokeWidth={0.45}
                tabIndex={-1}
                className="dashboard-world-map__country"
                onMouseEnter={(event) => onHover(event, name, count)}
                onMouseMove={(event) => {
                  event.stopPropagation()
                  onHover(event, name, count)
                }}
              />
            )
          })
        }
      </Geographies>
    </ComposableMap>
  )
})

export function CustomersWorldMap({ countries }: { countries: CustomersByCountry[] }) {
  const { theme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)
  const scale = theme === 'dark' ? DARK_SCALE : LIGHT_SCALE
  const stroke = theme === 'dark' ? '#161b22' : '#ffffff'

  const byId = useMemo(() => {
    const map = new Map<string, CustomersByCountry>()
    countries.forEach((country) => {
      const numeric = country.code ? ATLAS_COUNTRY_IDS[country.code.toUpperCase()] : country.id
      if (numeric) map.set(numeric.padStart(3, '0'), country)
      if (country.id) map.set(country.id.padStart(3, '0'), country)
    })
    return map
  }, [countries])
  const max = useMemo(() => countries.reduce((highest, country) => Math.max(highest, country.count), 0), [countries])
  const top = useMemo(
    () =>
      [...countries]
        .filter((country) => country.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [countries],
  )

  const onHover = useCallback((event: MouseEvent<SVGPathElement>, name: string, count: number) => {
    const bounds = rootRef.current?.getBoundingClientRect()
    if (!bounds) return
    const width = 180
    const height = 52
    let x = event.clientX - bounds.left + 14
    let y = event.clientY - bounds.top + 14
    if (x + width > bounds.width) x = event.clientX - bounds.left - width - 8
    if (y + height > bounds.height) y = event.clientY - bounds.top - height - 8
    setHover({ name, count, x: Math.max(8, x), y: Math.max(8, y) })
  }, [])

  return (
    <div
      ref={rootRef}
      className="dashboard-world-map"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const target = event.target as Element
        if (target.tagName.toLowerCase() !== 'path') setHover(null)
      }}
    >
      <MapShapes byId={byId} max={max} scale={scale} stroke={stroke} onHover={onHover} />

      {hover ? (
        <div className="dashboard-map-tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.name}</strong>
          <span>{hover.count.toLocaleString('en-US')} customers</span>
        </div>
      ) : null}

      <div className="dashboard-map-scale" aria-hidden>
        <span>Fewer</span>
        <span className="dashboard-map-scale__bar">
          {scale.map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </span>
        <span>More</span>
      </div>

      {top.length > 0 ? (
        <ul className="dashboard-map-top">
          {top.map((country) => (
            <li key={country.id}>
              <span className="dashboard-map-top__swatch" style={{ background: scale[colorBucket(country.count, max)] }} />
              <span>{country.name}</span>
              <strong>{country.count.toLocaleString('en-US')}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-map-empty-note">No customers in this date range.</p>
      )}
    </div>
  )
}

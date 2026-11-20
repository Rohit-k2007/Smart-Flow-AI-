import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Ambulance, ArrowDown, ArrowUp, BarChart3, Bike, BrainCircuit, Bus, CarFront, Check,
  ChevronLeft, ChevronRight, CircleAlert, Clock3, Download, Pause, Play,
  RefreshCw, RotateCcw, Search, Siren, Square, Truck, X,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingSkeleton, PageHeader } from '../components/common/UI'
import { useTheme } from '../contexts/useTheme'
import { useSimulation } from '../contexts/useSimulation'
import { useLiveTraffic } from '../contexts/useLiveTraffic'
import { useAuth } from '../contexts/useAuth'
import { demoTrafficSample } from '../data/demo-traffic'
import { defaultUserPreferences, loadUserPreferences, saveUserPreferences, type UserPreferences } from '../services/preferences'
import { api } from '../services/api'
import type { ReactNode } from 'react'
import type { DatabaseTableKey, DatabaseTableResponse, TrafficFlowItem } from '../types/api'
import type { ApiResult } from '../types/common'

const LazyChartPanel = lazy(() => import('../components/charts/ChartPanel').then((module) => ({ default: module.ChartPanel })))
const LazyTrafficMapPanel = lazy(() => import('../components/traffic/TrafficMapPanel').then((module) => ({ default: module.TrafficMapPanel })))

const DEMO = 'SYNTHETIC DEMO DATA · illustrative only'
const databaseTables: {
  key: DatabaseTableKey
  label: string
  load: () => Promise<ApiResult<DatabaseTableResponse>>
}[] = [
  { key: 'junctions', label: 'Junctions', load: api.databaseJunctions },
  { key: 'observations', label: 'Traffic observations', load: api.databaseObservations },
  { key: 'signalConfig', label: 'Signal configuration', load: api.databaseSignalConfig },
  { key: 'vehicleTypes', label: 'Vehicle types', load: api.databaseVehicleTypes },
  { key: 'scenarios', label: 'Traffic scenarios', load: api.databaseScenarios },
  { key: 'scenarioApproaches', label: 'Scenario approaches', load: api.databaseScenarioApproaches },
]
const trafficSeries = [
  { time: '08:00', vehicles: 26, wait: 34, speed: 28, queue: 12, actual: 28, predicted: 31, fixedTime: 50, adaptive: 44, response: 95 },
  { time: '08:10', vehicles: 34, wait: 39, speed: 25, queue: 16, actual: 35, predicted: 36, fixedTime: 57, adaptive: 49, response: 88 },
  { time: '08:20', vehicles: 41, wait: 52, speed: 21, queue: 22, actual: 39, predicted: 43, fixedTime: 62, adaptive: 52, response: 103 },
  { time: '08:30', vehicles: 48, wait: 58, speed: 19, queue: 27, actual: 45, predicted: 47, fixedTime: 68, adaptive: 57, response: 91 },
  { time: '08:40', vehicles: 43, wait: 49, speed: 23, queue: 21, actual: 42, predicted: 40, fixedTime: 61, adaptive: 53, response: 84 },
  { time: '08:50', vehicles: 36, wait: 42, speed: 26, queue: 17, actual: 37, predicted: 35, fixedTime: 56, adaptive: 47, response: 98 },
]
const approaches = [
  { name: 'North', vehicles: 18, queue: 8, wait: 42, demand: 'High', green: 38 },
  { name: 'East', vehicles: 12, queue: 5, wait: 28, demand: 'Medium', green: 27 },
  { name: 'South', vehicles: 9, queue: 3, wait: 19, demand: 'Low', green: 20 },
  { name: 'West', vehicles: 14, queue: 6, wait: 34, demand: 'Medium', green: 30 },
]
const initialEmergencies = [
  { id: 'EV-1042', type: 'Ambulance', intersection: 'Central & 4th (demo)', direction: 'Northbound', status: 'Priority Requested', time: '10:42:18' },
  { id: 'EV-1038', type: 'Fire engine', intersection: 'Harbor & Pine (demo)', direction: 'Eastbound', status: 'Detected', time: '10:36:51' },
  { id: 'EV-1029', type: 'Ambulance', intersection: 'Market & 2nd (demo)', direction: 'Westbound', status: 'Completed', time: '10:14:03' },
]
const historyRows = [
  { id: 'RUN-24018', name: 'Morning corridor test', scenario: 'Heavy Traffic', controller: 'Adaptive', start: '2026-11-18 08:00', end: '2026-11-18 08:24', status: 'Completed' },
  { id: 'RUN-24017', name: 'Emergency route demo', scenario: 'Emergency Traffic', controller: 'Fixed-Time', start: '2026-11-17 14:10', end: '2026-11-17 14:28', status: 'Completed' },
  { id: 'RUN-24016', name: 'Baseline comparison', scenario: 'Normal Traffic', controller: 'Adaptive', start: '2026-11-16 09:30', end: '2026-11-16 09:55', status: 'Stopped' },
  { id: 'RUN-24015', name: 'Evening demand test', scenario: 'Heavy Traffic', controller: 'Fixed-Time', start: '2026-11-15 17:00', end: '2026-11-15 17:20', status: 'Completed' },
  { id: 'RUN-24014', name: 'North approach sample', scenario: 'Normal Traffic', controller: 'Adaptive', start: '2026-11-14 11:00', end: '2026-11-14 11:15', status: 'Completed' },
  { id: 'RUN-24013', name: 'Queue comparison', scenario: 'Heavy Traffic', controller: 'Fixed-Time', start: '2026-11-13 16:40', end: '2026-11-13 17:02', status: 'Completed' },
]
const intersectionPoints = [
  { name: 'Central & 4th (demo)', position: [40.7128, -74.006] as [number, number], congestion: 'high' },
  { name: 'Harbor & Pine (demo)', position: [40.7162, -74.001] as [number, number], congestion: 'medium' },
  { name: 'Market & 2nd (demo)', position: [40.7096, -74.011] as [number, number], congestion: 'low' },
  { name: 'Broadway & Lake (demo)', position: [40.719, -74.012] as [number, number], congestion: 'high' },
]

function DemoLabel() { return <span className="demo-label">{DEMO}</span> }
function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return <Card className={`data-panel ${className}`}>{title && <div className="panel-title">{title}</div>}{children}</Card>
}
function Metric({ label, value, unit, trend, icon }: { label: string; value: string; unit?: string; trend?: string; icon: ReactNode }) {
  return <Card className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}<small>{unit}</small></strong>{trend && <span className="metric-trend"><ArrowDown size={13} />{trend}</span>}</Card>
}
function ChartPanel({ title, type = 'line', data = trafficSeries, color = '#29b8db', dataKey = 'vehicles', secondKey }: {
  title: string; type?: 'line' | 'bar' | 'area'; data?: typeof trafficSeries; color?: string; dataKey?: string; secondKey?: string
}) {
  return <Suspense fallback={<Panel title={title}><div className="chart-area skeleton" /></Panel>}>
    <LazyChartPanel title={title} type={type} data={data} color={color} dataKey={dataKey} secondKey={secondKey} />
  </Suspense>
}
function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
}
function StatusBadge({ children }: { children: string }) {
  const tone = /completed|granted|low/i.test(children) ? 'success' : /requested|detected|running|medium/i.test(children) ? 'warning' : /failed|high|critical/i.test(children) ? 'danger' : 'neutral'
  return <Badge tone={tone}>{children}</Badge>
}

function SupabaseTablesPanel() {
  const [results, setResults] = useState<Partial<Record<DatabaseTableKey, ApiResult<DatabaseTableResponse>>>>({})
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    const entries = await Promise.all(databaseTables.map(async (table) => [table.key, await table.load()] as const))
    return Object.fromEntries(entries)
  }, [])

  useEffect(() => {
    let active = true
    void fetchResults().then((nextResults) => {
      if (active) {
        setResults(nextResults)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [fetchResults])

  const refresh = async () => {
    setLoading(true)
    setResults(await fetchResults())
    setLoading(false)
  }

  return <Panel title="Supabase database records · read-only">
    <p className="mini-callout">
      RLS-enforced public reads. These stored records are kept separate from HERE LIVE DATA and simulation output.
      The workbook preview remains SYNTHETIC DEMO DATA; database row provenance is not inferred.
      {' '}<Button variant="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} />Refresh database</Button>
    </p>
    {loading && <LoadingSkeleton lines={3} />}
    {!loading && <div className="dashboard-grid">
      {databaseTables.map((table) => {
        const result = results[table.key]
        return <Panel title={table.label} key={table.key}>
          {!result
            ? <EmptyState title="No response" description="No database response was received." />
            : !result.ok
              ? <ErrorState message={result.error.message} />
              : <>
                <p className="mini-callout">SUPABASE · ANON/RLS READ · {result.data.row_count} rows retrieved</p>
                {!result.data.items.length
                  ? <EmptyState title="No visible records" description="The read succeeded, but RLS returned no rows." />
                  : <div className="table-scroll">
                    {result.data.items.slice(0, 5).map((row, index) => (
                      <details key={`${table.key}-${index}`}>
                        <summary>Record {index + 1}</summary>
                        <pre className="database-record">{JSON.stringify(row, null, 2)}</pre>
                      </details>
                    ))}
                    {result.data.row_count > 5 && <small>Showing 5 of {result.data.row_count} returned rows.</small>}
                  </div>}
              </>}
        </Panel>
      })}
    </div>}
  </Panel>
}

export function DashboardPage() {
  const { data, intersections, loading, error, intersectionError, refresh } = useLiveTraffic()
  const speedValues = data?.flow_items
    .map((item) => item.speed_kph)
    .filter((speed): speed is number => speed !== null) ?? []
  const jamValues = data?.flow_items
    .map((item) => item.jam_factor)
    .filter((jam): jam is number => jam !== null) ?? []
  const average = (values: number[]) => values.length
    ? (values.reduce((total, value) => total + value, 0) / values.length).toFixed(1)
    : '—'
  const jamFactor = jamValues.length ? Number(average(jamValues)) : null
  const jamLabel = jamFactor === null ? 'Not supplied' : jamFactor >= 7 ? 'High' : jamFactor >= 4 ? 'Moderate' : 'Low'
  const items = data?.flow_items ?? []
  const speedSummary = average(speedValues)
  const sampleVehicleCount = demoTrafficSample.approaches.reduce((total, item) => total + item.vehicleCount, 0)

  return <>
    <PageHeader
      title="Traffic command center"
      description="Current HERE flow and incident information for the configured Jaipur pilot area."
      action={<Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} />Refresh live data</Button>}
    />
    {loading && <Panel title="Loading current Jaipur traffic"><LoadingSkeleton lines={2} /></Panel>}
    {error && <ErrorState message={error} />}
    {data?.is_stale && <div className="mini-callout" role="status">HERE data is stale: the latest provider timestamp is more than 15 minutes old.</div>}
    {data && <div className="mini-callout" role="status">
      HERE provider: {data.status} · {data.city} · Last provider update: {data.last_updated_at ? new Date(data.last_updated_at).toLocaleString() : 'not supplied'}
      {data.persistence_status !== 'PERSISTED' && ` · ${data.persistence_reason ?? 'Provider values are not persisted.'}`}
    </div>}
    {(!data || !data.available) && !loading && <Panel title="Demo sheet preview · not live">
      <p className="mini-callout">{demoTrafficSample.status} Source: {demoTrafficSample.source}. Snapshot: {demoTrafficSample.timestamp}. It is shown only because live provider data is unavailable.</p>
      <div className="metric-grid compact">
        <Metric label="Sample vehicles (all four approaches)" value={String(sampleVehicleCount)} icon={<CarFront size={18} />} />
        <Metric label="Sample average wait" value="18" unit=" sec" icon={<Clock3 size={18} />} />
        <Metric label="Live average speed" value="—" icon={<Activity size={18} />} />
        <Metric label="Live incidents" value="—" icon={<CircleAlert size={18} />} />
      </div>
    </Panel>}
    <div className="metric-grid">
      <Metric label="HERE road segments" value={data ? String(data.flow_items.length) : '—'} icon={<Activity size={18} />} />
      <Metric label="Average segment speed" value={data && speedValues.length ? speedSummary : '—'} unit={speedValues.length ? ' km/h' : ''} icon={<Activity size={18} />} />
      <Metric label="Average HERE jam factor" value={jamFactor === null ? '—' : `${jamFactor.toFixed(1)} / 10`} icon={<CircleAlert size={18} />} />
      <Metric label="Current incidents" value={data?.incidents_available ? String(data.incidents.length) : '—'} icon={<Siren size={18} />} />
      <Metric label="Verified intersections" value={String(intersections.length)} icon={<Activity size={18} />} />
    </div>
    <div className="dashboard-grid">
      <Panel title="Provider connection">
        <div className="readout-grid"><span>HERE provider</span><strong>{data?.status ?? (error ? 'Unavailable' : 'Loading')}</strong><span>Flow segments</span><strong>{data?.flow_available ? items.length : 'Unavailable'}</strong><span>Incidents</span><strong>{data?.incidents_available ? data.incidents.length : 'Unavailable'}</strong><span>Average congestion</span><strong>{jamLabel}</strong></div>
        {data?.reason && <p className="mini-callout">{data.reason}</p>}
      </Panel>
      <Panel title="Verified intersections">
        {intersectionError && <ErrorState message={intersectionError} />}
        {intersections.length
          ? <DataTable headers={['Name', 'Latitude', 'Longitude']} rows={intersections.map((intersection) => [intersection.name, intersection.latitude, intersection.longitude])} />
          : <EmptyState title="No verified intersections" description="The Jaipur intersection catalog is empty. Add confirmed locations through the controlled database workflow; HERE road segments are not mislabeled as intersections." />}
      </Panel>
      <Panel title="Current HERE incidents">
        {data?.incidents.length
          ? <div className="event-list">{data.incidents.map((incident, index) => <div className="event-item" key={incident.id ?? `incident-${index}`}><Siren size={17} /><div><strong>{incident.summary ?? incident.incident_type ?? 'Traffic incident'}</strong><small>{incident.criticality ?? 'Severity not supplied'} · {incident.road_segment_reference ?? 'Road reference not supplied'}</small></div><span>{incident.provider_timestamp ? new Date(incident.provider_timestamp).toLocaleTimeString() : 'Time unavailable'}</span></div>)}</div>
          : <EmptyState title={data?.incidents_available ? 'No current incidents reported' : 'Incident data unavailable'} description={data?.incidents_available ? 'HERE returned no incidents for the configured Jaipur area.' : 'No incident values are displayed unless HERE supplies them.'} />}
      </Panel>
      <Panel title="Sample approach readings · synthetic workbook">
        <p className="mini-callout">SYNTHETIC DEMO DATA from the attached workbook; not live observations. Timestamp: {demoTrafficSample.timestamp}.</p>
        <DataTable headers={['Approach', 'Sample vehicles', 'Signal state', 'Sample wait']} rows={demoTrafficSample.approaches.map((item) => [item.approach, item.vehicleCount, item.signalState, `${item.averageWait} sec`])} />
        <DemoLabel />
      </Panel>
    </div>
    <SupabaseTablesPanel />
    <Suspense fallback={<Panel title="HERE road geometry"><LoadingSkeleton lines={2} /></Panel>}>
      <LazyTrafficMapPanel items={items} />
    </Suspense>
  </>
}

function IntersectionVisual({ phase, emergency, scenario = 'Normal Traffic' }: { phase: number; emergency: boolean; scenario?: string }) {
  const verticalGreen = phase % 2 === 0
  const counts = scenario === 'Heavy Traffic' ? [36, 18, 24, 28] : scenario === 'Emergency Traffic' ? [24, 12, 16, 18] : [18, 9, 12, 14]
  return <div className={`intersection-visual ${emergency ? 'emergency-mode' : ''}`}>
    <div className="intersection-road horizontal"><div className="lane-mark" /></div><div className="intersection-road vertical"><div className="lane-mark" /></div>
    <div className="center-island"><div className="intersection-signal"><i className={!verticalGreen ? 'go' : ''} /><i className={phase === 1 ? 'caution' : ''} /><i className={verticalGreen ? 'go' : ''} /></div><span>DEMO JUNCTION</span></div>
    {(['north', 'south', 'east', 'west'] as const).map((direction, i) => <div className={`vehicle-lane ${direction}`} key={direction}>
      <div className="lane-label">{direction.toUpperCase()} <b>{counts[i]}</b></div>
      <div className="vehicles">{Array.from({ length: i === 0 ? 4 : i === 1 ? 2 : 3 }, (_, n) => {
        const vehicle = emergency && i === 0 && n === 2 ? 'Ambulance' : emergency && i === 0 && n === 3 ? 'Fire engine' : ['Bus', 'Motorcycle', 'Truck', 'Car'][n]
        const VehicleIcon = vehicle === 'Ambulance' ? Ambulance : vehicle === 'Fire engine' ? Siren : vehicle === 'Bus' ? Bus : vehicle === 'Motorcycle' ? Bike : vehicle === 'Truck' ? Truck : CarFront
        return <span className={`demo-vehicle vehicle-${(n + i) % 4}`} key={n} title={vehicle}><VehicleIcon size={17} /></span>
      })}</div>
    </div>)}
    <div className={`direction-signal north-signal ${verticalGreen ? 'signal-green' : 'signal-red'}`} /><div className={`direction-signal east-signal ${verticalGreen ? 'signal-red' : 'signal-green'}`} />
    <div className="signal-legend"><span><i className="green-dot" /> Green phase</span><span><i className="red-dot" /> Stopped</span></div>
  </div>
}

export function SimulationPage() {
  const { status, setStatus } = useSimulation()
  const [scenario, setScenario] = useState('Normal Traffic')
  const [controller, setController] = useState('Adaptive AI')
  const [phase, setPhase] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [emergency, setEmergency] = useState(false)
  useEffect(() => {
    if (status !== 'Running') return
    const timer = window.setInterval(() => {
      setSeconds((value) => value + 1)
      setPhase((value) => (value + 1) % 2)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [status])
  const start = () => setStatus('Running')
  const totalVehicles = scenario === 'Heavy Traffic' ? 106 : scenario === 'Emergency Traffic' ? 70 : 53
  const emergencyActive = emergency || scenario === 'Emergency Traffic'
  return <>
    <PageHeader title="Live traffic simulation" description="Interactive frontend-only intersection demonstration." action={<DemoLabel />} />
    <div className="simulation-layout">
      <Panel title="Four-way intersection visualization"><IntersectionVisual phase={phase} emergency={emergencyActive} scenario={scenario} /><div className="simulation-note"><CircleAlert size={16} /> Frontend demonstration only. Controls do not run SUMO or a backend simulation.</div><DemoLabel /></Panel>
      <div className="simulation-aside">
        <Panel title="Simulation controls">
          <label className="field-label">Traffic scenario<select value={scenario} onChange={(e) => setScenario(e.target.value)}><option>Normal Traffic</option><option>Heavy Traffic</option><option>Emergency Traffic</option></select></label>
          <label className="field-label">Signal controller<select value={controller} onChange={(e) => setController(e.target.value)}><option>Fixed-Time</option><option>Adaptive AI</option></select></label>
          <div className="control-buttons"><Button onClick={start} disabled={status === 'Running'}><Play size={15} />Start</Button><Button variant="secondary" onClick={() => setStatus('Paused')} disabled={status !== 'Running'}><Pause size={15} />Pause</Button><Button variant="secondary" onClick={() => setStatus('Running')} disabled={status !== 'Paused'}><Play size={15} />Resume</Button><Button variant="secondary" onClick={() => setStatus('Stopped')}><Square size={14} />Stop</Button><Button variant="ghost" onClick={() => { setStatus('Idle'); setSeconds(0); setPhase(0); setEmergency(false) }}><RotateCcw size={14} />Reset</Button></div>
          <div className="simulation-readout"><span>Status</span><strong><StatusBadge>{status}</StatusBadge></strong><span>Elapsed demo time</span><strong>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong><span>Signal phase</span><strong>{phase % 2 === 0 ? 'North / South green' : 'East / West green'}</strong><span>Selected controller</span><strong>{controller}</strong></div>
          <Button variant="secondary" className="full-button" onClick={() => { if (emergencyActive) { setEmergency(false); setScenario('Normal Traffic') } else { setEmergency(true); setScenario('Emergency Traffic') } }}><Siren size={15} />{emergencyActive ? 'Clear demo emergency' : 'Trigger demo emergency'}</Button>
        </Panel>
        <Panel title="Sample traffic snapshot"><div className="readout-grid"><span>Total vehicles</span><strong>{totalVehicles}</strong><span>Average speed</span><strong>{scenario === 'Heavy Traffic' ? 18 : scenario === 'Emergency Traffic' ? 22 : 26} km/h</strong><span>Waiting time</span><strong>{scenario === 'Heavy Traffic' ? 54 : scenario === 'Emergency Traffic' ? 40 : 31} sec</strong><span>Queue length</span><strong>{scenario === 'Heavy Traffic' ? 43 : scenario === 'Emergency Traffic' ? 30 : 22} vehicles</strong></div><DemoLabel /></Panel>
      </div>
    </div>
  </>
}

export function AIControlPage() {
  const [mode, setMode] = useState<'Fixed-Time' | 'Adaptive'>('Adaptive')
  const [selected, setSelected] = useState('North')
  const current = approaches.find((a) => a.name === selected) ?? approaches[0]
  return <>
    <PageHeader title="AI control center" description="Compare controller modes and inspect an illustrative decision explanation." action={<DemoLabel />} />
    <div className="filters-row"><div className="segmented-control">{(['Fixed-Time', 'Adaptive'] as const).map((item) => <button className={mode === item ? 'selected' : ''} key={item} onClick={() => setMode(item)}>{item === 'Adaptive' ? 'Adaptive mode' : item}</button>)}</div><Badge tone="warning">{mode} · demo selection</Badge></div>
    <div className="metric-grid compact"><Metric label="Current mode" value={mode} icon={<Activity size={18} />} /><Metric label="Priority approach" value={current.name} icon={<ArrowUp size={18} />} /><Metric label="Recommended green" value={`${current.green} sec`} icon={<Clock3 size={18} />} /><Metric label="Demand estimate" value={current.demand} icon={<BarChart3 size={18} />} /></div>
    <div className="dashboard-grid">
      <Panel title="Signal phase visualization"><IntersectionVisual phase={selected === 'North' || selected === 'South' ? 0 : 1} emergency={false} /></Panel>
      <Panel title="Approach demand and queue"><div className="table-scroll"><table className="data-table"><thead><tr><th>Approach</th><th>Queue</th><th>Wait</th><th>Demand</th><th>Inspect</th></tr></thead><tbody>{approaches.map((a) => <tr key={a.name}><td>{a.name}</td><td>{a.queue}</td><td>{a.wait}s</td><td>{a.demand}</td><td><Button variant="ghost" onClick={() => setSelected(a.name)}>Select</Button></td></tr>)}</tbody></table></div><DemoLabel /></Panel>
      <Panel title="Decision explanation"><div className="decision-callout"><BrainCircuit size={22} /><div><strong>Illustrative decision rationale</strong><p>The {current.name.toLowerCase()} approach received priority because its normalized queue and waiting-time score was highest in this sample.</p><small>This is a labelled demonstration explanation, not a decision from a trained AI model.</small></div></div></Panel>
      <ChartPanel title="Queue length by approach" type="bar" data={approaches.map((a) => ({ time: a.name, queue: a.queue, vehicles: a.vehicles, wait: a.wait, speed: 0, actual: 0, predicted: 0, fixedTime: 0, adaptive: 0, response: 0 }))} dataKey="queue" color="#f1b84b" />
      <Panel title="Decision history"><div className="event-list">{approaches.map((a, i) => <div className="event-item" key={a.name}><Check size={16} /><div><strong>{['Priority score evaluated', 'Signal phase recommended', 'Demand snapshot updated', 'Approach queue sampled'][i]}</strong><small>{a.name} · illustrative sample event</small></div><span>10:{42 - i * 3}:00</span></div>)}</div><DemoLabel /></Panel>
    </div>
  </>
}

export function EmergencyPage() {
  const [events, setEvents] = useState(initialEmergencies)
  const [modal, setModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<(typeof initialEmergencies)[number] | null>(null)
  const [type, setType] = useState('Ambulance')
  const addEvent = () => {
    setEvents((prev) => [{ id: `EV-${1043 + prev.length}`, type, intersection: 'Central & 4th (demo)', direction: 'Northbound', status: 'Detected', time: new Date().toLocaleTimeString() }, ...prev])
    setModal(false)
  }
  const cycleStatus = (id: string) => {
    const statuses = ['Detected', 'Priority Requested', 'Priority Granted', 'Vehicle Passed', 'Completed', 'Failed']
    setEvents((prev) => prev.map((event) => {
      if (event.id !== id) return event
      return { ...event, status: statuses[(statuses.indexOf(event.status) + 1) % statuses.length] }
    }))
  }
  return <>
    <PageHeader title="Emergency management" description="Review sample events; actual detection and signal priority require backend integration." action={<Button onClick={() => setModal(true)}><Siren size={16} />Add demo event</Button>} />
    <DemoLabel /><div className="metric-grid compact"><Metric label="Open demo events" value={String(events.filter((e) => !/completed/i.test(e.status)).length)} icon={<CircleAlert size={18} />} /><Metric label="Priority requested" value={String(events.filter((e) => /requested/i.test(e.status)).length)} icon={<ArrowUp size={18} />} /><Metric label="Ambulances" value={String(events.filter((e) => e.type === 'Ambulance').length)} icon={<Ambulance size={18} />} /><Metric label="Fire engines" value={String(events.filter((e) => e.type === 'Fire engine').length)} icon={<Truck size={18} />} /></div>
    <Panel title="Emergency vehicle events"><DataTable headers={['Vehicle ID', 'Type', 'Current intersection', 'Direction', 'Priority status', 'Detection time', 'Action']} rows={events.map((event) => [event.id, event.type, event.intersection, event.direction, <StatusBadge key={`status-${event.id}`}>{event.status}</StatusBadge>, event.time, <div key={`actions-${event.id}`} className="event-actions"><Button variant="ghost" onClick={() => setSelectedEvent(event)}>Details</Button><Button variant="secondary" onClick={() => cycleStatus(event.id)}>Advance status</Button></div>])} /></Panel>
    <div className="safety-notice"><ShieldIcon />Signal changes must follow safe transition intervals. This demo never bypasses safe signal transitions.</div>
    {modal && <Modal title="Create sample emergency event" onClose={() => setModal(false)}><label className="field-label">Vehicle type<select value={type} onChange={(e) => setType(e.target.value)}><option>Ambulance</option><option>Fire engine</option></select></label><p className="modal-hint">This adds a local demonstration record only.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={addEvent}>Add demo event</Button></div></Modal>}
    {selectedEvent && <Modal title={`Emergency event ${selectedEvent.id}`} onClose={() => setSelectedEvent(null)}><div className="readout-grid"><span>Vehicle type</span><strong>{selectedEvent.type}</strong><span>Intersection</span><strong>{selectedEvent.intersection}</strong><span>Direction</span><strong>{selectedEvent.direction}</strong><span>Priority status</span><strong>{selectedEvent.status}</strong><span>Detection time</span><strong>{selectedEvent.time}</strong></div><p className="modal-hint">Sample event details only. Real detection and priority require backend integration.</p></Modal>}
  </>
}
function ShieldIcon() { return <CircleAlert size={18} /> }
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>{children}</section></div>
}

export function HeatmapPage() {
  const { data, loading, error, refresh } = useLiveTraffic()
  return <>
    <PageHeader title="Traffic congestion heatmap" description="Road geometry and jam factors from the live HERE Traffic API for Jaipur." action={<Button variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} />Refresh live data</Button>} />
    {loading && <Panel title="Loading HERE flow"><LoadingSkeleton lines={2} /></Panel>}
    {error && <ErrorState message={error} />}
    {data?.is_stale && <div className="mini-callout" role="status">The latest HERE source timestamp is more than 15 minutes old.</div>}
    <div className="map-layout">
      <Suspense fallback={<Panel title="HERE road geometry"><LoadingSkeleton lines={2} /></Panel>}>
        <LazyTrafficMapPanel items={data?.flow_items ?? []} />
      </Suspense>
      <Panel title="Current HERE road segments">
        {data?.flow_items.length
          ? <DataTable headers={['Road reference', 'Speed km/h', 'Free-flow km/h', 'Jam factor', 'Updated']} rows={data.flow_items.map((item: TrafficFlowItem) => [item.road_segment_reference ?? 'Not supplied', item.speed_kph ?? 'Not supplied', item.free_flow_speed_kph ?? 'Not supplied', item.jam_factor ?? 'Not supplied', item.provider_timestamp ?? 'Not supplied'])} />
          : <EmptyState title={data?.flow_available ? 'No flow segments returned' : 'Live flow unavailable'} description={data?.flow_available ? 'HERE returned an empty flow response for this area.' : 'Road speeds and congestion are not shown without provider data.'} />}
        {data?.last_updated_at && <p className="mini-callout">Latest provider update: {new Date(data.last_updated_at).toLocaleString()}</p>}
      </Panel>
    </div>
  </>
}

export function PredictionPage() {
  const [horizon, setHorizon] = useState('30')
  const [intersection, setIntersection] = useState('Central & 4th (demo)')
  const offset = Number(horizon) / 30
  const chartData = trafficSeries.map((point, i) => ({ ...point, predicted: Math.round(point.predicted * offset + (i % 2) * 2) }))
  return <>
    <PageHeader title="Traffic prediction" description="Illustrative forecast values; no trained model or real prediction service is connected." action={<DemoLabel />} />
    <div className="filters-row"><label className="filter-field">Prediction horizon<select value={horizon} onChange={(e) => setHorizon(e.target.value)}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label><label className="filter-field">Intersection<select value={intersection} onChange={(e) => setIntersection(e.target.value)}>{intersectionPoints.map((p) => <option key={p.name}>{p.name}</option>)}</select></label></div>
    <div className="metric-grid compact"><Metric label="Predicted vehicles" value={`${Math.round(47 * offset)}`} unit=" vehicles" icon={<CarFront size={18} />} /><Metric label="Congestion estimate" value="Moderate" icon={<Activity size={18} />} /><Metric label="Forecast horizon" value={`${horizon} min`} icon={<Clock3 size={18} />} /><Metric label="Selected intersection" value={intersection.split(' (')[0]} icon={<Activity size={18} />} /></div>
    <div className="dashboard-grid"><ChartPanel title="Actual vs predicted vehicle count" data={chartData} dataKey="actual" secondKey="predicted" /><ChartPanel title="Historical traffic trend" type="area" dataKey="vehicles" color="#b481ed" /><Panel title="Prediction model"><div className="readout-grid"><span>Model name</span><strong>Demo forecast baseline</strong><span>Model version</span><strong>Not connected</strong><span>Last sample timestamp</span><strong>Demonstration only</strong><span>Model accuracy</span><strong>Not available</strong></div><p className="mini-callout">No trained model is represented by this placeholder data.</p></Panel></div>
  </>
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function AnalyticsPage() {
  const [controller, setController] = useState('All controllers')
  const [scenario, setScenario] = useState('All scenarios')
  const [range, setRange] = useState('Last 7 days')
  const [intersection, setIntersection] = useState('All intersections')
  const sampleLength = range === 'Last 24 hours' ? 3 : range === 'Last 7 days' ? 5 : 6
  const intersectionIndex = intersectionPoints.findIndex((point) => point.name === intersection)
  const volumeFactor = intersectionIndex < 0 ? 1 : [1, .8, .65, .9][intersectionIndex]
  const reportRows = trafficSeries
    .filter((_, i) => controller === 'All controllers' || (controller === 'Adaptive' ? i % 2 === 0 : i % 2 === 1))
    .slice(-sampleLength)
    .map((r) => ({
      ...r,
      vehicles: Math.round((scenario === 'Heavy Traffic' ? r.vehicles * 1.25 : scenario === 'Normal Traffic' ? r.vehicles * .8 : r.vehicles) * volumeFactor),
      wait: Math.round(r.wait * volumeFactor),
      speed: Math.round(r.speed / volumeFactor),
      queue: Math.round(r.queue * volumeFactor),
    }))
  const average = (key: 'wait' | 'speed' | 'queue') =>
    Math.round(reportRows.reduce((total, point) => total + point[key], 0) / reportRows.length)
  return <>
    <PageHeader title="Analytics & reports" description="Analyze sample traffic metrics and export the displayed frontend dataset." action={<Button onClick={() => downloadCsv('smartflow-demo-analytics.csv', [['time', 'vehicle_count', 'waiting_time_sec', 'speed_kmh', 'queue_length'], ...reportRows.map((r) => [r.time, String(r.vehicles), String(r.wait), String(r.speed), String(r.queue)])])}><Download size={16} />Export CSV</Button>} />
    <div className="filters-row"><label className="filter-field">Date range<select value={range} onChange={(e) => setRange(e.target.value)}><option>Last 24 hours</option><option>Last 7 days</option><option>Last 30 days</option></select></label><label className="filter-field">Scenario<select value={scenario} onChange={(e) => setScenario(e.target.value)}><option>All scenarios</option><option>Normal Traffic</option><option>Heavy Traffic</option></select></label><label className="filter-field">Controller<select value={controller} onChange={(e) => setController(e.target.value)}><option>All controllers</option><option>Adaptive</option><option>Fixed-Time</option></select></label><label className="filter-field">Intersection<select value={intersection} onChange={(e) => setIntersection(e.target.value)}><option>All intersections</option>{intersectionPoints.map((p) => <option key={p.name}>{p.name}</option>)}</select></label></div>
    <div className="metric-grid compact"><Metric label="Vehicles in sample" value={String(reportRows.reduce((n, r) => n + r.vehicles, 0))} icon={<CarFront size={18} />} /><Metric label="Mean waiting time" value={`${average('wait')} sec`} icon={<Clock3 size={18} />} /><Metric label="Mean speed" value={`${average('speed')} km/h`} icon={<Activity size={18} />} /><Metric label="Mean queue" value={String(average('queue'))} icon={<BarChart3 size={18} />} /></div>
    <div className="dashboard-grid"><ChartPanel title="Vehicle count trend" data={reportRows} /><ChartPanel title="Average waiting time" data={reportRows} dataKey="wait" color="#b481ed" /><ChartPanel title="Average speed" data={reportRows} type="area" dataKey="speed" color="#48c78e" /><ChartPanel title="Queue length" data={reportRows} type="bar" dataKey="queue" color="#f1b84b" /><ChartPanel title="Congestion trend (illustrative)" data={reportRows} type="area" dataKey="queue" color="#ef6a76" />    <ChartPanel title="Fixed-Time vs Adaptive sample comparison" data={reportRows} dataKey="fixedTime" secondKey="adaptive" /><ChartPanel title="Emergency response performance (sample seconds)" data={reportRows} type="bar" dataKey="response" color="#f1b84b" /><Panel title="Performance comparison"><DataTable headers={['Measure', 'Fixed-Time sample', 'Adaptive sample', 'Note']} rows={ [['Average wait', '52 sec', '46 sec', 'Illustrative'], ['Average speed', '22 km/h', '24 km/h', 'Illustrative'], ['Emergency response', 'Sample chart only', 'Sample chart only', 'Not measured live']] } /></Panel><Panel title="Report preview"><p className="report-preview">Traffic overview report · {scenario} · {controller}<br /><small>Preview is generated from local demonstration values only.</small></p><Button variant="secondary" onClick={() => downloadCsv('smartflow-demo-report.csv', [['report', 'scenario', 'controller'], ['Traffic overview', scenario, controller]])}><Download size={15} />Download report data</Button></Panel></div>
  </>
}

export function HistoryPage() {
  const [query, setQuery] = useState('')
  const [scenario, setScenario] = useState('All scenarios')
  const [page, setPage] = useState(0)
  const [details, setDetails] = useState<(typeof historyRows)[number] | null>(null)
  const filtered = useMemo(() => historyRows.filter((r) => (scenario === 'All scenarios' || r.scenario === scenario) && `${r.id} ${r.name}`.toLowerCase().includes(query.toLowerCase())), [query, scenario])
  const pageSize = 4
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize)
  return <>
    <PageHeader title="Simulation history" description="Search and inspect sample run records. These are not persisted backend runs." action={<DemoLabel />} />
    <div className="filters-row"><label className="search-field"><Search size={16} /><input placeholder="Search runs..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} /></label><label className="filter-field">Scenario<select value={scenario} onChange={(e) => { setScenario(e.target.value); setPage(0) }}><option>All scenarios</option><option>Normal Traffic</option><option>Heavy Traffic</option><option>Emergency Traffic</option></select></label></div>
    <Panel title="Demo simulation runs">{filtered.length ? <DataTable headers={['Run ID', 'Run name', 'Scenario', 'Controller', 'Start time', 'Completion', 'Status', 'Actions']} rows={rows.map((r) => [r.id, r.name, r.scenario, r.controller, r.start, r.end, <StatusBadge key={`status-${r.id}`}>{r.status}</StatusBadge>, <Button key={`action-${r.id}`} variant="secondary" onClick={() => setDetails(r)}>View</Button>])} /> : <EmptyState title="No matching runs" description="Try changing your search or scenario filter." />}<div className="pagination"><span>Page {page + 1} of {pageCount} · {filtered.length} demo runs</span><div><Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={15} />Previous</Button><Button variant="secondary" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next<ChevronRight size={15} /></Button></div></div></Panel>
    {details && <Modal title={details.name} onClose={() => setDetails(null)}><div className="readout-grid"><span>Run ID</span><strong>{details.id}</strong><span>Scenario</span><strong>{details.scenario}</strong><span>Controller</span><strong>{details.controller}</strong><span>Status</span><strong>{details.status}</strong><span>Start</span><strong>{details.start}</strong><span>Completion</span><strong>{details.end}</strong></div><DemoLabel /><div className="modal-actions"><Button variant="secondary" onClick={() => downloadCsv(`${details.id}-demo-report.csv`, [['Run ID', 'Name', 'Scenario', 'Controller'], [details.id, details.name, details.scenario, details.controller]])}><Download size={15} />Export preview CSV</Button></div></Modal>}
  </>
}

export function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preferencesError, setPreferencesError] = useState('')
  const [loadedPreferencesUserId, setLoadedPreferencesUserId] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const { user, configured } = useAuth()
  const [notifications, setNotifications] = useState(defaultUserPreferences.notifications)
  const [showDemoLabels, setShowDemoLabels] = useState(defaultUserPreferences.showDemoLabels)
  const [scenario, setScenario] = useState(defaultUserPreferences.scenario)
  const [controller, setController] = useState(defaultUserPreferences.controller)
  const [showDirectionLabels, setShowDirectionLabels] = useState(defaultUserPreferences.showDirectionLabels)
  const preferencesLoading = Boolean(user && loadedPreferencesUserId !== user.id)
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    let active = true
    void loadUserPreferences(userId)
      .then((preferences) => {
        if (!active) return
        setPreferencesError('')
        setTheme(preferences.theme)
        setNotifications(preferences.notifications)
        setShowDemoLabels(preferences.showDemoLabels)
        setScenario(preferences.scenario)
        setController(preferences.controller)
        setShowDirectionLabels(preferences.showDirectionLabels)
        setLoadedPreferencesUserId(userId)
      })
      .catch((error: unknown) => {
        if (!active) return
        setPreferencesError(error instanceof Error ? error.message : 'Preferences could not be loaded.')
        setLoadedPreferencesUserId(userId)
      })
    return () => { active = false }
  }, [setTheme, userId])

  const preferences: UserPreferences = {
    theme,
    notifications,
    showDemoLabels,
    scenario,
    controller,
    showDirectionLabels,
  }

  const savePreferences = async () => {
    setSaved(false)
    setPreferencesError('')
    setSaving(true)
    try {
      if (user) {
        await saveUserPreferences(user.id, preferences)
        setSaved(true)
      } else {
        localStorage.setItem('smartflow-guest-preferences', JSON.stringify(preferences))
        setSaved(true)
      }
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : 'Preferences could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    <PageHeader title="Settings" description={user ? `Personal preferences for ${user.email ?? 'your account'}.` : 'Guest preferences stay in this browser; sign in to sync settings across devices.'} />
    {preferencesLoading && <Panel title="Loading account preferences"><LoadingSkeleton lines={2} /></Panel>}
    {preferencesError && <ErrorState message={preferencesError} />}
    <div className="settings-grid"><Panel title="Profile"><div className="settings-profile"><div className="avatar large">{user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}</div><div><strong>{user?.user_metadata.name ?? 'Guest workspace'}</strong><small>{user?.email ?? (configured ? 'Not signed in' : 'Supabase Auth is not configured')}</small></div></div></Panel>
      <Panel title="Preferences"><label className="field-label">Theme<select value={theme} onChange={(e) => setTheme(e.target.value === 'light' ? 'light' : 'dark')}><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="check-field"><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} /> Enable local notification reminders</label><label className="check-field"><input type="checkbox" checked={showDemoLabels} onChange={(e) => setShowDemoLabels(e.target.checked)} /> Show demonstration data labels</label></Panel>
      <Panel title="Simulation preferences"><label className="field-label">Default scenario<select value={scenario} onChange={(e) => setScenario(e.target.value)}><option>Normal Traffic</option><option>Heavy Traffic</option><option>Emergency Traffic</option></select></label><label className="field-label">Default controller<select value={controller} onChange={(e) => setController(e.target.value)}><option>Adaptive AI</option><option>Fixed-Time</option></select></label><label className="check-field"><input type="checkbox" checked={showDirectionLabels} onChange={(e) => setShowDirectionLabels(e.target.checked)} /> Show vehicle direction labels</label></Panel>
      <Panel title="System information"><div className="readout-grid"><span>Frontend version</span><strong>0.0.0 · development</strong><span>Backend connection</span><strong><StatusBadge>Not checked</StatusBadge></strong><span>API configuration</span><strong>{import.meta.env.VITE_API_URL ? 'URL configured' : 'Default URL'}</strong><span>Secrets</span><strong>Not displayed</strong></div></Panel>
    </div>
    <div className="settings-save"><span>{saved ? <><Check size={16} /> {user ? 'Preferences saved to your account.' : 'Preferences saved in this browser.'}</> : user ? 'Account preferences use Supabase row-level security.' : 'Sign in to sync preferences across devices.'}</span><Button onClick={() => void savePreferences()} disabled={saving || preferencesLoading}>{saving ? 'Saving…' : 'Save preferences'}</Button></div>
  </>
}

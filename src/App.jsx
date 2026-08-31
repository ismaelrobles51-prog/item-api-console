import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import samplePlan from './assets/truck-plan-sample.json'
import {
  BarChart3,
  Box,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Folder,
  LayoutGrid,
  Menu,
  Moon,
  PackageSearch,
  RefreshCw,
  Search,
  Settings,
  Route,
  Plus,
  SlidersHorizontal,
  Sun,
  Truck,
  Upload,
  Users,
  X,
} from 'lucide-react'
import './App.css'

const terminals = ['All', 'LAX', 'DFW', 'ORD', 'SAC', 'HAY', 'PHX', 'MCO', 'SEA', 'EWR', 'NHT', 'ATL']
const stages = ['All', 'Pickup', 'Pickup Complete', 'Linehaul', 'Linehaul Complete', 'Out For Delivery', 'Delivered']

const navItems = [
  { id: 'linehaul', label: 'Linehaul Manager', title: 'FR8 Dispatch', icon: LayoutGrid, subtitle: 'Hub & Spoke Operations' },
  { id: 'orders', label: 'Orders', icon: Folder, subtitle: 'Order Management' },
  { id: 'quotes', label: 'Quotes', icon: FileText, subtitle: 'Quote Workspace' },
  { id: 'trips', label: 'Trips', icon: Truck, subtitle: 'Trip Management' },
  { id: 'shipments', label: 'Shipments', icon: Box, subtitle: 'Shipment Management' },
  { id: 'consolidation', label: 'Consolidation Manager', icon: Boxes, subtitle: 'Consolidation Opportunities' },
  { id: 'brokerage', label: 'Brokerage', icon: SlidersHorizontal, subtitle: 'Brokerage Operations' },
  { id: 'local', label: 'Local P&D', icon: Truck, subtitle: 'Pickup & Delivery Operations' },
  { id: 'terminals', label: 'Terminals', icon: Building2, subtitle: 'Network Directory' },
  { id: 'drivers', label: 'Drivers', icon: Users, subtitle: 'Driver Management' },
  { id: 'audit', label: 'Freight Audit/Entry', icon: ClipboardCheck, subtitle: 'Freight Bill Review' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, subtitle: 'Network Performance' },
  { id: 'routingGuide', label: 'Routing Guide', icon: Route, subtitle: 'Local routing rules' },
  { id: 'settings', label: 'Settings', icon: Settings, subtitle: 'Workspace Preferences' },
]

const viewConfig = {
  orders: { singular: 'order', columns: ['PRO #', 'Origin', 'Destination', 'Stage', 'Pallets', 'Weight'] },
  quotes: { singular: 'quote', columns: ['Quote #', 'Customer', 'Origin', 'Destination', 'Status', 'Total'] },
  trips: { singular: 'trip', columns: ['Trip #', 'Origin', 'Destination', 'Status', 'Trailer', 'Driver'] },
  shipments: { singular: 'shipment', columns: ['Shipment #', 'Shipper', 'Consignee', 'Stage', 'Pieces', 'Weight'] },
  consolidation: { singular: 'opportunity', columns: ['Lane', 'Orders', 'Pallets', 'Weight', 'Capacity', 'Status'] },
  brokerage: { singular: 'load', columns: ['Load #', 'Customer', 'Carrier', 'Lane', 'Status', 'Rate'] },
  local: { singular: 'route', columns: ['Route', 'Driver', 'Stops', 'Equipment', 'Status', 'Departure'] },
  terminals: { singular: 'terminal', columns: ['Code', 'Terminal', 'Region', 'Inbound', 'Outbound', 'Status'] },
  drivers: { singular: 'driver', columns: ['Driver', 'Home Terminal', 'Equipment', 'Trip', 'Status', 'Hours'] },
  audit: { singular: 'freight bill', columns: ['PRO #', 'Trip #', 'Customer', 'Received', 'Issues', 'Status'] },
}

function valueFor(row, names) {
  const entries = Object.entries(row)
  for (const name of names) {
    const found = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, '') === name)
    if (found && found[1] !== '') return found[1]
  }
  return ''
}

function numberFor(row, names) {
  const value = valueFor(row, names)
  const number = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function parseLocalFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.onload = () => {
      try {
        if (/\.xlsx?$/i.test(file.name)) {
          const workbook = XLSX.read(reader.result, { type: 'array', cellDates: true })
          const dataSheet = workbook.Sheets.DATA || workbook.Sheets[workbook.SheetNames[0]]
          const sourceRows = XLSX.utils.sheet_to_json(dataSheet, { defval: '' }).filter((row) => row.Order)
          const orders = sourceRows.map((row) => ({
            orderNumber: String(row.Order || ''), proNumber: String(row.Pro || ''), currentTerminal: String(row['ORG TRM'] || '').toUpperCase(), originTerminal: String(row['ORG TRM'] || '').toUpperCase(),
            destinationCity: row['Consignee City'], destinationState: row['Consignee State'], finalDestinationTerminal: String(row['D TRM'] || '').toUpperCase(),
            currentStage: row.Stage, weight: Number(row.Lbs) || 0, palletCount: Number(row.Plt) || 0, pieces: Number(row.Pcs) || 0, pickupDate: row['PU DT'] || row['PU DT Apt'], mabd: row['DL DT Apt'] || row['DL DT'],
            serviceLevel: row['SVCS TRM'] === 'DIRECT' ? 'Direct' : 'Standard', customer: row['Bill To'], assignedTrip: row['D Truck #'], active: true,
          }))
          const guide = new Map()
          orders.forEach((order) => { const next = String(sourceRows.find((row) => String(row.Order) === order.orderNumber)?.['SVCS TRM'] || ''); const normalizedNext = next === 'DIRECT' ? order.finalDestinationTerminal : next; if (order.currentTerminal && order.finalDestinationTerminal && normalizedNext) guide.set(`${order.currentTerminal}|${order.finalDestinationTerminal}|${normalizedNext}`, { ruleId: `IMPORTED-${guide.size + 1}`, originTerminal: order.currentTerminal, finalDestinationTerminal: order.finalDestinationTerminal, nextTerminal: normalizedNext, routeType: normalizedNext === order.finalDestinationTerminal ? 'Direct' : 'Hub', priority: 1, active: true, directAllowed: normalizedNext === order.finalDestinationTerminal }) })
          const trips = [...new Set(orders.map((order) => order.assignedTrip).filter(Boolean))].map((tripNumber) => ({ tripNumber, status: 'Pre-Planned' }))
          resolve({ orders, rules: [...guide.values()], trips, terminalMap: {} })
          return
        }
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(reader.result)
          const orders = Array.isArray(parsed) ? parsed : (parsed.orders || [])
          if (!Array.isArray(orders)) throw new Error('JSON must be an array or contain an orders array.')
          resolve({ orders: orders.filter((row) => row && typeof row === 'object'), rules: parsed.routingGuides || parsed.rules || [], trips: parsed.trips || [], terminalMap: parsed.terminalMap || {} })
          return
        }
        const parsed = Papa.parse(reader.result, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() })
        if (parsed.errors.length) throw new Error(parsed.errors[0].message)
        resolve({ orders: parsed.data, rules: [], trips: [], terminalMap: {} })
      } catch (error) { reject(error) }
    }
    if (/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  })
}

const yes = (value) => ['yes', 'true', '1', 'y'].includes(String(value || '').toLowerCase())
const dateValue = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d }
const field = (row, names) => valueFor(row, names)
function finalTerminal(order, terminalMap) {
  return String(field(order, ['finaldestinationterminal', 'finalterminal']) || terminalMap[String(field(order, ['destinationzip', 'zip']))] || '').toUpperCase()
}
function routeOrders(orders, rules, trips, terminalMap) {
  const now = new Date()
  return orders.map((order) => {
    const current = String(field(order, ['currentterminal', 'physicalterminal', 'terminal'])).toUpperCase()
    const final = finalTerminal(order, terminalMap)
    const stage = String(field(order, ['currentstage', 'stage', 'status'])).toLowerCase()
    const assigned = String(field(order, ['assignedtrip', 'tripnumber', 'trip']) || '')
    const existing = trips.find((trip) => String(field(trip, ['tripnumber', 'id'])) === assigned)
    const excluded = !current || !final || !yes(field(order, ['active']) || 'true') || ['delivered','cancelled','closed','claim hold','billing only'].some(x => stage.includes(x)) || yes(field(order, ['permanentlyheld'])) || (existing && /completed/i.test(field(existing, ['status'])))
    if (excluded) return { order, eligible: false, status: !current || !final ? 'MANUAL REVIEW' : 'EXCLUDED', current, final, reason: 'Missing terminal, inactive, final stage, hold, or completed trip' }
    if (current === final) return { order, eligible: false, status: 'LOCAL DELIVERY', current, final, reason: 'Freight is already at its final terminal' }
    if (!['pickup complete', 'linehaul complete'].includes(stage)) return { order, eligible: false, status: 'WAITING FOR STAGE', current, final, reason: 'Linehaul requires Pickup Complete or Linehaul Complete' }
    const zip = String(field(order, ['destinationzip', 'zip'])); const customer = String(field(order, ['customer'])); const state = String(field(order, ['destinationstate', 'state'])).toUpperCase()
    const weight = numberFor(order, ['weight','totalweight','lbs']); const pallets = numberFor(order, ['palletcount','pallets']); const cube = numberFor(order, ['cube'])
    const eligibleRules = rules.filter((r) => {
      const from = String(field(r, ['originterminal','currentterminal','origin'])).toUpperCase(); const until = dateValue(field(r,['expirationdate'])); const effective = dateValue(field(r,['effectivedate']))
      return yes(field(r,['active']) || 'true') && from === current && (!effective || effective <= now) && (!until || until >= now) && (!field(r,['equipmenttype']) || field(r,['equipmenttype']) === field(order,['equipmenttype'])) && (!field(r,['minimumweight']) || weight >= numberFor(r,['minimumweight'])) && (!field(r,['maximumweight']) || weight <= numberFor(r,['maximumweight'])) && (!field(r,['minimumpallets']) || pallets >= numberFor(r,['minimumpallets'])) && (!field(r,['maximumpallets']) || pallets <= numberFor(r,['maximumpallets'])) && (!field(r,['minimumcube']) || cube >= numberFor(r,['minimumcube'])) && (!field(r,['maximumcube']) || cube <= numberFor(r,['maximumcube'])) && (!yes(field(order,['hazmat'])) || yes(field(r,['hazmatallowed'])))
    })
    const specificity = (r) => field(r,['customerrestriction']) && field(r,['customerrestriction']) === customer ? 1 : field(r,['destinationzip','zipspecific']) && field(r,['destinationzip','zipspecific']) === zip ? 2 : String(field(r,['finaldestinationterminal','destinationterminal','finalterminal'])).toUpperCase() === final ? 3 : field(r,['region','destinationstate','state']) && String(field(r,['region','destinationstate','state'])).toUpperCase() === state ? 4 : 5
    const matches = eligibleRules.filter(r => specificity(r) < 5 || !field(r,['customerrestriction','destinationzip','zipspecific','finaldestinationterminal','destinationterminal','finalterminal','region','destinationstate','state'])).sort((a,b) => specificity(a)-specificity(b) || numberFor(a,['priority'])-numberFor(b,['priority']))
    const rule = matches[0]
    if (!rule) return { order, eligible: false, status: 'NO ROUTE', current, final, reason: 'No active routing-guide match' }
    const next = String(field(rule, ['nextterminal'])).toUpperCase(); if (!next) return { order, eligible:false, status:'MANUAL REVIEW', current, final, rule, reason:'Rule has no next terminal' }
    const capacity = Math.max(weight / (numberFor(rule,['trailerweightcapacity']) || 42000), pallets / (numberFor(rule,['trailerpalletcapacity']) || 26), cube / (numberFor(rule,['trailercubecapacity']) || 3400))
    const terminalArrival = dateValue(field(order,['terminalarrivaltime','terminalarrival'])) || now; const dwell = Math.max(0, (now-terminalArrival)/36e5)
    const mabd = dateValue(field(order,['mabd'])); const transit = numberFor(rule,['transitdays']) * 24; const serviceRisk = mabd && now.getTime() + (dwell + transit + 8) * 36e5 > mabd.getTime()
    const compatibleTrip = trips.find(t => String(field(t,['originterminal','origin'])).toUpperCase()===current && String(field(t,['nextterminal','destination','to'])).toUpperCase()===next && /pre-planned|suggested|open/i.test(field(t,['status'])) && numberFor(t,['availableweight','remainingweight']) >= weight)
    const locked = existing && /dispatched|in progress/i.test(field(existing,['status']))
    const direct = next === final || (yes(field(rule,['directallowed'])) && String(field(rule,['routetype'])).toLowerCase() === 'direct')
    return { order, eligible: !locked, locked, current, final, next, rule, existingTrip: compatibleTrip, dwell, capacity, serviceRisk, status: locked ? 'MANUAL REVIEW' : compatibleTrip ? 'CONSOLIDATION AVAILABLE' : serviceRisk ? 'SERVICE RISK' : direct ? 'DIRECT' : 'HUB ROUTED', action: compatibleTrip ? 'ADD TO EXISTING TRIP' : serviceRisk || capacity >= .85 ? 'BUILD NOW' : capacity >= .65 ? 'BUILD SOON' : 'HOLD FOR CONSOLIDATION' }
  })
}

function Sidebar({ activeView, collapsed, mobileOpen, onCollapse, onSelect, onClose, onHelp }) {
  return (
    <>
      {mobileOpen && <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Truck size={21} strokeWidth={1.9} /></div>
          <span className="brand-name">FR8 Dispatch</span>
          <button className="icon-button collapse-top" type="button" onClick={onCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button className="icon-button close-mobile" type="button" onClick={onClose} aria-label="Close navigation"><X size={17} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${activeView === id ? 'active' : ''}`}
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" type="button" onClick={onHelp} title={collapsed ? 'Help' : undefined}>
            <CircleHelp size={17} strokeWidth={1.8} /><span>Help</span>
          </button>
          <button className="nav-item desktop-collapse" type="button" onClick={onCollapse} title={collapsed ? 'Expand' : undefined}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function Header({ current, theme, onTheme, onMenu, onUpload, onLoadSample, onRefresh, loading, hasData }) {
  return (
    <>
      <header className="topbar">
        <button className="icon-button menu-button" type="button" onClick={onMenu} aria-label="Open navigation"><Menu size={18} /></button>
        <div className="title-block">
          <h1>{current.title || current.label}</h1>
          <p>{current.subtitle}</p>
        </div>
        <div className="top-actions">
          <button className="theme-button" type="button" onClick={onTheme} title={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}>
            {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className={`mode-pill ${hasData ? 'ready' : ''}`}><span />{hasData ? 'Plan loaded' : 'Local mode'}</span>
        </div>
      </header>
      <div className="tabs-row">
        <div className="page-tab active">{current.label}</div>
        <div className="tabs-spacer" />
        <button className="secondary-button" type="button" onClick={onLoadSample} disabled={loading}>
          <PackageSearch size={13} /> <span>Load sample</span>
        </button>
        <button className="secondary-button" type="button" onClick={onUpload} disabled={loading}>
          <Upload size={13} /> <span>Upload Plan</span>
        </button>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> <span>{loading ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>
    </>
  )
}

function MetricCard({ label, value, detail, accent }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={accent ? { color: `var(--${accent})` } : undefined}>{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  )
}

function LinehaulDashboard({ rows, rules, trips, terminalMap, selectedTerminal, setSelectedTerminal, selectedStages, setSelectedStages, onUpload }) {
  const [activeLane, setActiveLane] = useState('')
  const routed = useMemo(() => routeOrders(rows, rules, trips, terminalMap), [rows, rules, trips, terminalMap])
  const scoped = routed.filter(r => (selectedTerminal === 'All' || r.current === selectedTerminal || r.next === selectedTerminal) && (selectedStages.includes('All') || selectedStages.some((selectedStage) => String(field(r.order,['currentstage','stage','status'])).toLowerCase().includes(selectedStage.toLowerCase()))))
  const eligible = scoped.filter(r => r.eligible)
  const lanes = Object.values(eligible.reduce((all, r) => { const key=`${r.current}-${r.next}`; const lane=all[key] || { key, current:r.current, next:r.next, count:0, weight:0, pallets:0, cube:0, oldest:0, earliest:null, orders:[], serviceRisk:false, existingTrip:null }; lane.count++; lane.weight+=numberFor(r.order,['weight','totalweight','lbs']); lane.pallets+=numberFor(r.order,['palletcount','pallets']); lane.cube+=numberFor(r.order,['cube']); lane.oldest=Math.max(lane.oldest,r.dwell); lane.serviceRisk ||= r.serviceRisk; lane.existingTrip ||= r.existingTrip; lane.orders.push(r); const mabd=dateValue(field(r.order,['mabd'])); if(mabd && (!lane.earliest || mabd<lane.earliest)) lane.earliest=mabd; all[key]=lane; return all }, {})).map(l => ({...l, utilization:Math.max(l.weight/42000,l.pallets/26,l.cube/3400), action:l.serviceRisk?'SERVICE RISK':l.weight/42000>=.85||l.pallets/26>=.85?'BUILD NOW':l.weight/42000>=.65||l.pallets/26>=.65?'BUILD SOON':'HOLD'})).sort((a,b)=>Number(b.serviceRisk)-Number(a.serviceRisk)||b.utilization-a.utilization)
  const selected = lanes.find(l => l.key === activeLane) || lanes[0]
  const toggleStage = (stage) => setSelectedStages((current) => { if (stage === 'All') return ['All']; const next=current.filter(x=>x!=='All'); return next.includes(stage) ? (next.filter(x=>x!==stage).length ? next.filter(x=>x!==stage) : ['All']) : [...next,stage] })
  return <div className="trip-builder-dark">
    <header className="tb-top"><div><div className="tb-eyebrow">Linehaul Manager</div><h2>Trip Builder</h2><p>Review suggested lanes, trailer capacity, service risk, and eligible orders.</p></div><div className="tb-controls"><select aria-label="Terminal" value={selectedTerminal} onChange={e=>setSelectedTerminal(e.target.value)}>{terminals.map(t=><option key={t} value={t}>{t === 'All' ? 'All terminals' : `${t} Terminal`}</option>)}</select><button type="button" onClick={onUpload}><Upload size={14}/> Upload routing plan</button><button type="button" className="tb-primary" onClick={()=>setActiveLane(lanes[0]?.key || '')}>Pull orders</button></div></header>
    <div className="tb-stage-row"><span>Stages</span>{stages.map(stage=><button aria-pressed={selectedStages.includes(stage)} className={selectedStages.includes(stage)?'selected':''} type="button" key={stage} onClick={()=>toggleStage(stage)}>{stage}</button>)}</div>
    <section className="tb-metrics"><div className="tb-metric"><span>Suggested trips</span><strong className="blue">{lanes.length}</strong></div><div className="tb-metric"><span>Eligible orders</span><strong>{eligible.length}</strong></div><div className="tb-metric"><span>Lanes</span><strong>{lanes.length}</strong></div><div className="tb-metric"><span>Total weight</span><strong className="orange">{eligible.reduce((sum,r)=>sum+numberFor(r.order,['weight','totalweight','lbs']),0).toLocaleString()} lbs</strong></div></section>
    <section className="tb-builder"><div className="tb-builder-head"><div>Suggested Trips <span className="tb-badge">{lanes.length}</span></div><span>Capacity limit: 42,000 lbs</span></div><div className="tb-body"><aside className="tb-lanes">{lanes.length ? lanes.map(l=><button type="button" className={`tb-lane ${selected?.key===l.key?'active':''}`} onClick={()=>setActiveLane(l.key)} key={l.key}><div><strong><i>{l.current}</i> → <em>{l.next}</em></strong><b className={l.serviceRisk?'risk':''}>{l.action}</b></div><small><span>{l.count} orders · {l.pallets} plts · {Math.round(l.weight).toLocaleString()} lbs</span><span>{Math.round(l.utilization*100)}% full</span></small></button>) : <div className="tb-empty">No linehaul-eligible orders for these filters.</div>}</aside><div className="tb-detail">{selected ? <article className="tb-trip-card"><div className="tb-trip-top"><strong><i>{selected.current}</i> → <em>{selected.next}</em></strong><div><button type="button" className="tb-ghost">{selected.existingTrip ? `Co-load on ${field(selected.existingTrip,['tripnumber','id'])}` : 'Review capacity'}</button><button type="button" className="tb-primary">Build locally</button></div></div><p>{selected.pallets} Plts · {Math.round(selected.weight).toLocaleString()} Lbs · <b>{Math.round(selected.utilization*100)}% Full</b>{selected.earliest ? ` · MABD ${selected.earliest.toLocaleDateString()}` : ''}</p><div className="tb-progress"><div style={{width:`${Math.min(selected.utilization*100,100)}%`}}/></div><div className="tb-table-wrap"><table><thead><tr><th>PRO</th><th>Consignee city</th><th>State</th><th>Weight</th><th>Pallets</th><th>MABD</th><th>Status</th></tr></thead><tbody>{selected.orders.sort((a,b)=>Number(b.serviceRisk)-Number(a.serviceRisk)||a.dwell-b.dwell).map((r,i)=><tr key={i}><td>{field(r.order,['pro','pronumber'])||'—'}</td><td>{field(r.order,['destinationcity','consigneecity','city'])||'—'}</td><td>{field(r.order,['destinationstate','consigneestate','state'])||'—'}</td><td>{numberFor(r.order,['weight','totalweight','lbs']).toLocaleString()} lbs</td><td>{numberFor(r.order,['palletcount','pallets'])}</td><td>{dateValue(field(r.order,['mabd']))?.toLocaleString()||'—'}</td><td className={r.serviceRisk?'risk':'status'}>{r.status}</td></tr>)}</tbody></table></div></article> : <div className="tb-empty">Select a lane to review eligible orders.</div>}</div></div></section>
  </div>
}
function EmptyModule({ config, query, setQuery }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filteredLabel = query ? `No ${config.singular}s match “${query}”` : `No ${config.singular}s available`
  return (
    <div className="module-view">
      <div className="module-toolbar">
        <div className="search-wrap"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.singular}s...`} /></div>
        <button className={`secondary-button ${filtersOpen ? 'selected' : ''}`} type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={13} /> Filters</button>
      </div>
      {filtersOpen && <div className="module-filters"><label>Status<select><option>All statuses</option><option>Unassigned</option><option>Complete</option></select></label><button type="button" onClick={() => setFiltersOpen(false)}><X size={13} /> Clear</button></div>}
      <div className="table-panel">
        <table className="data-table">
          <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody><tr><td colSpan={config.columns.length}><div className="table-empty"><PackageSearch size={23} /><strong>{filteredLabel}</strong><span>Records will appear here when a local plan is loaded.</span></div></td></tr></tbody>
        </table>
      </div>
    </div>
  )
}

function AnalyticsView({ rows }) {
  const terminalTotals = useMemo(() => terminals.slice(1).map((terminal) => ({
    terminal,
    total: rows.filter((row) => {
      const origin = String(valueFor(row, ['origin', 'originterminal', 'from'])).toUpperCase()
      const destination = String(valueFor(row, ['destination', 'dest', 'destinationterminal', 'to'])).toUpperCase()
      return origin === terminal || destination === terminal
    }).length,
  })).filter((item) => item.total > 0), [rows])
  const max = Math.max(...terminalTotals.map((item) => item.total), 1)

  return (
    <div className="analytics-view">
      <section className="metrics-grid analytics-metrics">
        <MetricCard label="Records" value={rows.length ? rows.length.toLocaleString() : '—'} detail="in local plan" />
        <MetricCard label="Active Terminals" value={rows.length ? terminalTotals.length : '—'} detail="represented" accent="blue" />
        <MetricCard label="Network Weight" value={rows.length ? Math.round(rows.reduce((sum, row) => sum + numberFor(row, ['weight', 'totalweight', 'lbs']), 0)).toLocaleString() : '—'} detail="lbs" accent="green" />
      </section>
      <div className="chart-panel">
        <div className="panel-heading"><div><h2>Orders by Terminal</h2><p>Current local plan</p></div><BarChart3 size={17} /></div>
        {terminalTotals.length ? <div className="bar-chart">{terminalTotals.map(({ terminal, total }) => <div className="bar-column" key={terminal}><span className="bar-value">{total}</span><div className="bar" style={{ height: `${Math.max((total / max) * 150, 8)}px` }} /><span>{terminal}</span></div>)}</div> : <div className="chart-empty"><BarChart3 size={25} /><strong>No chart data available</strong><span>Upload a local plan to populate this view.</span></div>}
      </div>
    </div>
  )
}


function RoutingGuideView({ rules, setRules, terminalMap, setTerminalMap }) {
  const [draft, setDraft] = useState({ ruleId:'', originTerminal:'', finalDestinationTerminal:'', nextTerminal:'', routeType:'Hub', priority:'1', active:'true' })
  const update = (key, value) => setDraft(d => ({...d,[key]:value}))
  const add = () => { if (!draft.originTerminal || !draft.nextTerminal) return; setRules(r=>[...r, {...draft}]); setDraft({ ruleId:'', originTerminal:'', finalDestinationTerminal:'', nextTerminal:'', routeType:'Hub', priority:'1', active:'true' }) }
  return <div className="routing-guide-view"><section className="settings-card"><div className="settings-card-heading"><h2>Routing guide</h2><p>Local-only rules. Current terminal and final destination are distinct from the next linehaul terminal.</p></div><div className="guide-form"><input placeholder="Rule ID" value={draft.ruleId} onChange={e=>update('ruleId',e.target.value)}/><input placeholder="Current / origin terminal *" value={draft.originTerminal} onChange={e=>update('originTerminal',e.target.value.toUpperCase())}/><input placeholder="Final terminal (or region)" value={draft.finalDestinationTerminal} onChange={e=>update('finalDestinationTerminal',e.target.value.toUpperCase())}/><input placeholder="Next terminal *" value={draft.nextTerminal} onChange={e=>update('nextTerminal',e.target.value.toUpperCase())}/><select value={draft.routeType} onChange={e=>update('routeType',e.target.value)}><option>Hub</option><option>Direct</option><option>Bypass</option></select><input type="number" min="1" placeholder="Priority" value={draft.priority} onChange={e=>update('priority',e.target.value)}/><button className="primary-button" type="button" onClick={add}><Plus size={14}/> Add local rule</button></div></section>
  <section className="table-panel"><table className="data-table"><thead><tr><th>Rule ID</th><th>Current</th><th>Final / Region</th><th>Next</th><th>Type</th><th>Priority</th><th>Restrictions</th><th></th></tr></thead><tbody>{rules.length ? rules.map((r,i)=><tr key={i}><td>{field(r,['ruleid'])||'—'}</td><td>{field(r,['originterminal','currentterminal','origin'])}</td><td>{field(r,['finaldestinationterminal','destinationterminal','region','destinationstate'])||'Network default'}</td><td><strong>{field(r,['nextterminal'])}</strong></td><td>{field(r,['routetype'])||'Hub'}</td><td>{field(r,['priority'])||'—'}</td><td>{field(r,['customerrestriction']) || field(r,['destinationzip']) || '—'}</td><td><button className="row-delete" type="button" onClick={()=>setRules(x=>x.filter((_,n)=>n!==i))}>Remove</button></td></tr>) : <tr><td colSpan="8"><div className="table-empty"><Route size={23}/><strong>No routing rules loaded</strong><span>Upload a plan JSON with routingGuides, or add a local rule.</span></div></td></tr>}</tbody></table></section>
  <section className="settings-card mapping-card"><div className="settings-card-heading"><h2>ZIP → final terminal map</h2><p>JSON object used only when an order does not carry Final Destination Terminal.</p></div><textarea value={JSON.stringify(terminalMap,null,2)} onChange={e=>{try { setTerminalMap(JSON.parse(e.target.value)) } catch {}}} aria-label="Terminal map JSON"/></section></div>
}

function SettingsView({ compact, setCompact, timeFormat, setTimeFormat, onSave }) {
  return (
    <div className="settings-view">
      <div className="settings-card">
        <div className="settings-card-heading"><h2>Display</h2><p>Local workspace preferences</p></div>
        <div className="settings-body">
          <div className="settings-row"><div><strong>Compact tables</strong><span>Reduce table row height</span></div><button className={`toggle ${compact ? 'on' : ''}`} type="button" role="switch" aria-checked={compact} onClick={() => setCompact(!compact)}><span /></button></div>
          <div className="settings-row"><div><strong>Time format</strong><span>Choose the clock used in the workspace</span></div><div className="segmented"><button className={timeFormat === '12' ? 'active' : ''} type="button" onClick={() => setTimeFormat('12')}>12 hour</button><button className={timeFormat === '24' ? 'active' : ''} type="button" onClick={() => setTimeFormat('24')}>24 hour</button></div></div>
        </div>
      </div>
      <button className="primary-button" type="button" onClick={onSave}>Save preferences</button>
    </div>
  )
}

function App() {
  const [activeView, setActiveView] = useState('linehaul')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('fr8-theme') || 'light')
  const [rows, setRows] = useState(samplePlan.orders)
  const [rules, setRules] = useState(samplePlan.routingGuides)
  const [trips, setTrips] = useState(samplePlan.trips)
  const [terminalMap, setTerminalMap] = useState(samplePlan.terminalMap || {})
  const [fileName, setFileName] = useState('7.10 MABD TRUCK PLAN 3 (sample)')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState(null)
  const [selectedTerminal, setSelectedTerminal] = useState('All')
  const [selectedStages, setSelectedStages] = useState(['All'])
  const [query, setQuery] = useState('')
  const [compact, setCompact] = useState(false)
  const [timeFormat, setTimeFormat] = useState('12')
  const fileInput = useRef(null)
  const current = navItems.find((item) => item.id === activeView)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('fr8-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [notice])

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLoading(true)
    try {
      const parsedRows = await parseLocalFile(file)
      setRows(parsedRows.orders)
      setRules(parsedRows.rules)
      setTrips(parsedRows.trips)
      setTerminalMap(parsedRows.terminalMap)
      setFileName(file.name)
      setNotice({ type: 'success', text: `${parsedRows.orders.length.toLocaleString()} orders loaded from ${file.name}` })
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'The local plan could not be loaded.' })
    } finally {
      setLoading(false)
    }
  }


  function loadSample() {
    setRows(samplePlan.orders); setRules(samplePlan.routingGuides); setTrips(samplePlan.trips); setTerminalMap(samplePlan.terminalMap || {}); setFileName('7.10 MABD TRUCK PLAN 3 (sample)')
    setNotice({ type: 'success', text: `${samplePlan.orders.length.toLocaleString()} supplied sample orders loaded locally` })
  }

  function selectView(id) {
    setActiveView(id)
    setMobileOpen(false)
    setQuery('')
  }

  function refreshWorkspace() {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      setNotice({ type: 'success', text: rows.length ? `${fileName} refreshed locally` : 'Workspace is up to date' })
    }, 500)
  }

  let content
  if (activeView === 'linehaul') {
    content = <LinehaulDashboard rows={rows} rules={rules} trips={trips} terminalMap={terminalMap} selectedTerminal={selectedTerminal} setSelectedTerminal={setSelectedTerminal} selectedStages={selectedStages} setSelectedStages={setSelectedStages} onUpload={() => fileInput.current?.click()} />
  } else if (activeView === 'analytics') {
    content = <AnalyticsView rows={rows} />
  } else if (activeView === 'routingGuide') {
    content = <RoutingGuideView rules={rules} setRules={setRules} terminalMap={terminalMap} setTerminalMap={setTerminalMap} />
  } else if (activeView === 'settings') {
    content = <SettingsView compact={compact} setCompact={setCompact} timeFormat={timeFormat} setTimeFormat={setTimeFormat} onSave={() => setNotice({ type: 'success', text: 'Preferences saved on this device' })} />
  } else {
    content = <EmptyModule config={viewConfig[activeView]} query={query} setQuery={setQuery} />
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${compact ? 'compact' : ''}`}>
      <Sidebar activeView={activeView} collapsed={collapsed} mobileOpen={mobileOpen} onCollapse={() => setCollapsed(!collapsed)} onSelect={selectView} onClose={() => setMobileOpen(false)} onHelp={() => setNotice({ type: 'info', text: 'This workspace runs entirely on local files.' })} />
      <div className={`main-shell ${activeView === 'linehaul' ? 'linehaul-full' : ''}`}>
        {activeView !== 'linehaul' && <Header current={current} theme={theme} onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} onMenu={() => setMobileOpen(true)} onUpload={() => fileInput.current?.click()} onLoadSample={loadSample} onRefresh={refreshWorkspace} loading={loading} hasData={rows.length > 0} />}
        <main className="main-content">{content}</main>
        <footer>All times in local terminal time <span>·</span> Data remains on this device</footer>
      </div>
      <input ref={fileInput} className="hidden-input" type="file" accept=".csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} />
      {notice && <div className={`toast ${notice.type}`} role="status">{notice.type === 'success' && <ClipboardCheck size={16} />}{notice.type === 'error' && <X size={16} />}{notice.type === 'info' && <CircleHelp size={16} />}<span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button></div>}
    </div>
  )
}

export default App

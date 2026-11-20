import {
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Gauge,
  History,
  Map,
  Route,
  Settings,
  Siren,
  TrafficCone,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigation = [
  { label: 'Dashboard', to: '/dashboard', icon: Gauge },
  { label: 'Live Simulation', to: '/simulation', icon: Route },
  { label: 'AI Control Center', to: '/ai-control', icon: BrainCircuit },
  { label: 'Emergency Management', to: '/emergency', icon: Siren },
  { label: 'Traffic Heatmap', to: '/heatmap', icon: Map },
  { label: 'Traffic Prediction', to: '/prediction', icon: TrafficCone },
  { label: 'Analytics & Reports', to: '/analytics', icon: BarChart3 },
  { label: 'Simulation History', to: '/history', icon: History },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function AppSidebar({
  collapsed,
  mobileOpen,
  onCollapse,
  onMobileClose,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onCollapse: () => void
  onMobileClose: () => void
}) {
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onMobileClose} />}
      <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div className="brand-copy">
            <strong>SmartFlow</strong>
            <span>AI</span>
          </div>
          <button className="sidebar-mobile-close" aria-label="Close navigation" onClick={onMobileClose}>
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onMobileClose}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="collapse-button" onClick={onCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
    </>
  )
}

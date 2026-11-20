import { Bell, ChevronDown, Menu, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts/useTheme'
import { useSimulation } from '../../contexts/useSimulation'
import { useAuth } from '../../contexts/useAuth'
import { api } from '../../services/api'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/simulation': 'Live Traffic Simulation',
  '/ai-control': 'AI Control Center',
  '/emergency': 'Emergency Management',
  '/heatmap': 'Traffic Heatmap',
  '/prediction': 'Traffic Prediction',
  '/analytics': 'Analytics & Reports',
  '/history': 'Simulation History',
  '/settings': 'Settings',
}

export function TopNavbar({ onMenu }: { onMenu: () => void }) {
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null)
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null)
  const [backendSimulation, setBackendSimulation] = useState<string>('checking')
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { status } = useSimulation()
  const { configured, user, signOut } = useAuth()
  const [profileError, setProfileError] = useState('')
  const title = titles[location.pathname] || 'SmartFlow AI'

  useEffect(() => {
    let active = true
    void Promise.all([api.health(), api.simulationStatus()]).then(([health, simulation]) => {
      if (!active) return
      setBackendConnected(health.ok)
      setBackendSimulation(
        simulation.ok
          ? simulation.data.available ? simulation.data.status : `${simulation.data.status} (not configured)`
          : 'unavailable',
      )
    })
    return () => { active = false }
  }, [])

  const connectionClass = backendConnected === null
    ? 'backend-checking'
    : backendConnected ? 'backend-connected' : 'backend-disconnected'

  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenu}>
        <Menu size={20} />
      </button>
      <div className="page-context">
        <span>Operations</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-actions">
        <div className={`connection-status ${connectionClass}`} title={backendConnected ? 'FastAPI health check succeeded.' : backendConnected === null ? 'Checking FastAPI health.' : 'FastAPI is unavailable.'}>
          <span className="status-dot" />
          <span>Backend: {backendConnected ? 'connected' : backendConnected === null ? 'checking' : 'disconnected'}</span>
        </div>
        <div className={`connection-status ${backendSimulation === 'checking' ? 'backend-checking' : backendSimulation === 'unavailable' || backendSimulation.includes('not configured') ? 'backend-disconnected' : 'backend-connected'}`} title="Actual backend simulation state; separate from the local frontend demo.">
          <span className="status-dot" />
          <span>API simulation: {backendSimulation}</span>
        </div>
        <div className="simulation-status">
          <span>Demo simulation</span>
          <strong>{status}</strong>
        </div>
        <button className="icon-button" aria-label="Notifications" aria-expanded={openMenu === 'notifications'} onClick={() => setOpenMenu(openMenu === 'notifications' ? null : 'notifications')}>
          <Bell size={19} />
        </button>
        <button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <button className="profile-button" aria-label="Open profile menu" aria-expanded={openMenu === 'profile'} onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}>
          <div className="avatar">{user?.email?.slice(0, 2).toUpperCase() ?? 'OP'}</div>
          <div className="profile-copy">
            <strong>{user?.user_metadata.name ?? user?.email ?? 'Public user'}</strong>
            <span>{user ? 'Signed in' : 'Guest access'}</span>
          </div>
          <ChevronDown size={16} />
        </button>
        {openMenu && <div className="topbar-popover" role="status">
          <strong>{openMenu === 'notifications' ? 'Notifications' : 'Workspace profile'}</strong>
          <p>{openMenu === 'notifications'
            ? 'No connected backend notifications.'
            : user?.email ?? (configured ? 'Public access · sign in to save preferences.' : 'Public access · account features are not configured.')}</p>
          {profileError && <p role="alert">{profileError}</p>}
          {openMenu === 'profile' && user
            ? <button onClick={() => { void signOut().then((result) => { if (result.error) setProfileError(result.error); else { setProfileError(''); setOpenMenu(null) } }) }}>Sign out</button>
            : openMenu === 'profile' && configured
              ? <Link to="/login" onClick={() => setOpenMenu(null)}>Sign in</Link>
              : <button onClick={() => setOpenMenu(null)}>Dismiss</button>}
        </div>}
      </div>
    </header>
  )
}

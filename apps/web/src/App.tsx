import { Component, lazy, Suspense, type ReactNode } from 'react'
import { ArrowRight, BrainCircuit, MapPin, ShieldCheck, TrafficCone, Waypoints } from 'lucide-react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { Button, Card } from './components/common/UI'
import { MainLayout } from './components/layout/MainLayout'
import { AuthPage } from './pages/AuthPage'

const DashboardPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.DashboardPage })))
const SimulationPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.SimulationPage })))
const AIControlPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.AIControlPage })))
const EmergencyPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.EmergencyPage })))
const HeatmapPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.HeatmapPage })))
const PredictionPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.PredictionPage })))
const AnalyticsPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.AnalyticsPage })))
const HistoryPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.HistoryPage })))
const SettingsPage = lazy(() => import('./pages/OperationsPages').then((module) => ({ default: module.SettingsPage })))

function LandingPage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <Link className="landing-brand" to="/">
          <div className="brand-mark">S</div>
          <div><strong>SmartFlow</strong><span>AI</span></div>
        </Link>
        <div className="landing-links">
          <a href="#platform">Platform</a>
          <a href="#capabilities">Capabilities</a>
          <Link to="/login">Optional sign-in</Link>
          <Link className="landing-cta" to="/dashboard">Open workspace</Link>
        </div>
      </nav>
      <main>
        <section className="landing-hero" id="platform">
          <div className="hero-copy">
            <span className="eyebrow">AI-powered traffic operations</span>
            <h1>Smarter Signals.<br /><em>Faster Movement.</em><br />Safer Roads.</h1>
            <p>An AI-powered traffic management simulation platform designed to analyze traffic conditions, optimize traffic signals, predict congestion, and prioritize emergency vehicles.</p>
            <div className="hero-actions">
              <Link to="/dashboard"><Button>Explore dashboard <ArrowRight size={17} /></Button></Link>
              <a href="#simulation-preview"><Button variant="secondary">View Simulation</Button></a>
            </div>
          </div>
          <Card className="hero-signal">
            <div className="signal-map">
              <div className="road road-horizontal" />
              <div className="road road-vertical" />
              <div className="signal-center">
                <span className="signal-light red" />
                <span className="signal-light yellow" />
                <span className="signal-light green" />
              </div>
              <div className="map-pin pin-a"><MapPin size={16} /></div>
              <div className="map-pin pin-b"><MapPin size={16} /></div>
              <div className="flow-path" />
            </div>
            <div className="signal-footer">
              <div><span>Workspace state</span><strong><i /> Prototype mode</strong></div>
              <div><span>Controller preview</span><strong>Adaptive · not connected</strong></div>
            </div>
            <SampleDataNote />
          </Card>
        </section>
        <section className="capabilities" id="capabilities">
          {[
            { icon: BrainCircuit, title: 'Adaptive intelligence', text: 'Prepare signal decisions for AI-assisted control.' },
            { icon: TrafficCone, title: 'Congestion awareness', text: 'Monitor queues and travel flow across intersections.' },
            { icon: ShieldCheck, title: 'Emergency priority', text: 'Design workflows that prioritize critical vehicle routes.' },
          ].map(({ icon: Icon, title, text }) => (
            <Card className="capability-card" key={title}>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{text}</p>
            </Card>
          ))}
        </section>
        <section className="landing-section">
          <div className="section-heading"><span className="eyebrow">One connected workflow</span><h2>Traffic operations, made clearer.</h2><p>SmartFlow AI brings simulation, adaptive control concepts, and traffic insights into a unified workspace.</p></div>
          <div className="intro-grid">
            <Card className="intro-card"><span className="intro-number">01</span><h3>Observe conditions</h3><p>Review queues, approach demand, and intersection states in one view.</p></Card>
            <Card className="intro-card"><span className="intro-number">02</span><h3>Compare strategies</h3><p>Explore fixed-time and adaptive controller concepts with transparent sample data.</p></Card>
            <Card className="intro-card"><span className="intro-number">03</span><h3>Plan a response</h3><p>Surface congestion trends and emergency workflows for future backend integration.</p></Card>
          </div>
        </section>
        <section className="landing-section preview-section" id="simulation-preview">
          <div className="section-heading"><span className="eyebrow">Simulation preview</span><h2>A safer way to explore traffic flow.</h2><p>Interactive prototypes make traffic scenarios easy to inspect before a simulation backend is connected.</p></div>
          <Card className="preview-card"><div className="preview-junction"><span>SAMPLE</span><i /><i /><i /><i /><b>+</b></div><div><SampleDataNote /><h3>Visualize approaches and signal phases</h3><p>See directional queues, vehicle categories, and signal state in an illustrative four-way junction.</p><Link to="/simulation">Open simulation <ArrowRight size={15} /></Link></div></Card>
        </section>
        <section className="landing-section landing-highlight">
          <div className="section-heading"><span className="eyebrow">Designed for the next step</span><h2>Adaptive traffic management, prepared for integration.</h2><p>Frontend capabilities are ready to connect with a FastAPI service, SUMO/TraCI simulation, and future model outputs. No live control is implied here.</p></div>
          <div className="feature-pills"><span>Queue monitoring</span><span>Traffic prediction UI</span><span>Emergency priority workflow</span><span>Signal performance comparison</span></div>
        </section>
        <section className="landing-section tech-section">
          <div className="section-heading"><span className="eyebrow">Technology foundation</span><h2>Built to grow with your system.</h2></div>
          <div className="tech-list">{['React + TypeScript', 'Vite', 'Tailwind CSS', 'React Router', 'Recharts', 'Leaflet', 'FastAPI ready', 'SUMO ready'].map((item) => <span key={item}><Waypoints size={15} />{item}</span>)}</div>
        </section>
        <section className="landing-section objectives-section">
          <div className="section-heading"><span className="eyebrow">Project objectives</span><h2>What SmartFlow AI is designed to support.</h2></div>
          <div className="feature-pills"><span>Simulate intersection traffic</span><span>Monitor vehicle queues</span><span>Compare signal strategies</span><span>Forecast congestion</span><span>Prioritize emergency response</span><span>Review operational reports</span></div>
        </section>
        <section className="landing-cta-section"><h2>Explore the SmartFlow workspace</h2><p>Move from overview to traffic operations in one click.</p><Link to="/dashboard"><Button>Explore Dashboard <ArrowRight size={16} /></Button></Link></section>
      </main>
      <footer className="landing-footer"><Link className="landing-brand" to="/"><div className="brand-mark">S</div><div><strong>SmartFlow</strong><span>AI</span></div></Link><span>Smarter Signals. Faster Movement. Safer Roads.</span><span>Frontend prototype · Not connected to live traffic</span></footer>
    </div>
  )
}

function SampleDataNote() { return <span className="demo-label">Sample traffic data — illustrative values, not live measurements.</span> }

function NotFoundPage() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>Route not found</h1>
      <p>This page is outside the SmartFlow navigation map.</p>
      <div className="not-found-actions"><Link to="/dashboard"><Button>Return to Dashboard</Button></Link><Link to="/"><Button variant="secondary">Return Home</Button></Link></div>
    </div>
  )
}

function ShellPage({ children }: { children: React.ReactNode }) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  )
}

function RouteLoading() {
  return <div className="page-loading" role="status" aria-live="polite">Loading page…</div>
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="not-found" role="alert">
          <span>!</span>
          <h1>This view could not be loaded</h1>
          <p>Refresh the app or return to the dashboard. No live traffic or database data was changed.</p>
          <div className="not-found-actions">
            <Button onClick={() => window.location.reload()}>Reload app</Button>
            <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>Dashboard</Button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="/dashboard" element={<ShellPage><Suspense fallback={<RouteLoading />}><DashboardPage /></Suspense></ShellPage>} />
      <Route path="/simulation" element={<ShellPage><Suspense fallback={<RouteLoading />}><SimulationPage /></Suspense></ShellPage>} />
      <Route path="/ai-control" element={<ShellPage><Suspense fallback={<RouteLoading />}><AIControlPage /></Suspense></ShellPage>} />
      <Route path="/emergency" element={<ShellPage><Suspense fallback={<RouteLoading />}><EmergencyPage /></Suspense></ShellPage>} />
      <Route path="/heatmap" element={<ShellPage><Suspense fallback={<RouteLoading />}><HeatmapPage /></Suspense></ShellPage>} />
      <Route path="/prediction" element={<ShellPage><Suspense fallback={<RouteLoading />}><PredictionPage /></Suspense></ShellPage>} />
      <Route path="/analytics" element={<ShellPage><Suspense fallback={<RouteLoading />}><AnalyticsPage /></Suspense></ShellPage>} />
      <Route path="/history" element={<ShellPage><Suspense fallback={<RouteLoading />}><HistoryPage /></Suspense></ShellPage>} />
      <Route path="/settings" element={<ShellPage><Suspense fallback={<RouteLoading />}><SettingsPage /></Suspense></ShellPage>} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </AppErrorBoundary>
  )
}

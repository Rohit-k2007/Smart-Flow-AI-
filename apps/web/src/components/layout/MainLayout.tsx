import { useState, type ReactNode } from 'react'
import { AppSidebar } from './AppSidebar'
import { TopNavbar } from './TopNavbar'

export function MainLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <AppSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((value) => !value)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <TopNavbar onMenu={() => setMobileOpen(true)} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}

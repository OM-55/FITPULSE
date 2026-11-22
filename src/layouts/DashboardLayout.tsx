import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { APP_NAME } from '../lib/constants'
import Avatar from '../components/Avatar'
import {
  LayoutDashboard, Dumbbell, UtensilsCrossed, BookOpen, BarChart3,
  User, Settings, Shield, LogOut, Menu, X, Zap, Search
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/workouts', label: 'Workouts', icon: Dumbbell },
  { path: '/diet', label: 'Diet', icon: UtensilsCrossed },
  { path: '/plans', label: 'Plan Library', icon: BookOpen },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/explore', label: 'Find Users', icon: Search },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
]

const mobileNavItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/workouts/today', label: 'Workout', icon: Dumbbell },
  { path: '/diet/today', label: 'Diet', icon: UtensilsCrossed },
  { path: '/plans', label: 'Plans', icon: BookOpen },
  { path: '/analytics', label: 'Stats', icon: BarChart3 },
]

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { profile, signOut, isAdmin } = useAuth()

  const allNavItems = isAdmin
    ? [...navItems.slice(0, -1), { path: '/admin', label: 'Admin', icon: Shield }, navItems[navItems.length - 1]]
    : navItems

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-bg-secondary fixed h-full z-30">
        <div className="p-5 border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="text-lg font-bold text-text-primary">{APP_NAME}</span>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent-muted text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link to="/profile" className="flex items-center gap-3 mb-3 hover:opacity-90">
            <Avatar url={profile?.avatar_url} name={profile?.display_name} username={profile?.username} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {profile?.display_name || profile?.username}
              </p>
              <p className="text-xs text-text-muted truncate">@{profile?.username}</p>
            </div>
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-danger transition-colors w-full px-2 py-1.5"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4 z-30">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" />
          </div>
          <span className="text-base font-bold text-text-primary">{APP_NAME}</span>
        </Link>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-text-secondary" aria-label="Toggle menu">
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-bg-secondary border-r border-border flex flex-col">
            <div className="p-5 border-b border-border">
              <Link to="/dashboard" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-black" />
                </div>
                <span className="text-lg font-bold text-text-primary">{APP_NAME}</span>
              </Link>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
              {allNavItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-accent-muted text-accent'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  signOut()
                  setSidebarOpen(false)
                }}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-danger transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 min-w-0">
        <div className="pt-14 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-secondary border-t border-border flex items-center justify-around z-30">
        {mobileNavItems.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.path || location.pathname.startsWith(item.path.split('/')[1] ? `/${item.path.split('/')[1]}` : item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-2 py-1 ${active ? 'text-accent' : 'text-text-muted'}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px]">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

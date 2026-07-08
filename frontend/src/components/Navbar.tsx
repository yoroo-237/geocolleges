import { NavLink, useNavigate } from 'react-router-dom'
import { Map, LayoutDashboard, Home, Sun, Moon, LogOut, ShieldCheck, Menu, X, Search } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

const links = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/recherche', label: 'Recherche', icon: Search },
  { to: '/carte', label: 'Carte', icon: Map },
  { to: '/statistiques', label: 'Statistiques', icon: LayoutDashboard },
  { to: '/a-propos', label: 'À propos', icon: ShieldCheck },
]

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-4 z-50 mx-4">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5 shadow-card">
        <NavLink to="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <img src="/logo.png" alt="GeoColleges" className="h-8 w-8 rounded-lg object-contain" />
          <span className="hidden sm:inline">GeoColleges</span>
          <span className="hidden sm:inline text-primary-600">IV</span>
        </NavLink>

        <div className="hidden md:flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
          {isAuthenticated && (user?.role === 'admin' || user?.role === 'gestionnaire') && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer',
                  isActive ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )
              }
            >
              <ShieldCheck size={16} /> Admin
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Changer de thème"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => { logout(); navigate('/') }}
              className="btn-secondary !py-2 !px-3 hidden sm:flex"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          ) : (
            <NavLink to="/connexion" className="btn-primary !py-2 !px-3.5 hidden sm:flex">
              Connexion
            </NavLink>
          )}

          <button
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass mx-auto mt-2 flex max-w-7xl flex-col gap-1 rounded-2xl p-3 md:hidden animate-fadeUp">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              <Icon size={16} /> {label}
            </NavLink>
          ))}
          {isAuthenticated ? (
            <button onClick={() => { logout(); setOpen(false) }} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-left hover:bg-slate-100 dark:hover:bg-slate-800">
              <LogOut size={16} /> Déconnexion
            </button>
          ) : (
            <NavLink to="/connexion" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
              Connexion
            </NavLink>
          )}
        </div>
      )}
    </header>
  )
}

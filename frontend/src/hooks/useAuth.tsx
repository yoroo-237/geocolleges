import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { api } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name?: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('gc_user')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('gc_token', data.access_token)
    localStorage.setItem('gc_user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string, full_name?: string) => {
    await api.post('/auth/register', { email, password, full_name })
    await login(email, password)
  }, [login])

  const logout = useCallback(() => {
    localStorage.removeItem('gc_token')
    localStorage.removeItem('gc_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

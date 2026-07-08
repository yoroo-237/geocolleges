import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, UserPlus, Mail, Lock, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, fullName)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card w-full p-8">
        <h1 className="text-xl font-extrabold">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login' ? 'Accédez à votre espace GeoColleges.' : 'Rejoignez la plateforme en tant que consultant.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Nom complet</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" required className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="password" required minLength={6} className="input pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-4 w-full text-center text-xs font-medium text-primary-600 hover:underline cursor-pointer"
        >
          {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>

        <p className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 text-[11px] text-slate-500">
          Compte admin par défaut : <strong>admin@geocolleges.cm</strong> / <strong>Admin123!</strong> (à changer après la première connexion).
        </p>
      </motion.div>
    </div>
  )
}

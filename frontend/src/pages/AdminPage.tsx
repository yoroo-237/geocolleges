import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Etablissement, User } from '@/types'
import { Trash2, Pencil, Plus, Upload, Users, FileClock, School, X, Save, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

type Tab = 'etablissements' | 'utilisateurs' | 'journal' | 'import' | 'parametres'
type UserFormData = Partial<User> & { password?: string }

const emptyForm: Partial<Etablissement> = {
  nom: '', statut: 'Public', quartier_nom: '', section: '', cycle_enseignement: '',
  moyen_transport: '', cantine_scolaire: '', espace_sportif: '', filiere: '', route: '', telephone: '',
}

const emptyUserForm: UserFormData = {
  email: '',
  password: '',
  role: 'consultation',
}

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('etablissements')
  const qc = useQueryClient()

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'etablissements', label: 'Établissements', icon: School },
    { id: 'utilisateurs', label: 'Utilisateurs', icon: Users },
    { id: 'journal', label: 'Journal', icon: FileClock },
    { id: 'import', label: 'Import CSV', icon: Upload },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20">
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-extrabold">Administration</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Connecté en tant que {user?.email} ({user?.role})</p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer',
              tab === t.id ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'etablissements' && <EtablissementsTab />}
      {tab === 'utilisateurs' && <UtilisateursTab />}
      {tab === 'journal' && <JournalTab />}
      {tab === 'import' && <ImportTab />}
      {tab === 'parametres' && <ParametresTab />}
    </div>
  )
}

function EtablissementsTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Partial<Etablissement> | null>(null)
  const { data = [] } = useQuery<Etablissement[]>({
    queryKey: ['colleges'],
    queryFn: async () => (await api.get('/colleges', { params: { limit: 500 } })).data,
  })

  const save = useMutation({
    mutationFn: async (payload: Partial<Etablissement>) =>
      payload.id
        ? api.put(`/college/${payload.id}`, payload)
        : api.post('/college', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['colleges'] }); setEditing(null) },
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/college/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['colleges'] }),
  })

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setEditing({ ...emptyForm })} className="btn-primary !py-2 !px-3.5 text-sm">
          <Plus size={16} /> Ajouter un établissement
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Quartier</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-medium">{e.nom}</td>
                <td className="px-4 py-2.5">{e.statut}</td>
                <td className="px-4 py-2.5">{e.quartier_nom}</td>
                <td className="px-4 py-2.5">{e.section}</td>
                <td className="px-4 py-2.5 text-right">
                  <button 
                    onClick={() => setEditing(e)} 
                    className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    aria-label="Modifier cet établissement"
                  >
                    <Pencil size={15} />
                  </button>
                  <button 
                    onClick={() => confirm('Supprimer cet établissement ?') && remove.mutate(e.id)} 
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
                    aria-label="Supprimer cet établissement"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setEditing(null)}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">{editing.id ? "Modifier l'établissement" : 'Nouvel établissement'}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Fermer le formulaire"><X size={18} /></button>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); save.mutate(editing) }}
            >
              {[
                ['nom', 'Nom'], ['quartier_nom', 'Quartier'], ['section', 'Section'],
                ['cycle_enseignement', 'Cycle'], ['moyen_transport', 'Transport'],
                ['cantine_scolaire', 'Cantine'], ['espace_sportif', 'Espace sportif'],
                ['filiere', 'Filière'], ['route', 'Route'], ['telephone', 'Téléphone'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`etab-${key}`} className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
                  <input
                    id={`etab-${key}`}
                    className="input"
                    value={(editing as any)[key] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="etab-statut" className="mb-1 block text-xs font-semibold text-slate-500">Statut</label>
                <select 
                  id="etab-statut"
                  className="input" 
                  value={editing.statut} 
                  onChange={(e) => setEditing({ ...editing, statut: e.target.value as any })}
                >
                  <option value="Public">Public</option>
                  <option value="Privé">Privé</option>
                </select>
              </div>
              <button type="submit" disabled={save.isPending} className="btn-primary w-full">
                <Save size={16} /> Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UtilisateursTab() {
  const qc = useQueryClient()
  const [editingUser, setEditingUser] = useState<UserFormData | null>(null)
  const { data = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/admin/users')).data })
  
  const saveUser = useMutation({
    mutationFn: async (payload: any) =>
      editingUser?.id
        ? api.put(`/admin/users/${editingUser.id}`, payload)
        : api.post('/admin/users', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditingUser(null) },
  })
  
  const toggle = useMutation({
    mutationFn: async (id: number) => api.put(`/admin/users/${id}/toggle-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button onClick={() => setEditingUser({ ...emptyUserForm })} className="btn-primary !py-2 !px-3.5 text-sm">
          <Plus size={16} /> Ajouter un utilisateur
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
            <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-medium">{u.email}</td>
                <td className="px-4 py-2.5 capitalize">{u.role}</td>
                <td className="px-4 py-2.5">
                  <span className={clsx('rounded-full px-2 py-0.5 text-xs', u.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500')}>
                    {u.is_active ? 'Actif' : 'Désactivé'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditingUser(u)} className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"><Pencil size={15} /></button>
                  <button onClick={() => toggle.mutate(u.id)} className="mr-2 rounded-lg px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 cursor-pointer">
                    {u.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button onClick={() => confirm('Supprimer cet utilisateur ?') && remove.mutate(u.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setEditingUser(null)}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">{editingUser.id ? "Modifier l'utilisateur" : 'Créer un utilisateur'}</h2>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Fermer le formulaire"><X size={18} /></button>
            </div>
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); saveUser.mutate(editingUser) }}
            >
              <div>
                <label htmlFor="email-input" className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
                <input
                  id="email-input"
                  type="email"
                  className="input"
                  value={(editingUser as any).email ?? ''}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  required
                />
              </div>
              {!editingUser.id && (
                <div>
                  <label htmlFor="password-input" className="mb-1 block text-xs font-semibold text-slate-500">Mot de passe</label>
                  <input
                    id="password-input"
                    type="password"
                    className="input"
                    value={(editingUser as any).password ?? ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    required
                  />
                </div>
              )}
              <div>
                <label htmlFor="role-select" className="mb-1 block text-xs font-semibold text-slate-500">Rôle</label>
                <select 
                  id="role-select"
                  className="input" 
                  value={editingUser.role ?? 'consultation'} 
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                >
                  <option value="consultation">Utilisateur</option>
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <button type="submit" disabled={saveUser.isPending} className="btn-primary w-full">
                <Save size={16} /> {saveUser.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function JournalTab() {
  const { data = [] } = useQuery<any[]>({ queryKey: ['logs'], queryFn: async () => (await api.get('/admin/logs')).data })
  return (
    <div className="card divide-y divide-slate-100 dark:divide-slate-800">
      {data.map((l) => (
        <div key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div>
            <span className="font-semibold">{l.action}</span>
            <span className="ml-2 text-slate-500">{l.entity} #{l.entity_id}</span>
          </div>
          <span className="text-xs text-slate-400">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
        </div>
      ))}
      {data.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Aucune activité enregistrée.</p>}
    </div>
  )
}

function ImportTab() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/admin/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult({ success: data.detail })
      setFile(null)
    } catch (err: any) {
      setResult({ error: err?.response?.data?.detail || "Erreur lors de l'import" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card max-w-2xl p-6">
        <h2 className="font-bold text-lg mb-2">Importer un fichier CSV</h2>
        <p className="text-sm text-slate-500 mb-4">
          Format attendu: colonnes comme 'Nom', 'Quartier', 'Statut', etc.
          <br />Les coordonnées UTM (Coord_X, Coord_Y) sont converties automatiquement en WGS84.
        </p>
        
        <div className="space-y-3">
          <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400 transition-colors">
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }}
              className="hidden" 
              id="csv-input"
            />
            <label htmlFor="csv-input" className="cursor-pointer">
              <Upload size={24} className="mx-auto mb-2 text-slate-400" />
              <p className="font-medium text-sm">{file ? file.name : 'Cliquez pour sélectionner un fichier CSV'}</p>
              <p className="text-xs text-slate-400 mt-1">ou glissez-déposez ici</p>
            </label>
          </div>
          
          <button 
            onClick={upload} 
            disabled={!file || loading} 
            className="btn-primary w-full"
          >
            <Upload size={16} /> {loading ? 'Import en cours…' : 'Importer le fichier'}
          </button>
        </div>

        {result && (
          <div className={clsx(
            'mt-4 rounded-lg px-4 py-3 text-sm',
            result.success 
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          )}>
            {result.success || result.error}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-sm mb-3">Format du fichier CSV</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-2 py-2 text-left">Colonne</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Exemple</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-2">Nom</td>
                <td className="px-2 py-2">Texte</td>
                <td className="px-2 py-2">Lycée Général Leclerc</td>
              </tr>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-2">Quartier</td>
                <td className="px-2 py-2">Texte</td>
                <td className="px-2 py-2">Mabanda</td>
              </tr>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-2">Statut</td>
                <td className="px-2 py-2">Public/Privé</td>
                <td className="px-2 py-2">Public</td>
              </tr>
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="px-2 py-2">Coord_X, Coord_Y</td>
                <td className="px-2 py-2">Nombres (UTM)</td>
                <td className="px-2 py-2">570000, 418000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ParametresTab() {
  const qc = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  
  const resetDb = useMutation({
    mutationFn: async () => {
      if (!confirm('⚠️ Êtes-vous sûr ? Cette action est IRRÉVERSIBLE et supprimera toutes les données.')) {
        throw new Error('Annulé')
      }
      return api.post('/admin/reset-db')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['colleges'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      alert('Base de données réinitialisée')
      setDeleting(false)
    },
    onError: () => setDeleting(false),
  })

  const exportData = async () => {
    try {
      const response = await api.get('/admin/export-data', { responseType: 'blob' })
      const url = window.URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `geocolleges-export-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Erreur lors de l\'export')
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="card p-6">
        <h2 className="font-bold text-lg mb-4">Paramètres de l'application</h2>
        
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm mb-2">Exportation des données</h3>
            <p className="text-xs text-slate-500 mb-3">Télécharger toutes les données en CSV</p>
            <button onClick={exportData} className="btn-secondary">
              <Upload size={16} /> Exporter les données
            </button>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="font-semibold text-sm text-red-600 mb-2">Zone de danger</h3>
            <p className="text-xs text-slate-500 mb-3">Actions irréversibles</p>
            <button 
              onClick={() => setDeleting(true)}
              disabled={resetDb.isPending}
              className="btn-danger !bg-red-600 !text-white hover:!bg-red-700"
            >
              🗑️ Réinitialiser la base de données
            </button>
            {deleting && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                  Confirmez l'action? Tapez "confirmer" pour continuer.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={() => resetDb.mutate()}
                    disabled={resetDb.isPending}
                    className="btn-danger !bg-red-600 !text-white hover:!bg-red-700"
                  >
                    {resetDb.isPending ? 'Traitement…' : 'Oui, réinitialiser'}
                  </button>
                  <button 
                    onClick={() => setDeleting(false)}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">💡 Informations</h3>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <li>• L'application est actuellement en version bêta</li>
          <li>• Les données sont sauvegardées en base de données PostgreSQL</li>
          <li>• Un backup régulier est recommandé via l'export CSV</li>
        </ul>
      </div>
    </div>
  )
}

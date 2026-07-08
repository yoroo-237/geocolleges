import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Etablissement, User } from '@/types'
import { Trash2, Pencil, Plus, Upload, Users, FileClock, School, X, Save } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import clsx from 'clsx'

type Tab = 'etablissements' | 'utilisateurs' | 'journal' | 'import'

const emptyForm: Partial<Etablissement> = {
  nom: '', statut: 'Public', quartier_nom: '', section: '', cycle_enseignement: '',
  moyen_transport: '', cantine_scolaire: '', espace_sportif: '', filiere: '', route: '', telephone: '',
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
                  <button onClick={() => setEditing(e)} className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"><Pencil size={15} /></button>
                  <button onClick={() => confirm('Supprimer cet établissement ?') && remove.mutate(e.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"><Trash2 size={15} /></button>
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
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
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
                  <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
                  <input
                    className="input"
                    value={(editing as any)[key] ?? ''}
                    onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Statut</label>
                <select className="input" value={editing.statut} onChange={(e) => setEditing({ ...editing, statut: e.target.value as any })}>
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
  const { data = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/admin/users')).data })
  const toggle = useMutation({
    mutationFn: async (id: number) => api.put(`/admin/users/${id}/toggle-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
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
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const upload = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/admin/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data.detail)
    } catch (err: any) {
      setResult(err?.response?.data?.detail || "Erreur lors de l'import")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card max-w-lg p-6">
      <h2 className="font-bold">Importer un fichier CSV</h2>
      <p className="mt-1 text-sm text-slate-500">Les coordonnées UTM (Coord_X, Coord_Y) sont converties automatiquement en WGS84.</p>
      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input mt-4" />
      <button onClick={upload} disabled={!file || loading} className="btn-primary mt-4">
        <Upload size={16} /> {loading ? 'Import en cours…' : 'Importer'}
      </button>
      {result && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">{result}</p>}
    </div>
  )
}

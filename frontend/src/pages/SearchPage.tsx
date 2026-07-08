import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, SlidersHorizontal, X, ChevronRight,
  Bus, UtensilsCrossed, Trophy, Phone, MapPin,
  BookOpen, Layers, Route, RotateCcw, Sparkles, Menu,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Etablissement, SearchFilters, SearchOptions } from '@/types'
import clsx from 'clsx'

const LIMIT = 20

function Select({
  label, value, options, onChange, icon: Icon,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-1">
      <label id={`select-${label}`} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}
      </label>
      <select
        aria-labelledby={`select-${label}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
      >
        <option value="">Tous</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    red:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    blue:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[color])}>
      {children}
    </span>
  )
}

const EMPTY: SearchFilters = {}

const FILTER_LABELS: Record<string, string> = {
  q: 'Recherche',
  nom: 'Nom',
  quartier: 'Quartier',
  statut: 'Statut',
  type_enseignement: "Type d'enseignement",
  section: 'Section',
  cycle: 'Cycle',
  filiere: 'Filière',
  route: 'Route',
  moyen_transport: 'Transport',
  cantine_scolaire: 'Cantine',
  espace_sportif: 'Espace sportif',
  telephone: 'Téléphone',
  fuzzy: 'Recherche floue',
}

export default function SearchPage() {
  const [, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<SearchFilters>(EMPTY)
  const [showFilters, setShowFilters] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768)
  const [page, setPage] = useState(1)
  const [aiMode, setAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [submittedAiQuery, setSubmittedAiQuery] = useState('')
  const [submittedFilters, setSubmittedFilters] = useState<SearchFilters>(EMPTY)
  const [parsedAiFilters, setParsedAiFilters] = useState<Record<string, unknown> | null>(null)

  useEffect(() => { setPage(1) }, [submittedFilters, aiMode, submittedAiQuery])

  const set = (key: keyof SearchFilters, value: unknown) =>
    setFilters(prev => ({ ...prev, [key]: value === '' ? undefined : value }))

  const reset = () => {
    setFilters(EMPTY); setSubmittedFilters(EMPTY)
    setAiQuery(''); setSubmittedAiQuery('')
    setPage(1); setSearchParams({})
  }

  const runSearch = () => { setSubmittedFilters(filters); setPage(1) }

  const removeSubmittedFilter = (key: keyof SearchFilters) => {
    setFilters(prev => { const n = { ...prev }; delete n[key]; return n })
    setSubmittedFilters(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const runAiSearch = () => {
    const trimmed = aiQuery.trim()
    if (!trimmed) return
    setSubmittedAiQuery(trimmed)
    setPage(1)
  }

  const { data: options } = useQuery<SearchOptions>({
    queryKey: ['search-options'],
    queryFn: async () => (await api.get('/search/options')).data,
    staleTime: 5 * 60 * 1000,
  })

  const params = Object.fromEntries(
    Object.entries({ ...submittedFilters, page, limit: LIMIT })
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => [k, String(v)])
  )

  const { data: results, isFetching } = useQuery<Etablissement[]>({
    queryKey: aiMode ? ['search-ai', submittedAiQuery, page] : ['search', params],
    queryFn: async () => {
      if (aiMode && submittedAiQuery) {
        const resp = await api.get('/search/ai', { params: { query: submittedAiQuery, page, limit: LIMIT } })
        const raw = resp.headers['x-parsed-filters']
        try { setParsedAiFilters(raw ? JSON.parse(raw) : null) } catch { setParsedAiFilters(null) }
        return resp.data
      }
      setParsedAiFilters(null)
      return (await api.get('/search', { params })).data
    },
    enabled: aiMode ? Boolean(submittedAiQuery) : true,
    placeholderData: prev => prev,
  })

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '').length
  const submittedCount = Object.values(submittedFilters).filter(v => v !== undefined && v !== '').length
  const hasPendingChanges = !aiMode && JSON.stringify(filters) !== JSON.stringify(submittedFilters)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24">
      {/* Header */}
      <div className="mt-2 mb-4">
        <h1 className="text-2xl font-extrabold">Recherche d'établissements</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Les options de chaque filtre sont issues directement de la base de données.
        </p>
      </div>

      {/* Barre recherche IA */}
      <div className="mb-6 card p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setAiMode(m => !m)}
            aria-label="Activer la recherche IA"
            className={clsx(
              'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
              aiMode
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            <Sparkles size={13} />
            Recherche IA DeepSeek
          </button>
          {aiMode && (
            <span className="text-xs text-violet-500 dark:text-violet-400">
              Décrivez votre recherche en langage naturel
            </span>
          )}
        </div>

        {aiMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative"
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400">
              <Sparkles size={16} />
            </div>
            <input
              type="text"
              placeholder='Ex : "lycée public avec bus et cantine à Mabanda" ou "collège bilingue technique"'
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runAiSearch()
                }
              }}
              className="w-full rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 pl-9 pr-24 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-400"
            />
            {aiQuery && (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => setAiQuery('')}
                className="absolute right-20 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={runAiSearch}
              disabled={!aiQuery.trim() || isFetching}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
            >
              {isFetching ? '…' : 'Rechercher'}
            </button>
            {isFetching && submittedAiQuery && (
              <p className="mt-1.5 text-xs text-violet-500 animate-pulse flex items-center gap-1">
                <Sparkles size={11} /> DeepSeek interprète votre requête…
              </p>
            )}
            {!isFetching && parsedAiFilters && Object.keys(parsedAiFilters).length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-400">DeepSeek a compris :</span>
                {Object.entries(parsedAiFilters).map(([k, v]) => {
                  if (v === undefined || v === null) return null
                  const label = k === 'q' ? `"${v}"` : k === 'fuzzy' ? 'Fuzzy' : `${FILTER_LABELS[k] ?? k} : ${v}`
                  return (
                    <span key={k} className="rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2.5 py-0.5 text-xs font-medium">
                      {label}
                    </span>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Panneau filtres */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.aside
              key="filters"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="fixed md:static inset-0 md:inset-auto z-[9999] md:z-auto md:flex flex-col gap-4 w-full md:w-72 shrink-0"
            >
              <div className="card p-4 flex flex-col gap-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-1.5">
                    Filtres
                    {submittedCount > 0 && (
                      <span className="rounded-full bg-primary-600 text-white px-1.5 py-0.5 text-xs">{submittedCount}</span>
                    )}
                    {hasPendingChanges && (
                      <span className="rounded-full bg-amber-400 w-2 h-2 inline-block" title="Filtres non appliqués" />
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeCount > 0 && (
                      <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 cursor-pointer">
                        <RotateCcw size={12} /> Réinitialiser
                      </button>
                    )}
                    {/* Bouton fermeture mobile */}
                    <button 
                      onClick={() => setShowFilters(false)}
                      className="md:hidden text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Fermer les filtres"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Recherche libre */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Search size={12} /> Recherche libre
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Nom, quartier, filière…"
                      value={filters.q ?? ''}
                      onChange={e => set('q', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {filters.q && (
                      <button 
                        onClick={() => set('q', undefined)} 
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Effacer la recherche"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer mt-0.5">
                    <input
                      type="checkbox"
                      checked={!!filters.fuzzy}
                      onChange={e => set('fuzzy', e.target.checked || undefined)}
                      className="rounded"
                    />
                    Tolérer les fautes (fuzzy)
                  </label>
                </div>

                {options && (
                  <>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />

                    {/* Critères établissement */}
                    <Select
                      label="Quartier"
                      value={filters.quartier ?? ''}
                      options={options.quartiers}
                      onChange={v => set('quartier', v)}
                      icon={MapPin}
                    />
                    <Select
                      label="Statut"
                      value={filters.statut ?? ''}
                      options={options.statuts}
                      onChange={v => set('statut', v)}
                    />
                    <Select
                      label="Type d'enseignement"
                      value={filters.type_enseignement ?? ''}
                      options={options.types_enseignement}
                      onChange={v => set('type_enseignement', v)}
                      icon={BookOpen}
                    />
                    <Select
                      label="Section"
                      value={filters.section ?? ''}
                      options={options.sections}
                      onChange={v => set('section', v)}
                    />
                    <Select
                      label="Cycle d'enseignement"
                      value={filters.cycle ?? ''}
                      options={options.cycles}
                      onChange={v => set('cycle', v)}
                      icon={Layers}
                    />
                    <Select
                      label="Filière"
                      value={filters.filiere ?? ''}
                      options={options.filieres}
                      onChange={v => set('filiere', v)}
                    />

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />

                    {/* Infrastructures */}
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide -mb-1">Infrastructures</p>
                    <Select
                      label="Type de route"
                      value={filters.route ?? ''}
                      options={options.routes}
                      onChange={v => set('route', v)}
                      icon={Route}
                    />
                    <Select
                      label="Transport scolaire"
                      value={filters.moyen_transport ?? ''}
                      options={options.moyens_transport}
                      onChange={v => set('moyen_transport', v)}
                      icon={Bus}
                    />
                    <Select
                      label="Cantine scolaire"
                      value={filters.cantine_scolaire ?? ''}
                      options={options.cantines}
                      onChange={v => set('cantine_scolaire', v)}
                      icon={UtensilsCrossed}
                    />
                    <Select
                      label="Espace sportif"
                      value={filters.espace_sportif ?? ''}
                      options={options.espaces_sportifs}
                      onChange={v => set('espace_sportif', v)}
                      icon={Trophy}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={runSearch}
                  disabled={isFetching}
                  className={clsx(
                    'mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2',
                    hasPendingChanges
                      ? 'bg-primary-600 text-white hover:bg-primary-700 cursor-pointer shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700'
                  )}
                >
                  <Search size={14} />
                  {isFetching ? 'Recherche…' : hasPendingChanges ? 'Appliquer les filtres' : 'Rechercher'}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Overlay backdrop mobile */}
        {showFilters && (
          <div 
            onClick={() => setShowFilters(false)}
            className="md:hidden fixed inset-0 bg-black/40 z-[9998]"
          />
        )}

        {/* Résultats */}
        <div className="flex-1 min-w-0">
          {/* Barre d'actions */}
          <div className="flex items-center gap-3 mb-4 relative z-50">
            <button
              onClick={() => setShowFilters(s => !s)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors relative z-50"
            >
              <SlidersHorizontal size={16} />
              <span className="hidden md:inline">
                {showFilters ? 'Masquer' : 'Filtres'}
              </span>
              {!showFilters && submittedCount > 0 && (
                <span className="rounded-full bg-primary-600 text-white px-1.5 py-0.5 text-xs">{submittedCount}</span>
              )}
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {isFetching
                ? <span className="animate-pulse">Recherche…</span>
                : <>{results?.length ?? 0} résultat{(results?.length ?? 0) !== 1 ? 's' : ''}</>
              }
            </span>
          </div>

          {/* Chips filtres actifs */}
          {submittedCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(submittedFilters) as [keyof SearchFilters, unknown][]).map(([k, v]) => {
                if (v === undefined || v === '' || v === false) return null
                const label = k === 'q' ? `"${v}"` : k === 'fuzzy' ? 'Fuzzy' : FILTER_LABELS[k] ? `${FILTER_LABELS[k]} : ${v}` : String(v)
                return (
                  <button
                    key={k}
                    onClick={() => removeSubmittedFilter(k)}
                    className="flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 text-xs font-medium hover:bg-primary-100 cursor-pointer transition-colors"
                  >
                    {label} <X size={11} />
                  </button>
                )
              })}
            </div>
          )}

          {/* Cards résultats */}
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {results?.map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.025 }}
                >
                  <Link
                    to={`/etablissement/${e.id}`}
                    className="card flex items-start justify-between gap-4 p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {e.nom}
                        </h3>
                        <Badge color={e.statut === 'Public' ? 'blue' : 'green'}>{e.statut}</Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {e.quartier_nom && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin size={11} /> {e.quartier_nom}
                          </span>
                        )}
                        {e.type_enseignement && <Badge>{e.type_enseignement}</Badge>}
                        {e.section && <Badge>{e.section}</Badge>}
                        {e.cycle_enseignement && <Badge>{e.cycle_enseignement}</Badge>}
                        {e.filiere && <Badge>{e.filiere}</Badge>}
                        {e.route && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Route size={11} /> {e.route}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-3">
                        {e.moyen_transport && (
                          <span className={clsx(
                            'flex items-center gap-1 text-xs font-medium',
                            e.moyen_transport.toLowerCase().includes('non')
                              ? 'text-slate-400'
                              : 'text-green-600 dark:text-green-400'
                          )}>
                            <Bus size={12} /> {e.moyen_transport}
                          </span>
                        )}
                        {e.cantine_scolaire && (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <UtensilsCrossed size={12} /> {e.cantine_scolaire}
                          </span>
                        )}
                        {e.espace_sportif && (
                          <span className={clsx(
                            'flex items-center gap-1 text-xs font-medium',
                            e.espace_sportif.toLowerCase().startsWith('pas')
                              ? 'text-slate-400'
                              : 'text-blue-600 dark:text-blue-400'
                          )}>
                            <Trophy size={12} /> {e.espace_sportif}
                          </span>
                        )}
                        {e.telephone && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Phone size={11} /> {e.telephone}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-slate-300 group-hover:text-primary-500 transition-colors mt-1" />
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>

            {results?.length === 0 && !isFetching && (
              <div className="card p-12 text-center text-slate-400">
                <Search size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Aucun établissement trouvé</p>
                <p className="text-sm mt-1">Essayez d'élargir vos critères ou d'activer la recherche floue.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {(results?.length === LIMIT || page > 1) && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <button
                disabled={!results || results.length < LIMIT}
                onClick={() => setPage(p => p + 1)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

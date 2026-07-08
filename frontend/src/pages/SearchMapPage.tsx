import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, LayersControl } from 'react-leaflet'
import MarkerClusterGroup from '@/components/MarkerClusterGroup'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Bus, UtensilsCrossed, Trophy, MapPin, Locate, Maximize, X, Phone,
  Route as RouteIcon, SlidersHorizontal, Sparkles, RotateCcw, BookOpen,
  Layers, List, Map as MapIcon, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import type { Etablissement, SearchFilters, SearchOptions } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY: SearchFilters = {}
const LIMIT = 20
const DOUALA_IV_CENTER: [number, number] = [4.03, 9.65]

const FILTER_LABELS: Record<string, string> = {
  q: 'Recherche',
  quartier: 'Quartier',
  statut: 'Statut',
  type_enseignement: 'Type',
  section: 'Section',
  cycle: 'Cycle',
  filiere: 'Filière',
  route: 'Route',
  moyen_transport: 'Transport',
  cantine_scolaire: 'Cantine',
  espace_sportif: 'Espace sportif',
}

// ─── Helper components (outside main component) ───────────────────────────────

function makeIcon(statut: string, isSelected = false, isHovered = false): L.DivIcon {
  const color = statut === 'Public' ? '#1c63e0' : '#0fb894'
  const size = isSelected ? 34 : isHovered ? 30 : 26
  const shadow = isSelected ? '0 6px 20px rgba(0,0,0,.5)' : '0 4px 10px rgba(0,0,0,.3)'
  const dot = isSelected ? 10 : 7
  const border = isSelected ? 3 : 2
  const html = `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:${shadow};border:${border}px solid white"><div style="transform:rotate(45deg);width:${dot}px;height:${dot}px;background:white;border-radius:50%"></div></div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size] })
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 0.8 })
  }, [position, map])
  return null
}

function SelectField({
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
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {Icon && <Icon size={11} />} {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
      >
        <option value="">Tous</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchMapPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setSearchParams] = useSearchParams()

  // Filter state
  const [filters, setFilters] = useState<SearchFilters>(EMPTY)
  const [submittedFilters, setSubmittedFilters] = useState<SearchFilters>(EMPTY)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  // AI search state
  const [aiMode, setAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [submittedAiQuery, setSubmittedAiQuery] = useState('')
  const [parsedAiFilters, setParsedAiFilters] = useState<Record<string, unknown> | null>(null)

  // Map / selection state
  const [selected, setSelected] = useState<Etablissement | null>(null)
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)

  // Mobile layout
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')

  // Collapsible filter section
  const [filtersOpen, setFiltersOpen] = useState(true)

  const mapRef = useRef<L.Map | null>(null)
  const resultRefs = useRef<Map<number, HTMLElement>>(new Map())

  // ─── Filter helpers ──────────────────────────────────────────────────────────

  const set = (key: keyof SearchFilters, val: unknown) =>
    setFilters(prev => ({ ...prev, [key]: val === '' ? undefined : val }))

  const reset = () => {
    setFilters(EMPTY)
    setSubmittedFilters(EMPTY)
    setAiQuery('')
    setSubmittedAiQuery('')
    setParsedAiFilters(null)
    setPage(1)
    setSearchParams({})
  }

  const runSearch = () => {
    setSubmittedFilters(filters)
    setPage(1)
  }

  const removeSubmittedFilter = (key: keyof SearchFilters) => {
    setFilters(p => { const n = { ...p }; delete n[key]; return n })
    setSubmittedFilters(p => { const n = { ...p }; delete n[key]; return n })
  }

  const runAiSearch = () => {
    const t = aiQuery.trim()
    if (t) { setSubmittedAiQuery(t); setPage(1) }
  }

  // ─── Computed ────────────────────────────────────────────────────────────────

  const submittedCount = Object.values(submittedFilters).filter(v => v !== undefined && v !== '').length
  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '').length
  const hasPendingChanges = !aiMode && JSON.stringify(filters) !== JSON.stringify(submittedFilters)

  // ─── Select establishment ────────────────────────────────────────────────────

  const selectEstablishment = (e: Etablissement) => {
    setSelected(e)
    if (e.latitude && e.longitude && mapRef.current) {
      mapRef.current.flyTo([e.latitude, e.longitude], 15, { duration: 0.8 })
    }
    setTimeout(() => resultRefs.current.get(e.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
  }

  // ─── Geolocation ─────────────────────────────────────────────────────────────

  const geolocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos =>
      setUserPos([pos.coords.latitude, pos.coords.longitude])
    )
  }

  // ─── Reset page on filter/mode change ────────────────────────────────────────

  useEffect(() => { setPage(1) }, [submittedFilters, aiMode, submittedAiQuery])

  // ─── API Queries ─────────────────────────────────────────────────────────────

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

  const { data: results = [], isFetching } = useQuery<Etablissement[]>({
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

  // ─── Shared filter fields JSX ─────────────────────────────────────────────────

  const filterFields = (
    <div className="flex flex-col gap-3">
      {/* Free text search */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Search size={11} /> Recherche libre
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Nom, quartier, filière…"
            value={filters.q ?? ''}
            onChange={e => set('q', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 pl-7 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          {filters.q && (
            <button
              onClick={() => set('q', undefined)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Effacer"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {options && (
        <>
          <SelectField label="Quartier" value={filters.quartier ?? ''} options={options.quartiers} onChange={v => set('quartier', v)} icon={MapPin} />
          <SelectField label="Statut" value={filters.statut ?? ''} options={options.statuts} onChange={v => set('statut', v)} />
          <SelectField label="Type d'enseignement" value={filters.type_enseignement ?? ''} options={options.types_enseignement} onChange={v => set('type_enseignement', v)} icon={BookOpen} />
          <SelectField label="Section" value={filters.section ?? ''} options={options.sections} onChange={v => set('section', v)} />
          <SelectField label="Cycle" value={filters.cycle ?? ''} options={options.cycles} onChange={v => set('cycle', v)} icon={Layers} />
          <SelectField label="Filière" value={filters.filiere ?? ''} options={options.filieres} onChange={v => set('filiere', v)} />
          <SelectField label="Route" value={filters.route ?? ''} options={options.routes} onChange={v => set('route', v)} icon={RouteIcon} />
          <SelectField label="Transport" value={filters.moyen_transport ?? ''} options={options.moyens_transport} onChange={v => set('moyen_transport', v)} icon={Bus} />
          <SelectField label="Cantine" value={filters.cantine_scolaire ?? ''} options={options.cantines} onChange={v => set('cantine_scolaire', v)} icon={UtensilsCrossed} />
          <SelectField label="Espace sportif" value={filters.espace_sportif ?? ''} options={options.espaces_sportifs} onChange={v => set('espace_sportif', v)} icon={Trophy} />
        </>
      )}
    </div>
  )

  // ─── Sidebar JSX (shared between desktop left panel and mobile list view) ─────

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top section: header + AI + filters + chips */}
      <div className="shrink-0 p-3 space-y-3 border-b border-slate-100 dark:border-slate-800 overflow-y-auto max-h-[60%]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base text-slate-800 dark:text-slate-100">Explorer</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isFetching
                ? <span className="animate-pulse">chargement…</span>
                : <>{results.length} résultat{results.length !== 1 ? 's' : ''}</>
              }
            </span>
          </div>
          {(activeCount > 0 || submittedCount > 0 || submittedAiQuery) && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              aria-label="Réinitialiser les filtres"
            >
              <RotateCcw size={12} /> Réinitialiser
            </button>
          )}
        </div>

        {/* ── AI Search card ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAiMode(m => !m)}
              className={clsx(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                aiMode
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              )}
            >
              <Sparkles size={12} /> ✦ IA DeepSeek
            </button>
            {aiMode && (
              <span className="text-[10px] text-violet-500 dark:text-violet-400 leading-tight">
                Langage naturel
              </span>
            )}
          </div>

          <AnimatePresence initial={false}>
            {aiMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2"
              >
                <div className="relative">
                  <Sparkles size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder='Ex : "lycée public avec bus à Mabanda"'
                    value={aiQuery}
                    onChange={e => setAiQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runAiSearch() } }}
                    className="w-full rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-white dark:bg-slate-900 pl-6 pr-20 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={runAiSearch}
                    disabled={!aiQuery.trim() || isFetching}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300 transition-colors"
                  >
                    {isFetching ? '…' : 'Rechercher'}
                  </button>
                </div>

                {isFetching && submittedAiQuery && (
                  <p className="text-[10px] text-violet-500 animate-pulse flex items-center gap-1">
                    <Sparkles size={10} /> DeepSeek interprète votre requête…
                  </p>
                )}

                {!isFetching && parsedAiFilters && Object.keys(parsedAiFilters).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-slate-400">DeepSeek a compris :</span>
                    {Object.entries(parsedAiFilters).map(([k, v]) => {
                      if (v === undefined || v === null) return null
                      const label = k === 'q' ? `"${v}"` : k === 'fuzzy' ? 'Fuzzy' : `${FILTER_LABELS[k] ?? k} : ${v}`
                      return (
                        <span key={k} className="rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-medium">
                          {label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Collapsible filter section ── */}
        {!aiMode && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal size={12} />
                Filtres
                {submittedCount > 0 && (
                  <span className="rounded-full bg-primary-600 text-white px-1.5 py-0.5 text-[10px] leading-none">{submittedCount}</span>
                )}
                {hasPendingChanges && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" title="Modifications non appliquées" />
                )}
              </span>
              <ChevronRight
                size={14}
                className={clsx('transition-transform text-slate-400', filtersOpen && 'rotate-90')}
              />
            </button>

            <AnimatePresence initial={false}>
              {filtersOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pt-2 pb-3 space-y-3 border-t border-slate-100 dark:border-slate-800">
                    {filterFields}
                    <button
                      type="button"
                      onClick={runSearch}
                      disabled={isFetching}
                      className={clsx(
                        'mt-1 w-full rounded-xl px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer',
                        hasPendingChanges
                          ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      <Search size={12} />
                      {isFetching ? 'Recherche…' : hasPendingChanges ? 'Appliquer' : 'Rechercher'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Applied filter chips ── */}
        {submittedCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(submittedFilters) as [keyof SearchFilters, unknown][]).map(([k, v]) => {
              if (v === undefined || v === '' || v === false) return null
              const label = k === 'q' ? `"${v}"` : k === 'fuzzy' ? 'Fuzzy' : FILTER_LABELS[k] ? `${FILTER_LABELS[k]} : ${v}` : String(v)
              return (
                <button
                  key={k}
                  onClick={() => removeSubmittedFilter(k)}
                  className="flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 text-[10px] font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 cursor-pointer transition-colors"
                >
                  {label} <X size={10} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Results list ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Loading skeleton */}
        {isFetching && results.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Result cards */}
        {results.map(e => (
          <button
            key={e.id}
            ref={el => { el ? resultRefs.current.set(e.id, el) : resultRefs.current.delete(e.id) }}
            onClick={() => {
              selectEstablishment(e)
              if (window.innerWidth < 1024) setMobileView('map')
            }}
            onMouseEnter={() => setHoveredId(e.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={clsx(
              'w-full rounded-xl border p-3 text-left text-sm transition-all duration-150 cursor-pointer',
              selected?.id === e.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug text-sm">{e.nom}</p>
              <span className={clsx(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                e.statut === 'Public'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              )}>{e.statut}</span>
            </div>
            {e.quartier_nom && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <MapPin size={10} /> {e.quartier_nom}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2.5">
              {e.moyen_transport && !e.moyen_transport.toLowerCase().includes('non') && (
                <Bus size={12} className="text-primary-500" />
              )}
              {e.cantine_scolaire && (
                <UtensilsCrossed size={12} className="text-amber-500" />
              )}
              {e.espace_sportif && !e.espace_sportif.toLowerCase().startsWith('pas') && (
                <Trophy size={12} className="text-blue-500" />
              )}
              {e.telephone && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Phone size={10} />{e.telephone}
                </span>
              )}
              <Link
                to={`/etablissement/${e.id}`}
                onClick={ev => ev.stopPropagation()}
                className="ml-auto text-[10px] text-primary-600 hover:underline"
              >
                Voir →
              </Link>
            </div>
          </button>
        ))}

        {/* Empty state */}
        {results.length === 0 && !isFetching && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Search size={32} className="mb-3 opacity-30" />
            <p className="font-medium text-sm">Aucun établissement trouvé</p>
            <p className="text-xs mt-1">Essayez d'élargir vos critères.</p>
          </div>
        )}

        {/* Pagination */}
        {(results.length === LIMIT || page > 1) && (
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <span className="text-xs text-slate-500">Page {page}</span>
            <button
              disabled={results.length < LIMIT}
              onClick={() => setPage(p => p + 1)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-col" style={{ height: 'calc(100dvh - 5.5rem)' }}>

      {/* ── Main row ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside className={clsx(
          'flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800 overflow-hidden',
          'lg:w-[22rem] lg:shrink-0',
          mobileView === 'list' ? 'flex flex-1 w-full pb-16' : 'hidden lg:flex'
        )}>
          {sidebarContent}
        </aside>

        {/* ── MAP ── */}
        <div className={clsx('relative flex-1 overflow-hidden', mobileView === 'list' ? 'hidden lg:block' : 'block')}>
          <MapContainer
            center={DOUALA_IV_CENTER}
            zoom={13}
            className="h-full w-full"
            ref={mapRef as React.RefObject<L.Map>}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Plan">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            <MarkerClusterGroup>
              {results
                .filter(e => e.latitude && e.longitude)
                .map(e => (
                  <Marker
                    key={e.id}
                    position={[e.latitude!, e.longitude!]}
                    icon={makeIcon(e.statut, selected?.id === e.id, hoveredId === e.id)}
                    eventHandlers={{ click: () => selectEstablishment(e) }}
                  >
                    <Popup>
                      <div className="min-w-[200px] p-1">
                        <p className="font-bold text-slate-900 text-sm">{e.nom}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{e.quartier_nom} · {e.statut}</p>
                        <Link
                          to={`/etablissement/${e.id}`}
                          className="mt-2 inline-block text-xs font-semibold text-primary-600 hover:underline"
                        >
                          Voir la fiche complète →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MarkerClusterGroup>

            {userPos && (
              <CircleMarker
                center={userPos}
                radius={9}
                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.5 }}
              />
            )}

            <FlyTo
              position={
                selected?.latitude && selected?.longitude
                  ? [selected.latitude, selected.longitude]
                  : userPos
              }
            />
          </MapContainer>

          {/* ── Desktop legend ── */}
          <div className="hidden lg:block absolute left-4 top-4 z-[1000] glass rounded-xl p-3 text-xs shadow-card">
            <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-200">Légende</p>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1c63e0]" /> Public
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0fb894]" /> Privé
            </div>
          </div>

          {/* ── Geolocate button ── */}
          <button
            onClick={geolocate}
            className="absolute bottom-14 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 shadow-popup hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            aria-label="Me géolocaliser"
          >
            <Locate size={18} />
          </button>

          {/* ── Fullscreen button ── */}
          <button
            onClick={() => mapRef.current?.getContainer().requestFullscreen?.()}
            className="absolute bottom-4 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 shadow-popup hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            aria-label="Plein écran"
          >
            <Maximize size={18} />
          </button>

          {/* ── Mobile filter FAB ── */}
          <button
            onClick={() => setShowFilters(true)}
            className="lg:hidden absolute top-4 left-4 z-[1001] flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-popup px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            aria-label="Ouvrir les filtres"
          >
            <SlidersHorizontal size={14} />
            Filtres
            {submittedCount > 0 && (
              <span className="rounded-full bg-primary-600 text-white px-1.5 py-0.5 text-[10px] leading-none">{submittedCount}</span>
            )}
          </button>

          {/* ── Mobile selected establishment card ── */}
          {selected && (
            <div className="lg:hidden absolute bottom-20 left-3 right-3 z-[1000] glass rounded-xl p-3 shadow-popup">
              <button
                onClick={() => setSelected(null)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
              <p className="pr-6 font-bold text-sm text-slate-800 dark:text-slate-100">{selected.nom}</p>
              {selected.quartier_nom && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={11} /> {selected.quartier_nom}
                </p>
              )}
              {selected.telephone && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Phone size={11} /> {selected.telephone}
                </p>
              )}
              {selected.route && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <RouteIcon size={11} /> {selected.route}
                </p>
              )}
              <Link
                to={`/etablissement/${selected.id}`}
                className="mt-2.5 flex items-center justify-center gap-1 w-full rounded-xl bg-primary-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary-700 transition-colors"
              >
                Fiche complète <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom toggle bar ── */}
      <div className="fixed bottom-0 inset-x-0 z-20 lg:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 py-2 safe-area-bottom">
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          {(['map', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors cursor-pointer',
                mobileView === v
                  ? 'bg-white dark:bg-slate-900 shadow-sm text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {v === 'map'
                ? <><MapIcon size={15} /> Carte</>
                : <><List size={15} /> Liste {results.length > 0 && <span className="text-xs opacity-60">({results.length})</span>}</>
              }
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      <AnimatePresence>
        {showFilters && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setShowFilters(false)}
            />

            {/* Drawer */}
            <motion.aside
              key="drawer-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-slate-900 overflow-y-auto p-4 lg:hidden shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={() => setShowFilters(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Fermer les filtres"
              >
                <X size={20} />
              </button>

              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <SlidersHorizontal size={15} /> Filtres
                {submittedCount > 0 && (
                  <span className="rounded-full bg-primary-600 text-white px-1.5 py-0.5 text-[10px]">{submittedCount}</span>
                )}
              </h3>

              <div className="space-y-3 mb-4">
                {filterFields}
              </div>

              <button
                type="button"
                onClick={() => { runSearch(); setShowFilters(false) }}
                className="w-full rounded-xl bg-primary-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search size={14} /> Appliquer et fermer
              </button>

              {(activeCount > 0 || submittedCount > 0) && (
                <button
                  onClick={() => { reset(); setShowFilters(false) }}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer py-1.5"
                >
                  <RotateCcw size={12} /> Réinitialiser tout
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

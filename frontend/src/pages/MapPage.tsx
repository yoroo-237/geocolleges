import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, LayersControl } from 'react-leaflet'
import MarkerClusterGroup from '@/components/MarkerClusterGroup'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search, Bus, UtensilsCrossed, Trophy, MapPin, Locate, Maximize, X, Phone, Route as RouteIcon, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Etablissement } from '@/types'

const DOUALA_IV_CENTER: [number, number] = [4.03, 9.65]

function makeIcon(statut: string) {
  const color = statut === 'Public' ? '#1c63e0' : '#0fb894'
  const html = `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.3);border:2px solid white">
    <div style="transform:rotate(45deg);width:8px;height:8px;background:white;border-radius:50%"></div>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26] })
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1 })
  }, [position, map])
  return null
}

export default function MapPage() {
  const [q, setQ] = useState('')
  const [fuzzy, setFuzzy] = useState(false)
  const [filters, setFilters] = useState<{ statut?: string; bus?: boolean; cantine?: boolean; sport?: boolean; section?: string }>({})
  const [selected, setSelected] = useState<Etablissement | null>(null)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (q) { p.q = q; if (fuzzy) p.fuzzy = 'true' }
    if (filters.statut) p.statut = filters.statut
    if (filters.bus !== undefined) p.bus = String(filters.bus)
    if (filters.cantine !== undefined) p.cantine = String(filters.cantine)
    if (filters.sport !== undefined) p.sport = String(filters.sport)
    if (filters.section) p.section = filters.section
    return p
  }, [q, fuzzy, filters])

  const hasFilters = Object.keys(params).length > 0

  const { data: allColleges = [] } = useQuery<Etablissement[]>({
    queryKey: ['colleges'],
    queryFn: async () => (await api.get('/colleges', { params: { limit: 500 } })).data,
  })

  const { data: searchResults } = useQuery<Etablissement[]>({
    queryKey: ['search', params],
    queryFn: async () => (await api.get('/search', { params })).data,
    enabled: hasFilters,
  })

  const results = hasFilters ? searchResults ?? [] : allColleges

  const geolocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserPos([pos.coords.latitude, pos.coords.longitude])
    })
  }

  const toggleFilter = (key: 'bus' | 'cantine' | 'sport') => {
    setFilters((f) => ({ ...f, [key]: f[key] === true ? undefined : true }))
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-[1600px] gap-4 px-4">
      {/* SIDEBAR */}
      <aside className={clsx(
        'fixed lg:static inset-0 lg:inset-auto z-40 lg:z-auto w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-xl2 border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-card',
        showSidebar ? 'flex' : 'hidden lg:flex'
      )}>
        {/* Bouton fermeture mobile */}
        <button 
          onClick={() => setShowSidebar(false)}
          className="lg:hidden absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
          aria-label="Fermer les filtres"
        >
          <X size={20} />
        </button>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Recherche</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Nom, quartier, filière…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} className="rounded" />
            Recherche floue (tolère les fautes)
          </label>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Statut</label>
          <div className="flex gap-2">
            {['Public', 'Privé'].map((s) => (
              <button
                key={s}
                onClick={() => setFilters((f) => ({ ...f, statut: f.statut === s ? undefined : s }))}
                className={clsx('flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                  filters.statut === s ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="section-select" className="mb-1.5 block text-xs font-semibold text-slate-500">Section</label>
          <select
            id="section-select"
            className="input"
            value={filters.section ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value || undefined }))}
          >
            <option value="">Toutes</option>
            <option value="anglophone">Anglophone</option>
            <option value="francophone">Francophone</option>
            <option value="bilingue">Bilingue</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Équipements</label>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => toggleFilter('bus')} className={clsx('flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-medium cursor-pointer transition-colors', filters.bus ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              <Bus size={16} /> Bus
            </button>
            <button onClick={() => toggleFilter('cantine')} className={clsx('flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-medium cursor-pointer transition-colors', filters.cantine ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              <UtensilsCrossed size={16} /> Cantine
            </button>
            <button onClick={() => toggleFilter('sport')} className={clsx('flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-medium cursor-pointer transition-colors', filters.sport ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}>
              <Trophy size={16} /> Sport
            </button>
          </div>
        </div>

        <button onClick={geolocate} className="btn-secondary w-full">
          <Locate size={16} /> Me géolocaliser
        </button>

        <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
          <span>{results.length} résultat(s)</span>
          {hasFilters && (
            <button onClick={() => { setQ(''); setFilters({}) }} className="text-primary-600 hover:underline cursor-pointer">Réinitialiser</button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {results.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className={clsx('w-full rounded-xl border p-3 text-left text-sm transition-colors cursor-pointer', selected?.id === e.id ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')}
            >
              <p className="font-semibold">{e.nom}</p>
              <p className="text-xs text-slate-500">{e.quartier_nom} · {e.statut}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* CARTE */}
      <div className="relative flex-1 overflow-hidden rounded-xl2 border border-slate-200/70 dark:border-slate-800 shadow-card">
        <MapContainer center={DOUALA_IV_CENTER} zoom={13} className="h-full w-full" ref={mapRef as any}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Plan">
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer attribution="Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MarkerClusterGroup>
            {results.filter((e) => e.latitude && e.longitude).map((e) => (
              <Marker
                key={e.id}
                position={[e.latitude!, e.longitude!]}
                icon={makeIcon(e.statut)}
                eventHandlers={{ click: () => setSelected(e) }}
              >
                <Popup>
                  <div className="min-w-[220px] p-1">
                    <p className="font-bold text-slate-900">{e.nom}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{e.quartier_nom} · {e.statut}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.moyen_transport?.includes('disponible') && !e.moyen_transport?.includes('non') && (
                        <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">Bus</span>
                      )}
                      {e.cantine_scolaire && (
                        <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium text-accent-600">Cantine</span>
                      )}
                    </div>
                    <Link to={`/etablissement/${e.id}`} className="mt-2 inline-block text-xs font-semibold text-primary-600 hover:underline">
                      Voir la fiche complète →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {userPos && (
            <CircleMarker center={userPos} radius={9} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.5 }} />
          )}

          <FlyTo position={selected && selected.latitude && selected.longitude ? [selected.latitude, selected.longitude] : userPos} />
        </MapContainer>

        {/* Overlay backdrop mobile */}
        {showSidebar && (
          <div 
            onClick={() => setShowSidebar(false)}
            className="lg:hidden fixed inset-0 bg-black/40 z-30"
          />
        )}

        <button
          onClick={() => mapRef.current?.getContainer().requestFullscreen?.()}
          className="absolute bottom-4 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-popup hover:bg-slate-50 cursor-pointer dark:bg-slate-800 dark:text-slate-200"
          aria-label="Plein écran"
        >
          <Maximize size={18} />
        </button>

        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="lg:hidden absolute top-4 left-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-popup hover:bg-slate-50 cursor-pointer dark:bg-slate-800 dark:text-slate-200"
            aria-label="Afficher les filtres"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Légende */}
        <div className="glass absolute left-4 top-4 z-[1000] rounded-xl p-3 text-xs shadow-card">
          <p className="mb-1.5 font-semibold">Légende</p>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary-600" /> Public</div>
          <div className="mt-1 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> Privé</div>
        </div>

        {selected && (
          <div className="glass absolute bottom-4 left-4 z-[1000] w-72 rounded-xl p-4 shadow-popup animate-fadeUp">
            <button onClick={() => setSelected(null)} aria-label="Fermer la fiche" className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={16} /></button>
            <p className="pr-4 font-bold">{selected.nom}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {selected.quartier_nom}</p>
            {selected.telephone && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {selected.telephone}</p>}
            {selected.route && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><RouteIcon size={12} /> {selected.route}</p>}
            <Link to={`/etablissement/${selected.id}`} className="btn-primary mt-3 w-full !py-2 text-xs">Fiche complète</Link>
          </div>
        )}
      </div>
    </div>
  )
}

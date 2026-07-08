import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Etablissement } from '@/types'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { ArrowLeft, Phone, MapPin, Bus, UtensilsCrossed, Trophy, GraduationCap, Route as RouteIcon, Download } from 'lucide-react'

export default function CollegeDetail() {
  const { id } = useParams()
  const { data: e, isLoading } = useQuery<Etablissement>({
    queryKey: ['college', id],
    queryFn: async () => (await api.get(`/college/${id}`)).data,
  })

  if (isLoading || !e) {
    return <div className="mx-auto max-w-4xl px-4 py-16 animate-pulse"><div className="h-80 rounded-xl2 bg-slate-200 dark:bg-slate-800" /></div>
  }

  const infoItems = [
    { icon: MapPin, label: 'Quartier', value: e.quartier_nom },
    { icon: Phone, label: 'Téléphone', value: e.telephone || 'Non renseigné' },
    { icon: GraduationCap, label: 'Section', value: e.section },
    { icon: GraduationCap, label: 'Cycle', value: e.cycle_enseignement },
    { icon: RouteIcon, label: 'Route', value: e.route },
    { icon: GraduationCap, label: 'Filière', value: e.filiere },
    { icon: Bus, label: 'Transport', value: e.moyen_transport },
    { icon: UtensilsCrossed, label: 'Cantine', value: e.cantine_scolaire || 'Non renseignée' },
    { icon: Trophy, label: 'Espace sportif', value: e.espace_sportif },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20">
      <Link to="/carte" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary-600">
        <ArrowLeft size={16} /> Retour à la carte
      </Link>

      <div className="mt-4 card overflow-hidden">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-8 text-white">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${e.statut === 'Public' ? 'bg-white/20' : 'bg-accent-500/30'}`}>
            {e.statut}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{e.nom}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-primary-50/90"><MapPin size={14} /> {e.quartier_nom}, Douala IV</p>
        </div>

        <div className="grid gap-8 p-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-4 font-bold">Informations générales</h2>
            <dl className="space-y-3">
              {infoItems.map((it) => (
                <div key={it.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
                    <it.icon size={15} />
                  </span>
                  <div>
                    <dt className="text-xs text-slate-500">{it.label}</dt>
                    <dd className="text-sm font-medium">{it.value || '—'}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
              <a href={`/api/export/csv`} className="btn-secondary !py-2 !px-3 text-xs"><Download size={13} /> CSV</a>
              <a href={`/api/export/geojson`} className="btn-secondary !py-2 !px-3 text-xs"><Download size={13} /> GeoJSON</a>
              <a href={`/api/export/pdf`} className="btn-secondary !py-2 !px-3 text-xs"><Download size={13} /> PDF</a>
            </div>
          </div>

          <div className="h-72 overflow-hidden rounded-xl2 border border-slate-200 dark:border-slate-800 sm:h-full">
            {e.latitude && e.longitude ? (
              <MapContainer center={[e.latitude, e.longitude]} zoom={16} className="h-full w-full">
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[e.latitude, e.longitude]}>
                  <Popup>{e.nom}</Popup>
                </Marker>
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Coordonnées indisponibles</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

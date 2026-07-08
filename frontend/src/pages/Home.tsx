import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Map, Search, BarChart3, ShieldCheck, ArrowRight, School, Bus, UtensilsCrossed, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Statistics } from '@/types'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' } }),
}

export default function Home() {
  const { data: stats } = useQuery<Statistics>({
    queryKey: ['statistics'],
    queryFn: async () => (await api.get('/statistics')).data,
  })

  const kpis = [
    { label: 'Établissements recensés', value: stats?.total_etablissements ?? '—', icon: School },
    { label: 'Quartiers couverts', value: stats?.kpis.nb_quartiers ?? '—', icon: Map },
    { label: 'Avec transport scolaire', value: stats?.kpis.avec_bus ?? '—', icon: Bus },
    { label: 'Avec espace sportif', value: stats?.kpis.avec_sport ?? '—', icon: Trophy },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-xl2 border border-slate-200/70 dark:border-slate-800 bg-gradient-to-br from-primary-600 via-primary-700 to-slate-900 px-6 py-20 text-white shadow-card mt-6 sm:px-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-primary-300/20 blur-3xl" />
        <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            Base de données géospatiale · Douala IV
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
            Trouvez le collège idéal, quartier par quartier.
          </h1>
          <p className="mt-4 text-base text-primary-50/90 sm:text-lg">
            Une plateforme cartographique pour explorer, comparer et analyser les établissements
            scolaires de Douala IV — transport, cantine, sections, filières et bien plus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/carte" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-primary-700 shadow-card transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer">
              <Map size={18} /> Explorer la carte <ArrowRight size={16} />
            </Link>
            <Link to="/statistiques" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors duration-200 hover:bg-white/20 cursor-pointer">
              <BarChart3 size={18} /> Voir les statistiques
            </Link>
          </div>
        </motion.div>
      </section>

      {/* KPIs */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i} variants={fadeUp} className="card flex flex-col gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
              <k.icon size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{k.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Objectifs */}
      <section className="mt-16">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} custom={0} variants={fadeUp} className="text-2xl font-extrabold">
          Ce que propose la plateforme
        </motion.h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            { icon: Search, title: 'Recherche multicritère', desc: "Filtrez par quartier, section, cycle, transport, cantine, sport, filière — avec recherche floue tolérante aux fautes." },
            { icon: Map, title: 'Carte interactive', desc: "Clusters intelligents, popups premium, géolocalisation, calcul de distance et itinéraires en un clic." },
            { icon: ShieldCheck, title: 'Données fiables', desc: "Base PostGIS structurée, export CSV/GeoJSON/SQL/Excel/PDF et administration avec journalisation complète." },
          ].map((f, i) => (
            <motion.div key={f.title} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i + 1} variants={fadeUp} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600">
                <f.icon size={20} />
              </span>
              <h3 className="mt-4 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Répartition rapide */}
      {stats && (
        <section className="mt-16 grid gap-5 sm:grid-cols-3">
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"><Bus size={20} /></span>
            <div>
              <p className="text-lg font-bold">{stats.kpis.avec_bus} / {stats.total_etablissements}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Établissements avec bus scolaire</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600"><UtensilsCrossed size={20} /></span>
            <div>
              <p className="text-lg font-bold">{stats.kpis.avec_cantine} / {stats.total_etablissements}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Établissements avec cantine</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300"><Trophy size={20} /></span>
            <div>
              <p className="text-lg font-bold">{stats.kpis.avec_sport} / {stats.total_etablissements}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Établissements avec espace sportif</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

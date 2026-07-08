import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Statistics } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts'
import { motion } from 'framer-motion'
import { Download } from 'lucide-react'

const COLORS = ['#1c63e0', '#0fb894', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function StatisticsPage() {
  const { data: stats, isLoading } = useQuery<Statistics>({
    queryKey: ['statistics'],
    queryFn: async () => (await api.get('/statistics')).data,
  })

  if (isLoading || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 rounded-xl2 bg-slate-200 dark:bg-slate-800" />)}
        </div>
      </div>
    )
  }

  const exportFormats = ['csv', 'geojson', 'sql', 'excel', 'pdf'] as const

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20">
      <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Tableau de bord</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Statistiques calculées en direct depuis PostGIS.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportFormats.map((fmt) => (
            <a key={fmt} href={`/api/export/${fmt}`} className="btn-secondary !py-2 !px-3 text-xs">
              <Download size={14} /> {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: 'Total', value: stats.total_etablissements },
          { label: 'Avec bus', value: stats.kpis.avec_bus },
          { label: 'Avec cantine', value: stats.kpis.avec_cantine },
          { label: 'Avec sport', value: stats.kpis.avec_sport },
          { label: 'Quartiers', value: stats.kpis.nb_quartiers },
        ].map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-primary-600">{k.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-bold">Répartition par quartier</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.par_quartier} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="quartier_nom" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#1c63e0" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Public vs Privé</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={stats.par_statut} dataKey="total" nameKey="statut" cx="50%" cy="50%" outerRadius={100} label>
                {stats.par_statut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Répartition par section</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.par_section}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="section" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#0fb894" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Répartition par cycle</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.par_cycle}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="cycle_enseignement" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

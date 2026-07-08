export interface Etablissement {
  id: number
  object_id?: number
  nom: string
  statut: 'Public' | 'Privé'
  type_enseignement?: string
  quartier_nom?: string
  moyen_transport?: string
  cantine_scolaire?: string
  telephone?: string
  section?: string
  cycle_enseignement?: string
  route?: string
  filiere?: string
  espace_sportif?: string
  latitude?: number
  longitude?: number
}

export interface SearchFilters {
  q?: string
  nom?: string
  quartier?: string
  statut?: string
  type_enseignement?: string
  section?: string
  cycle?: string
  filiere?: string
  route?: string
  telephone?: string
  bus?: boolean
  cantine?: boolean
  sport?: boolean
  fuzzy?: boolean
  page?: number
  limit?: number
}

export interface SearchOptions {
  quartiers: string[]
  statuts: string[]
  types_enseignement: string[]
  sections: string[]
  cycles: string[]
  filieres: string[]
  routes: string[]
  espaces_sportifs: string[]
  moyens_transport: string[]
  cantines: string[]
}

export interface User {
  id: number
  email: string
  full_name?: string
  role: 'admin' | 'gestionnaire' | 'consultation'
  is_active: boolean
}

export interface Statistics {
  total_etablissements: number
  kpis: {
    avec_bus: number
    sans_bus: number
    avec_cantine: number
    avec_sport: number
    nb_quartiers: number
  }
  par_quartier: { quartier_nom: string; total: number; publics: number; prives: number; avec_bus: number; avec_sport: number }[]
  par_statut: { statut: string; total: number }[]
  par_section: { section: string; total: number }[]
  par_cycle: { cycle_enseignement: string; total: number }[]
}

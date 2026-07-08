# Analyse complète — GeoColleges Douala IV

Plateforme géospatiale de recherche et consultation des établissements scolaires (collèges et lycées) de l'arrondissement de Douala IV, Cameroun.

---

## 1. Structure du projet

```
geocolleges/
├── backend/                        # API FastAPI
│   ├── app/
│   │   ├── main.py                 # Point d'entrée FastAPI + CORS
│   │   ├── core/
│   │   │   ├── config.py           # Variables d'environnement (Pydantic Settings)
│   │   │   ├── database.py         # Engine SQLAlchemy + SessionLocal
│   │   │   └── security.py         # JWT, hachage bcrypt, dépendances auth
│   │   ├── models/
│   │   │   ├── user.py             # ORM User
│   │   │   ├── etablissement.py    # ORM Etablissement + Quartier
│   │   │   └── activity_log.py     # ORM ActivityLog (audit)
│   │   ├── routers/
│   │   │   ├── auth.py             # /api/auth/*
│   │   │   ├── etablissements.py   # /api/college/* (CRUD)
│   │   │   ├── search.py           # /api/search + /api/search/ai
│   │   │   ├── map.py              # /api/map + /api/nearby
│   │   │   ├── statistics.py       # /api/statistics
│   │   │   ├── export.py           # /api/export/*
│   │   │   └── admin.py            # /api/admin/*
│   │   ├── schemas/
│   │   │   ├── user.py             # Schémas Pydantic User
│   │   │   └── etablissement.py    # Schémas Pydantic Etablissement
│   │   └── services/
│   │       ├── search_service.py   # Filtres SQL + Levenshtein
│   │       └── ai_search_service.py # NLP DeepSeek/Anthropic + fallback local
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.toml                # Config déploiement Railway
├── frontend/                       # React + Vite + TypeScript
│   ├── src/
│   │   ├── main.tsx                # Point d'entrée React
│   │   ├── App.tsx                 # Router + providers
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Page d'accueil + KPIs
│   │   │   ├── MapPage.tsx         # Carte Leaflet interactive
│   │   │   ├── SearchPage.tsx      # Recherche multi-critères + IA
│   │   │   ├── StatisticsPage.tsx  # Dashboard + graphiques
│   │   │   ├── CollegeDetail.tsx   # Fiche établissement
│   │   │   ├── Login.tsx           # Connexion / inscription
│   │   │   ├── AdminPage.tsx       # Panel d'administration
│   │   │   └── About.tsx           # À propos
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Navigation + thème + auth
│   │   │   ├── ProtectedRoute.tsx  # Garde de route par rôle
│   │   │   └── MarkerClusterGroup.tsx # Clustering Leaflet
│   │   ├── hooks/
│   │   │   ├── useAuth.tsx         # Contexte auth + JWT localStorage
│   │   │   └── useTheme.ts         # Basculement dark/light
│   │   ├── lib/
│   │   │   └── api.ts              # Instance Axios + intercepteurs JWT
│   │   └── types/
│   │       └── index.ts            # Interfaces TypeScript globales
│   ├── public/
│   │   ├── logo.png
│   │   └── favicon.co
│   ├── vercel.json                 # Rewrites Vercel → Railway
│   └── Dockerfile                  # Build multi-stage Node → Nginx
├── database/
│   ├── schema.sql                  # DDL PostgreSQL (source de vérité)
│   └── donne_es_att_be_ri.csv      # Données source (UTM 32N)
├── scripts/
│   ├── import_csv.py               # Import CSV + conversion UTM→WGS84
│   └── seed_admin.py               # Création compte admin par défaut
├── docker-compose.yml              # Stack locale complète
└── README.md
```

---

## 2. Backend — API FastAPI

### Endpoints

#### Authentification (`/api/auth`)

| Méthode | Route | Description | Auth requise |
|---------|-------|-------------|--------------|
| POST | `/api/auth/login` | Connexion email/password → JWT + objet user | Non |
| POST | `/api/auth/register` | Auto-inscription (rôle `consultation`) | Non |
| GET | `/api/auth/me` | Profil de l'utilisateur connecté | Oui |

#### Établissements (`/api/college`)

| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| GET | `/api/colleges` | Liste paginée (`skip`, `limit`) | Non |
| GET | `/api/college/{id}` | Détail d'un établissement | Non |
| POST | `/api/college` | Créer un établissement | admin / gestionnaire |
| PUT | `/api/college/{id}` | Modifier un établissement | admin / gestionnaire |
| DELETE | `/api/college/{id}` | Supprimer un établissement | admin |

#### Recherche (`/api/search`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/search/options` | Valeurs distinctes pour les menus déroulants |
| GET | `/api/search` | Recherche multi-critères (voir paramètres ci-dessous) |
| GET | `/api/search/ai` | Recherche en langage naturel (NLP) |

**Paramètres de `/api/search`** :

| Paramètre | Type | Description |
|-----------|------|-------------|
| `q` | string | Texte libre (nom, quartier, filière…) |
| `fuzzy` | bool | Active pg_trgm + Levenshtein |
| `nom` | string | Filtre par nom |
| `quartier` | string | Filtre par quartier |
| `statut` | string | `Public` ou `Privé` |
| `type_enseignement` | string | Type d'enseignement |
| `section` | string | Francophone / Anglophone / Bilingue |
| `cycle` | string | Premier cycle / Second cycle |
| `filiere` | string | Scientifique, Littéraire… |
| `route` | string | Type de route (goudronnée, pavé, terre) |
| `moyen_transport` | string | Transport scolaire |
| `cantine_scolaire` | string | Présence cantine |
| `espace_sportif` | string | Installations sportives |
| `telephone` | string | Numéro de téléphone |
| `bus` | bool | Raccourci équipement bus |
| `cantine` | bool | Raccourci équipement cantine |
| `sport` | bool | Raccourci équipement sportif |
| `lat`, `lon`, `rayon_m` | float | Recherche géographique (défaut 2000 m) |
| `page`, `limit` | int | Pagination |

#### Carte & Géospatial (`/api/map`)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/map` | Tous les établissements en GeoJSON FeatureCollection |
| GET | `/api/nearby` | Établissements dans un rayon (`lat`, `lon`, `rayon_m`) |

#### Statistiques (`/api/statistics`)

Retourne en un seul appel :
- KPIs globaux (total, avec bus, avec cantine, avec sport, quartiers)
- Répartition par quartier
- Répartition par statut (Public/Privé)
- Répartition par section
- Répartition par cycle

#### Export (`/api/export`)

| Route | Format | Description |
|-------|--------|-------------|
| `/api/export/csv` | CSV | Téléchargement streaming |
| `/api/export/geojson` | GeoJSON | Export cartographique |
| `/api/export/sql` | SQL | Instructions INSERT |
| `/api/export/excel` | XLSX | Classeur Excel (openpyxl) |
| `/api/export/pdf` | PDF | Tableau PDF (reportlab) |

#### Administration (`/api/admin`)

| Méthode | Route | Description | Rôle |
|---------|-------|-------------|------|
| GET | `/api/admin/users` | Liste des utilisateurs | admin |
| POST | `/api/admin/users` | Créer un utilisateur | admin |
| PUT | `/api/admin/users/{id}/toggle-active` | Activer/désactiver | admin |
| DELETE | `/api/admin/users/{id}` | Supprimer | admin |
| GET | `/api/admin/logs` | Journal d'activité (200 dernières lignes) | admin |
| POST | `/api/admin/import-csv` | Import CSV via interface web | admin / gestionnaire |

#### Santé

| Route | Description |
|-------|-------------|
| `GET /api/health` | Statut du service (utilisé par Railway healthcheck) |

---

### Modèles ORM

#### `User`
```
id, email (unique), hashed_password, full_name
role: admin | gestionnaire | consultation
is_active (bool), created_at
```

#### `Etablissement`
```
id, object_id (unique source), nom, statut
type_enseignement, quartier_id (FK), quartier_nom
moyen_transport, cantine_scolaire, telephone
section, cycle_enseignement, route, filiere, espace_sportif
coord_x_utm, coord_y_utm (UTM 32N conservés)
latitude, longitude (WGS84 calculés à l'import)
created_at, updated_at (trigger auto)
```

#### `Quartier`
```
id, nom (unique)
```

#### `ActivityLog`
```
id, user_id (FK), action (CREATE/UPDATE/DELETE/LOGIN/IMPORT)
entity, entity_id, details (JSONB), created_at
```

---

### Services

#### `search_service.py`
- `apply_filters()` — Construit la requête SQLAlchemy à partir des critères
  - Texte libre : ILIKE insensible à la casse
  - Fuzzy : `similarity()` pg_trgm + `unaccent()`
  - Équipements booléens : patterns ILIKE
  - Proximité géographique : formule Haversine
- `levenshtein_best_matches()` — Fallback Python pur (distance de Levenshtein)

#### `ai_search_service.py`
- **Priorité 1 : DeepSeek** (si `DEEPSEEK_API_KEY` configuré)
  - Compatible OpenAI Chat Completions
  - Modèle : `deepseek-chat`
- **Priorité 2 : Anthropic Claude** (si `ANTHROPIC_API_KEY` configuré)
  - SDK natif Anthropic
  - Modèle : `claude-3-5-haiku-20241022`
- **Priorité 3 : Parser local** (toujours disponible, sans clé API)
  - Regex + correspondance de mots-clés
  - Extraction : statut, section, équipements, quartier, cycle
  - Fallback fuzzy activé automatiquement
- Retourne les filtres parsés dans le header `X-Parsed-Filters`

---

### Sécurité

- **JWT** : algorithme HS256, expiration 8 heures
- **Passwords** : bcrypt avec gestion auto-dépréciation
- **RBAC** : dépendance `require_role(*roles)` sur chaque endpoint protégé
- **CORS** : origines configurables via `CORS_ORIGINS` + `CORS_EXTRA_ORIGINS`

---

## 3. Base de données PostgreSQL

### Extensions activées
- `pg_trgm` — Recherche floue par trigrammes (index GIN)
- `unaccent` — Suppression des diacritiques pour la recherche
- `uuid-ossp` — Génération d'UUIDs
- `postgis` — Extension géospatiale (disponible, non exploitée directement)

### Index

| Index | Table | Colonne | Type |
|-------|-------|---------|------|
| `idx_etablissements_nom_trgm` | etablissements | nom | GIN trigramme |
| `idx_etablissements_quartier_trgm` | etablissements | quartier_nom | GIN trigramme |
| Index standard | etablissements | statut, section, cycle, lat, lon | B-tree |

### Vues SQL
- `v_etablissements_geo` — Données géographiques pour l'export GeoJSON
- `v_stats_par_quartier` — Comptages par quartier (total, Public, Privé, bus, sport)
- `v_stats_par_statut`, `v_stats_par_section`, `v_stats_par_cycle` — Agrégats

### Fonctions SQL
- `etablissements_proches(lat, lon, rayon_m)` — Haversine sans PostGIS
- `recherche_floue_nom(terme, seuil)` — Similarité trigramme avec seuil (défaut 0.2)

### Trigger
- `trg_etablissements_updated_at` — Met à jour `updated_at` automatiquement

---

## 4. Frontend React

### Pages

#### `Home.tsx` — Accueil
- Section hero avec boutons CTA (Rechercher, Explorer la carte)
- 4 cartes KPI : total établissements, avec bus, avec cantine, avec sport
- Présentation des fonctionnalités (recherche, carte, fiabilité des données)

#### `MapPage.tsx` — Carte interactive
- Carte Leaflet plein écran centrée sur Douala IV (4.03°N, 9.65°E)
- **Sidebar gauche** (fixe sur desktop, panneau latéral glissant sur mobile) :
  - Champ de recherche + toggle recherche floue
  - Filtres : statut (Public/Privé), section, équipements (bus/cantine/sport)
  - Bouton géolocalisation
  - Liste des résultats cliquables
- **Sur la carte** :
  - Marqueurs personnalisés (bleu = Public, vert = Privé)
  - Clustering automatique (MarkerClusterGroup)
  - Popup au clic avec infos rapides
  - Contrôle de couches Plan / Satellite (Esri)
  - Légende (desktop uniquement)
  - Fiche sélectionnée en bas de carte (mobile-friendly)
  - Bouton plein écran
  - Bouton menu filtres (mobile)

#### `SearchPage.tsx` — Recherche avancée
- **Mode formulaire** : panneau de filtres complet (10+ critères)
  - Texte libre + toggle fuzzy
  - Menus déroulants : quartier, statut, type_enseignement, section, cycle, filière
  - Infrastructures : route, transport, cantine, espace sportif
- **Mode IA** : saisie en langage naturel
  - Indicateur "Recherche IA DeepSeek"
  - Affichage des filtres parsés en badges
- Filtres actifs affichés comme chips supprimables
- Résultats en cartes animées (nom, statut, quartier, équipements)
- Pagination (Précédent / Suivant)
- États vide et chargement avec squelettes

#### `StatisticsPage.tsx` — Tableau de bord
- 5 KPI cards
- Graphique en barres : établissements par quartier
- Graphique circulaire : Public vs Privé
- Graphiques en barres : répartition section, répartition cycle
- Boutons export : CSV, GeoJSON, SQL, Excel, PDF

#### `CollegeDetail.tsx` — Fiche établissement
- En-tête avec dégradé + badge statut
- Informations détaillées : quartier, téléphone, section, cycle, route, filière, transport, cantine, sport
- Mini-carte Leaflet avec marqueur positionné
- Boutons export individuels
- Lien retour vers la carte

#### `Login.tsx` — Authentification
- Bascule connexion / inscription
- Gestion des erreurs inline
- Bouton désactivé pendant les requêtes
- Encart info : identifiants admin par défaut

#### `AdminPage.tsx` — Panel d'administration (5 onglets)

| Onglet | Contenu |
|--------|---------|
| **Établissements** | Tableau + CRUD complet (modal create/edit/delete) |
| **Utilisateurs** | Tableau + CRUD + toggle actif/inactif |
| **Journal** | Flux d'activité (200 dernières actions) |
| **Import CSV** | Zone de dépôt fichier + format attendu + résultat |
| **Paramètres** | Export données + zone dangereuse (reset BDD) |

#### `About.tsx` — À propos
- Description du projet
- Stack technique
- Sources de données + méthodologie

---

### Composants partagés

| Composant | Rôle |
|-----------|------|
| `Navbar` | Navigation principale + logo + toggle thème + auth + menu mobile |
| `ProtectedRoute` | Garde de route basée sur le rôle (redirige si non autorisé) |
| `MarkerClusterGroup` | Wrapper react-leaflet-cluster |

### Hooks

| Hook | Rôle |
|------|------|
| `useAuth` | Contexte auth : login, register, logout, état user, persistance JWT |
| `useTheme` | Bascule dark/light avec persistance localStorage |

### Bibliothèque `api.ts`
- Instance Axios avec `baseURL: '/api'`
- Intercepteur requête : injection du JWT depuis localStorage
- Intercepteur réponse : nettoyage token sur 401

---

## 5. Scripts

### `import_csv.py`
- Lit `database/donne_es_att_be_ri.csv`
- Convertit les coordonnées UTM 32N (EPSG:32632) → WGS84 (EPSG:4326) via **pyproj**
- Normalise les valeurs (Unicode, trim, mapping statut)
- Upsert dans `etablissements` + `quartiers`
- Liaison `quartier_id` après insertion

### `seed_admin.py`
- Crée le compte admin si aucun n'existe
- Email/mot de passe configurables via variables d'environnement

---

## 6. Déploiement

### Architecture de production

```
Vercel (Frontend)               Railway (Backend)           Railway (PostgreSQL)
React + Vite                    FastAPI + Uvicorn            PostgreSQL 16
vercel.json rewrites     ──►    PORT=$PORT                   postgis, pg_trgm
/api/* → Railway                /api/health (healthcheck)    unaccent, uuid-ossp
SPA fallback → index.html
```

### Docker Compose (local)

| Service | Image | Port |
|---------|-------|------|
| `db` | postgis/postgis:16-3.4 | 5432 |
| `backend` | ./backend (Dockerfile) | 8000 |
| `frontend` | ./frontend (Dockerfile multi-stage) | 5173 |
| `adminer` | adminer | 8080 |

Au premier démarrage Docker, le backend exécute automatiquement :
1. `scripts/seed_admin.py` — création du compte admin
2. `scripts/import_csv.py` — import des données CSV
3. `uvicorn app.main:app` — démarrage de l'API

### Variables d'environnement (backend)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | Connexion PostgreSQL | voir docker-compose |
| `SECRET_KEY` | Clé de signature JWT | à définir |
| `DEEPSEEK_API_KEY` | Clé DeepSeek (recherche IA, prioritaire) | vide |
| `DEEPSEEK_BASE_URL` | URL API DeepSeek | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | Modèle DeepSeek | `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Clé Claude (fallback si pas DeepSeek) | vide |
| `SEED_ADMIN_EMAIL` | Email admin par défaut | `admin@geocolleges.cm` |
| `SEED_ADMIN_PASSWORD` | Mot de passe admin par défaut | `Admin123!` |
| `CORS_EXTRA_ORIGINS` | URL(s) frontend additionnelles | vide |

---

## 7. Stack technique complète

| Couche | Technologie | Version |
|--------|------------|---------|
| Framework frontend | React | 18.3.1 |
| Build tool | Vite | 5.3.3 |
| Langage frontend | TypeScript | 5.5.3 |
| Style | TailwindCSS | 3.4.4 |
| Cartes | Leaflet + react-leaflet | 1.9.4 + 4.2.1 |
| Graphiques | Recharts | 2.12.7 |
| État serveur | TanStack React Query | 5.51.1 |
| Routage | React Router DOM | 6.24.0 |
| HTTP Client | Axios | 1.7.2 |
| Animation | Framer Motion | 11.2.12 |
| Icônes | lucide-react | 0.400.0 |
| Framework backend | FastAPI | 0.111.0 |
| Serveur ASGI | Uvicorn | 0.30.1 |
| ORM | SQLAlchemy | 2.0.30 |
| Validation | Pydantic | 2.7.4 |
| Auth | python-jose + bcrypt | 3.3.0 + 4.0.1 |
| Base de données | PostgreSQL | 16 |
| Extension géo | PostGIS | 3.4 |
| Migrations | Alembic | 1.13.1 |
| IA (prioritaire) | DeepSeek API | (OpenAI-compat) |
| IA (fallback) | Anthropic SDK | 0.28.0 |
| Projection géo | pyproj | 3.6.1 |
| Similarité texte | python-Levenshtein | 0.25.1 |
| Export Excel | openpyxl | 3.1.2 |
| Export PDF | reportlab | 4.2.0 |
| Conteneurs | Docker + Compose | multi-stage |
| Déploiement frontend | Vercel | cloud |
| Déploiement backend | Railway | cloud |

---

## 8. Récapitulatif des fonctionnalités

| Fonctionnalité | Implémentation |
|----------------|---------------|
| Authentification | JWT HS256 + bcrypt + 3 rôles (admin/gestionnaire/consultation) |
| Carte interactive | Leaflet + clustering + Plan/Satellite + géolocalisation |
| Recherche multi-critères | 10+ filtres SQL + pagination |
| Recherche floue | pg_trgm (SQL) + Levenshtein (Python fallback) |
| Recherche IA | DeepSeek → Anthropic → parser local (sans interruption) |
| Proximité géographique | Haversine (sans PostGIS requis) |
| Export données | CSV, GeoJSON, SQL, Excel, PDF |
| Dashboard stats | KPIs + 4 graphiques Recharts |
| Administration | CRUD complet + import CSV + journal d'activité + reset BDD |
| Dark mode | Toggle manuel + persistance localStorage |
| Responsive | Mobile-first TailwindCSS (375px → 1600px) |
| Déploiement | Vercel (frontend) + Railway (backend + PostgreSQL) |

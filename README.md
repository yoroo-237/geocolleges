# GeoColleges Douala IV

Plateforme géospatiale de recherche et de consultation des établissements scolaires
(collèges et lycées) de l'arrondissement de Douala IV, Cameroun.

## Stack

- **Frontend** : React + Vite + TypeScript + TailwindCSS + React Query + Leaflet + Recharts + Framer Motion
- **Backend** : FastAPI + SQLAlchemy + Pydantic + Alembic
- **Base de données** : PostgreSQL 16 + PostGIS 3.4
- **Auth** : JWT (rôles `admin`, `gestionnaire`, `consultation`)
- **Déploiement** : Docker Compose (frontend, backend, PostgreSQL/PostGIS, Adminer)

## Démarrage rapide

```bash
cp backend/.env.example backend/.env   # optionnel : renseigner ANTHROPIC_API_KEY pour la recherche IA
docker compose up --build
```

Au premier démarrage, le backend :
1. crée le compte administrateur par défaut (`admin@geocolleges.cm` / `Admin123!`) ;
2. importe automatiquement `database/donne_es_att_be_ri.csv` dans PostGIS (coordonnées
   converties de UTM 32N vers WGS84) ;
3. démarre l'API.

Accès une fois les conteneurs démarrés :

| Service      | URL                          |
|--------------|-------------------------------|
| Frontend     | http://localhost:5173         |
| API (docs)   | http://localhost:8000/docs    |
| Adminer (DB) | http://localhost:8080         |

Identifiants Adminer : système `PostgreSQL`, serveur `db`, utilisateur `geocolleges`,
mot de passe `geocolleges`, base `geocolleges`.

**⚠️ Changez le mot de passe admin et `SECRET_KEY` avant tout déploiement en production.**

## Variables d'environnement (backend)

| Variable               | Description                                              | Défaut |
|-------------------------|-----------------------------------------------------------|--------|
| `DATABASE_URL`          | Chaîne de connexion PostgreSQL                             | voir `docker-compose.yml` |
| `SECRET_KEY`            | Clé de signature JWT                                       | à définir |
| `ANTHROPIC_API_KEY`     | Clé Claude API pour `/api/search/ai`. Optionnelle : sans clé, fallback automatique sur un moteur de règles + Levenshtein local | vide |
| `SEED_ADMIN_EMAIL`      | Email du compte admin créé au démarrage                    | admin@geocolleges.cm |
| `SEED_ADMIN_PASSWORD`   | Mot de passe du compte admin créé au démarrage              | Admin123! |

## Développement sans Docker

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://geocolleges:geocolleges@localhost:5432/geocolleges_db
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Base de données seule
```bash
docker compose up db -d
psql "postgresql://USER:PASSWORD@localhost:5432/geocolleges_db" -f database/schema.sql
python scripts/import_csv.py --csv database/donne_es_att_be_ri.csv
python scripts/seed_admin.py
```

## Architecture

```
geocolleges/
├── frontend/        # React + Vite + TS
├── backend/          # FastAPI (routers, models, schemas, services)
├── database/         # schema.sql (source de vérité initiale) + CSV source
├── scripts/           # import_csv.py, seed_admin.py
├── docker/            # (réservé configs additionnelles)
├── docs/              # documentation complémentaire
└── docker-compose.yml
```

## API — endpoints principaux

| Route                     | Méthode | Description |
|----------------------------|---------|-------------|
| `/api/auth/login`          | POST    | Connexion, retourne un JWT |
| `/api/auth/register`       | POST    | Auto-inscription (rôle consultation) |
| `/api/colleges`            | GET     | Liste paginée des établissements |
| `/api/college/{id}`        | GET/PUT/DELETE | Détail / modification / suppression |
| `/api/college`             | POST    | Création (admin/gestionnaire) |
| `/api/search`               | GET     | Recherche multicritère (filtres + `fuzzy=true`) |
| `/api/search/ai`            | GET     | Recherche en langage naturel (Claude API ou fallback local) |
| `/api/map`                  | GET     | GeoJSON de tous les établissements |
| `/api/nearby`                | GET     | Établissements à proximité d'un point (`lat`, `lon`, `rayon_m`) |
| `/api/statistics`            | GET     | KPIs et répartitions pour le dashboard |
| `/api/export/{csv,geojson,sql,excel,pdf}` | GET | Exports |
| `/api/admin/users`           | GET/POST | Gestion des utilisateurs (admin) |
| `/api/admin/import-csv`      | POST    | Import CSV via l'interface admin |
| `/api/admin/logs`            | GET     | Journal d'activité |

Documentation interactive complète : `http://localhost:8000/docs` (Swagger UI).

## Déploiement en production

### Backend — Railway

#### Option A — Déploiement depuis GitHub (recommandé)

1. Créer un nouveau projet sur [railway.app](https://railway.app)
2. Cliquer **New Service → GitHub Repo** → sélectionner `yoroo-237/geocolleges`
3. Dans les paramètres du service, définir **Root Directory** → `backend`
4. Railway détecte `railway.toml` et lance automatiquement :
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
5. Chaque `git push origin main` redéploie automatiquement.

#### Option B — Déploiement via Railway CLI

```bash
# Installer le CLI Railway
npm install -g @railway/cli

# Se connecter
railway login

# Lier le projet (depuis la racine du dépôt)
railway link

# Déployer le backend
cd backend
railway up

# Voir les logs en direct
railway logs
```

#### Ajouter PostgreSQL

Dans le tableau de bord Railway :
1. **New Service → Database → PostgreSQL**
2. Une fois créé, ouvrir la console SQL et activer les extensions :
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS unaccent;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
3. La variable `DATABASE_URL` est injectée automatiquement dans le service backend.

#### Variables d'environnement Railway

5. Configurer les variables d'environnement dans Railway :

   | Variable               | Valeur                                              |
   |------------------------|------------------------------------------------------|
   | `DATABASE_URL`         | Générée automatiquement par le service PostgreSQL Railway |
   | `SECRET_KEY`           | Chaîne aléatoire longue (ex: `openssl rand -hex 32`) |
   | `ANTHROPIC_API_KEY`    | Optionnel — clé Claude pour la recherche IA          |
   | `SEED_ADMIN_EMAIL`     | Email du compte admin initial                        |
   | `SEED_ADMIN_PASSWORD`  | Mot de passe fort pour le compte admin               |
   | `CORS_EXTRA_ORIGINS`   | URL Vercel du frontend (ex: `https://geocolleges.vercel.app`) |

#### Initialiser la base après le premier déploiement

```bash
# Récupérer la DATABASE_URL Railway en local
railway variables --service <nom-service-postgres>

# Appliquer le schéma
psql $DATABASE_URL -f database/schema.sql

# Importer les données CSV
DATABASE_URL=$DATABASE_URL python scripts/import_csv.py --csv database/donne_es_att_be_ri.csv

# Créer le compte admin
DATABASE_URL=$DATABASE_URL python scripts/seed_admin.py
```

> **Supabase** inclut PostGIS nativement et est une alternative clé-en-main à Railway PostgreSQL.

---

### Frontend — Vercel

1. Importer le dépôt sur [vercel.com](https://vercel.com)
2. Configurer le projet :
   - **Root Directory** : `frontend`
   - **Framework Preset** : Vite (détecté automatiquement)
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
3. Mettre à jour `frontend/vercel.json` avec l'URL Railway réelle :
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://VOTRE_APP.railway.app/api/:path*"
       }
     ]
   }
   ```
4. Déployer — les appels `/api/*` du frontend sont automatiquement redirigés vers Railway.

---

### Architecture de déploiement

```
Vercel (frontend)          Railway (backend)         Railway (PostgreSQL + PostGIS)
  React + Vite       →→→   FastAPI + Uvicorn    →→→   geocolleges_db
  /api/* rewrites           PORT=$PORT                  postgis, pg_trgm, unaccent
```

---

## Tests

```bash
cd backend && pytest
cd frontend && npm run test
```

## Notes de conception

- Les coordonnées source du CSV (`Coord_X`, `Coord_Y`) sont en projection **UTM Zone 32N
  (EPSG:32632)**, qui couvre Douala. Elles sont converties automatiquement en WGS84
  (EPSG:4326) à l'import via `pyproj`, puis stockées comme géométrie PostGIS (`geom`).
- La recherche floue combine l'extension PostgreSQL `pg_trgm` (similarité trigram, rapide,
  côté SQL) et un fallback pur-Python par distance de Levenshtein si aucun résultat n'est
  trouvé via trigram (utile pour les fautes de frappe importantes).
- La recherche en langage naturel (`/api/search/ai`) utilise l'API Claude si
  `ANTHROPIC_API_KEY` est configurée ; sinon elle bascule automatiquement sur un
  parseur de règles local (mots-clés + Levenshtein), sans interruption de service.

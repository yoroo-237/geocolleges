export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-2xl font-extrabold">À propos du projet</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        GeoColleges Douala IV est une plateforme géospatiale conçue pour recenser, cartographier
        et permettre la recherche multicritère des établissements scolaires (collèges et lycées)
        de l'arrondissement de Douala IV, Cameroun.
      </p>

      <h2 className="mt-8 font-bold">Architecture technique</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <li>Frontend : React, Vite, TypeScript, TailwindCSS, React Query, Leaflet</li>
        <li>Backend : FastAPI, SQLAlchemy, Pydantic, Alembic</li>
        <li>Base de données : PostgreSQL + PostGIS (index spatiaux GIST, vues, procédures)</li>
        <li>Authentification : JWT avec rôles admin / gestionnaire / consultation</li>
        <li>Déploiement : Docker Compose (frontend, backend, PostgreSQL/PostGIS, Adminer)</li>
      </ul>

      <h2 className="mt-8 font-bold">Sources des données</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Les données proviennent d'un relevé de terrain des établissements scolaires de Douala IV,
        incluant leur statut, section, cycle d'enseignement, filière, équipements (transport,
        cantine, espace sportif) et coordonnées géographiques (converties depuis UTM Zone 32N
        vers WGS84).
      </p>

      <h2 className="mt-8 font-bold">Méthodologie</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Les coordonnées sources sont projetées automatiquement en WGS84 lors de l'import, puis
        stockées comme géométries PostGIS. La recherche combine filtres SQL classiques et
        recherche floue (similarité trigram / distance de Levenshtein) pour tolérer les
        approximations de saisie. Une interprétation en langage naturel est disponible via
        l'API Claude, avec repli automatique sur un moteur de règles local en son absence.
      </p>
    </div>
  )
}

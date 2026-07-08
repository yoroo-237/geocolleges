from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.etablissement import EtablissementOut, SearchFilters
from app.services.search_service import apply_filters, paginate, levenshtein_best_matches
from app.services.ai_search_service import parse_natural_language_query

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=list[EtablissementOut])
def search(
    q: str | None = None,
    nom: str | None = None,
    quartier: str | None = None,
    statut: str | None = None,
    type_enseignement: str | None = None,
    section: str | None = None,
    cycle: str | None = None,
    filiere: str | None = None,
    route: str | None = None,
    telephone: str | None = None,
    bus: bool | None = None,
    cantine: bool | None = None,
    sport: bool | None = None,
    lat: float | None = None,
    lon: float | None = None,
    rayon_m: float | None = None,
    fuzzy: bool = False,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Recherche multicritère des établissements.

    - **q** : recherche libre dans tous les champs texte
    - **fuzzy** : active la tolérance aux fautes (pg_trgm + Levenshtein)
    - **bus/cantine/sport** : filtres booléens sur les équipements
    - **lat/lon/rayon_m** : filtre géographique (rayon en mètres, défaut 2000m)
    - **page/limit** : pagination
    """
    filters = SearchFilters(
        q=q, nom=nom, quartier=quartier, statut=statut,
        type_enseignement=type_enseignement, section=section, cycle=cycle,
        filiere=filiere, route=route, telephone=telephone,
        bus=bus, cantine=cantine, sport=sport,
        lat=lat, lon=lon, rayon_m=rayon_m,
        fuzzy=fuzzy, page=page, limit=limit,
    )

    query = apply_filters(db, filters)

    if q and fuzzy:
        results = query.limit(limit).all()
        if not results:
            results = levenshtein_best_matches(db, q, limit=limit)
        return results

    return paginate(query, page, limit)


@router.get("/search/ai", response_model=list[EtablissementOut])
def search_ai(
    query: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Recherche en langage naturel.
    Ex: 'je cherche un lycée public avec bus à Sodiko'.
    Utilise Claude API si une clé est configurée, sinon fallback local automatique.
    """
    filters = parse_natural_language_query(query)
    filters.page = page
    filters.limit = limit
    results = paginate(apply_filters(db, filters), page, limit)
    if not results and filters.q:
        results = levenshtein_best_matches(db, filters.q, limit=limit)
    return results

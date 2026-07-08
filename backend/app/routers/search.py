import logging

import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import distinct

from app.core.database import get_db
from app.schemas.etablissement import EtablissementOut, SearchFilters
from app.services.search_service import apply_filters, paginate, levenshtein_best_matches
from app.services.ai_search_service import parse_natural_language_query
from app.models.etablissement import Etablissement, Quartier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["search"])


def _distinct(db: Session, col):
    return sorted(
        r[0] for r in db.query(distinct(col)).filter(col.isnot(None), col != "").all()
    )


def get_db_options(db: Session) -> dict:
    """Valeurs distinctes de tous les champs filtrables — partagé avec l'IA et le frontend."""
    return {
        "quartiers":          _distinct(db, Etablissement.quartier_nom),
        "statuts":            _distinct(db, Etablissement.statut),
        "types_enseignement": _distinct(db, Etablissement.type_enseignement),
        "sections":           _distinct(db, Etablissement.section),
        "cycles":             _distinct(db, Etablissement.cycle_enseignement),
        "filieres":           _distinct(db, Etablissement.filiere),
        "routes":             _distinct(db, Etablissement.route),
        "espaces_sportifs":   _distinct(db, Etablissement.espace_sportif),
        "moyens_transport":   _distinct(db, Etablissement.moyen_transport),
        "cantines":           _distinct(db, Etablissement.cantine_scolaire),
    }


@router.get("/search/options")
def search_options(db: Session = Depends(get_db)):
    """Retourne les valeurs distinctes présentes en BD pour chaque critère de recherche."""
    return get_db_options(db)


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
    moyen_transport: str | None = None,
    cantine_scolaire: str | None = None,
    espace_sportif: str | None = None,
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
        filiere=filiere, route=route,
        moyen_transport=moyen_transport, cantine_scolaire=cantine_scolaire, espace_sportif=espace_sportif,
        telephone=telephone,
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


@router.get("/search/ai")
def search_ai(
    query: str,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Recherche en langage naturel avec filtres injectés depuis la BD.
    Retourne les résultats + header X-Parsed-Filters avec les filtres appliqués.
    """
    options = get_db_options(db)
    filters = parse_natural_language_query(query, options)
    parsed = filters.model_dump(exclude_none=True, exclude={"page", "limit"})
    logger.info(f"AI search '{query}' → filters: {parsed}")

    filters.page = page
    filters.limit = limit
    results = paginate(apply_filters(db, filters), page, limit)
    if not results and filters.q:
        results = levenshtein_best_matches(db, filters.q, limit=limit)

    from app.schemas.etablissement import EtablissementOut
    data = [EtablissementOut.model_validate(r).model_dump() for r in results]
    return JSONResponse(
        content=data,
        headers={"X-Parsed-Filters": json.dumps(parsed, ensure_ascii=False)},
    )

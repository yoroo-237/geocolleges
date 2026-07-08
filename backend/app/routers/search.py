from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.etablissement import EtablissementOut, SearchFilters
from app.services.search_service import apply_filters, levenshtein_best_matches
from app.services.ai_search_service import parse_natural_language_query

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=list[EtablissementOut])
def search(
    q: str | None = None,
    nom: str | None = None,
    quartier: str | None = None,
    section: str | None = None,
    cycle: str | None = None,
    statut: str | None = None,
    route: str | None = None,
    bus: bool | None = None,
    cantine: bool | None = None,
    sport: bool | None = None,
    filiere: str | None = None,
    type_enseignement: str | None = None,
    fuzzy: bool = False,
    db: Session = Depends(get_db),
):
    filters = SearchFilters(
        q=q, nom=nom, quartier=quartier, section=section, cycle=cycle, statut=statut,
        route=route, bus=bus, cantine=cantine, sport=sport, filiere=filiere,
        type_enseignement=type_enseignement, fuzzy=fuzzy,
    )

    if q and fuzzy:
        # tente d'abord pg_trgm ; si aucun résultat, retombe sur Levenshtein pur-Python
        results = apply_filters(db, filters).limit(50).all()
        if not results:
            results = levenshtein_best_matches(db, q, limit=20)
        return results

    return apply_filters(db, filters).limit(200).all()


@router.get("/search/ai", response_model=list[EtablissementOut])
def search_ai(query: str, db: Session = Depends(get_db)):
    """Recherche en langage naturel. Ex: 'je cherche un lycée public avec bus à Sodiko'.
    Utilise Claude API si une clé est configurée, sinon fallback local automatique."""
    filters = parse_natural_language_query(query)
    results = apply_filters(db, filters).limit(50).all()
    if not results and filters.q:
        results = levenshtein_best_matches(db, filters.q, limit=20)
    return results

from sqlalchemy import or_, func, text
from sqlalchemy.orm import Session
import Levenshtein

from app.models.etablissement import Etablissement
from app.schemas.etablissement import SearchFilters

BUS_DISPONIBLE = "bus disponible"
CANTINE_MOTS = ["interieur", "intérieur", "exterieur", "extérieur"]
SPORT_DISPONIBLE_EXCLUDE = "pas d'espace"


def _bus_filter(query, val: bool):
    if val:
        return query.filter(
            Etablissement.moyen_transport.ilike("%disponible%"),
            ~Etablissement.moyen_transport.ilike("%non%"),
        )
    return query.filter(Etablissement.moyen_transport.ilike("%non%"))


def _cantine_filter(query, val: bool):
    if val:
        return query.filter(Etablissement.cantine_scolaire.isnot(None), Etablissement.cantine_scolaire != "")
    return query.filter(or_(Etablissement.cantine_scolaire.is_(None), Etablissement.cantine_scolaire == ""))


def _sport_filter(query, val: bool):
    if val:
        return query.filter(~Etablissement.espace_sportif.ilike("pas d%"))
    return query.filter(Etablissement.espace_sportif.ilike("pas d%"))


def apply_filters(db: Session, f: SearchFilters):
    query = db.query(Etablissement)

    if f.nom:
        query = query.filter(Etablissement.nom.ilike(f"%{f.nom}%"))
    if f.quartier:
        query = query.filter(Etablissement.quartier_nom.ilike(f"%{f.quartier}%"))
    if f.section:
        query = query.filter(Etablissement.section.ilike(f"%{f.section}%"))
    if f.cycle:
        query = query.filter(Etablissement.cycle_enseignement.ilike(f"%{f.cycle}%"))
    if f.statut:
        query = query.filter(Etablissement.statut.ilike(f.statut))
    if f.route:
        query = query.filter(Etablissement.route.ilike(f"%{f.route}%"))
    if f.filiere:
        query = query.filter(Etablissement.filiere.ilike(f"%{f.filiere}%"))
    if f.type_enseignement:
        query = query.filter(Etablissement.type_enseignement.ilike(f"%{f.type_enseignement}%"))
    if f.bus is not None:
        query = _bus_filter(query, f.bus)
    if f.cantine is not None:
        query = _cantine_filter(query, f.cantine)
    if f.sport is not None:
        query = _sport_filter(query, f.sport)

    if f.q:
        if f.fuzzy:
            # Recherche floue via pg_trgm (similarité), tolérante aux fautes de frappe
            query = query.filter(
                func.similarity(func.unaccent(func.lower(Etablissement.nom)), func.unaccent(f.q.lower())) > 0.15
            ).order_by(
                func.similarity(func.unaccent(func.lower(Etablissement.nom)), func.unaccent(f.q.lower())).desc()
            )
        else:
            like = f"%{f.q}%"
            query = query.filter(
                or_(
                    Etablissement.nom.ilike(like),
                    Etablissement.quartier_nom.ilike(like),
                    Etablissement.filiere.ilike(like),
                )
            )

    if f.lat is not None and f.lon is not None:
        rayon = f.rayon_m or 2000
        point = func.ST_SetSRID(func.ST_MakePoint(f.lon, f.lat), 4326)
        query = query.filter(func.ST_DWithin(func.cast(Etablissement.geom, type_=None), point, rayon)) \
            if False else query  # géré via /nearby dédié (raw SQL) pour cast geography propre

    return query


def levenshtein_best_matches(db: Session, term: str, limit: int = 10):
    """Fallback 100% local (sans IA) : classe tous les établissements par distance de Levenshtein
    sur le nom + quartier, utile quand ANTHROPIC_API_KEY n'est pas configurée."""
    all_rows = db.query(Etablissement).all()
    term_norm = term.lower().strip()

    scored = []
    for e in all_rows:
        haystack = f"{e.nom} {e.quartier_nom or ''} {e.filiere or ''}".lower()
        # distance normalisée sur le meilleur segment (mot le plus proche)
        best = min(
            (Levenshtein.distance(term_norm, w) for w in haystack.split()),
            default=len(term_norm),
        )
        ratio = Levenshtein.ratio(term_norm, haystack)
        scored.append((ratio, best, e))

    scored.sort(key=lambda t: (-t[0], t[1]))
    return [e for _, _, e in scored[:limit]]

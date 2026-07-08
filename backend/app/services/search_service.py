from sqlalchemy import or_, func, cast
from sqlalchemy.orm import Session
from geoalchemy2 import Geography
import Levenshtein

from app.models.etablissement import Etablissement
from app.schemas.etablissement import SearchFilters

_ALL_TEXT_FIELDS = [
    Etablissement.nom,
    Etablissement.quartier_nom,
    Etablissement.statut,
    Etablissement.type_enseignement,
    Etablissement.section,
    Etablissement.cycle_enseignement,
    Etablissement.filiere,
    Etablissement.route,
    Etablissement.espace_sportif,
    Etablissement.moyen_transport,
    Etablissement.cantine_scolaire,
    Etablissement.telephone,
]


def _bus_filter(query, val: bool):
    if val:
        return query.filter(
            Etablissement.moyen_transport.ilike("%disponible%"),
            ~Etablissement.moyen_transport.ilike("%non%"),
        )
    return query.filter(Etablissement.moyen_transport.ilike("%non%"))


def _cantine_filter(query, val: bool):
    if val:
        return query.filter(
            Etablissement.cantine_scolaire.isnot(None),
            Etablissement.cantine_scolaire != "",
        )
    return query.filter(
        or_(Etablissement.cantine_scolaire.is_(None), Etablissement.cantine_scolaire == "")
    )


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
    if f.statut:
        query = query.filter(Etablissement.statut.ilike(f"%{f.statut}%"))
    if f.type_enseignement:
        query = query.filter(Etablissement.type_enseignement.ilike(f"%{f.type_enseignement}%"))
    if f.section:
        query = query.filter(Etablissement.section.ilike(f"%{f.section}%"))
    if f.cycle:
        query = query.filter(Etablissement.cycle_enseignement.ilike(f"%{f.cycle}%"))
    if f.filiere:
        query = query.filter(Etablissement.filiere.ilike(f"%{f.filiere}%"))
    if f.route:
        query = query.filter(Etablissement.route.ilike(f"%{f.route}%"))
    if f.telephone:
        query = query.filter(Etablissement.telephone.ilike(f"%{f.telephone}%"))
    if f.bus is not None:
        query = _bus_filter(query, f.bus)
    if f.cantine is not None:
        query = _cantine_filter(query, f.cantine)
    if f.sport is not None:
        query = _sport_filter(query, f.sport)

    if f.q:
        like = f"%{f.q}%"
        if f.fuzzy:
            # Recherche floue pg_trgm sur tous les champs texte
            q_norm = func.unaccent(f.q.lower())
            query = query.filter(
                or_(
                    func.similarity(func.unaccent(func.lower(Etablissement.nom)), q_norm) > 0.15,
                    func.similarity(func.unaccent(func.lower(func.coalesce(Etablissement.quartier_nom, ""))), q_norm) > 0.15,
                    func.similarity(func.unaccent(func.lower(func.coalesce(Etablissement.filiere, ""))), q_norm) > 0.15,
                    func.similarity(func.unaccent(func.lower(func.coalesce(Etablissement.type_enseignement, ""))), q_norm) > 0.15,
                    func.similarity(func.unaccent(func.lower(func.coalesce(Etablissement.section, ""))), q_norm) > 0.15,
                    func.similarity(func.unaccent(func.lower(func.coalesce(Etablissement.cycle_enseignement, ""))), q_norm) > 0.15,
                )
            ).order_by(
                func.similarity(func.unaccent(func.lower(Etablissement.nom)), q_norm).desc()
            )
        else:
            query = query.filter(
                or_(*[col.ilike(like) for col in _ALL_TEXT_FIELDS])
            )

    if f.lat is not None and f.lon is not None:
        rayon = f.rayon_m or 2000
        point = cast(
            func.ST_SetSRID(func.ST_MakePoint(f.lon, f.lat), 4326),
            Geography,
        )
        query = query.filter(
            func.ST_DWithin(cast(Etablissement.geom, Geography), point, rayon)
        )

    return query


def paginate(query, page: int, limit: int):
    offset = (max(page, 1) - 1) * limit
    return query.offset(offset).limit(limit).all()


def levenshtein_best_matches(db: Session, term: str, limit: int = 10):
    """Fallback pur-Python : score Levenshtein sur tous les champs texte."""
    all_rows = db.query(Etablissement).all()
    term_norm = term.lower().strip()

    scored = []
    for e in all_rows:
        haystack = " ".join(filter(None, [
            e.nom, e.quartier_nom, e.statut, e.type_enseignement,
            e.section, e.cycle_enseignement, e.filiere, e.route,
            e.espace_sportif, e.moyen_transport, e.cantine_scolaire,
        ])).lower()
        best = min(
            (Levenshtein.distance(term_norm, w) for w in haystack.split()),
            default=len(term_norm),
        )
        ratio = Levenshtein.ratio(term_norm, haystack)
        scored.append((ratio, best, e))

    scored.sort(key=lambda t: (-t[0], t[1]))
    return [e for _, _, e in scored[:limit]]

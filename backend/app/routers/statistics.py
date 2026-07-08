from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.etablissement import Etablissement

router = APIRouter(prefix="/api", tags=["statistics"])


@router.get("/statistics")
def statistics(db: Session = Depends(get_db)):
    total = db.query(Etablissement).count()

    def rows_from_view(view_name: str, key: str):
        result = db.execute(text(f"SELECT * FROM {view_name}")).mappings().all()
        return [dict(r) for r in result]

    par_quartier = rows_from_view("v_stats_par_quartier", "quartier_nom")
    par_statut = rows_from_view("v_stats_par_statut", "statut")
    par_section = rows_from_view("v_stats_par_section", "section")
    par_cycle = rows_from_view("v_stats_par_cycle", "cycle_enseignement")

    avec_bus = db.query(Etablissement).filter(
        Etablissement.moyen_transport.ilike("%disponible%"),
        ~Etablissement.moyen_transport.ilike("%non%"),
    ).count()
    avec_cantine = db.query(Etablissement).filter(
        Etablissement.cantine_scolaire.isnot(None), Etablissement.cantine_scolaire != ""
    ).count()
    avec_sport = db.query(Etablissement).filter(~Etablissement.espace_sportif.ilike("pas d%")).count()

    return {
        "total_etablissements": total,
        "kpis": {
            "avec_bus": avec_bus,
            "sans_bus": total - avec_bus,
            "avec_cantine": avec_cantine,
            "avec_sport": avec_sport,
            "nb_quartiers": len(par_quartier),
        },
        "par_quartier": par_quartier,
        "par_statut": par_statut,
        "par_section": par_section,
        "par_cycle": par_cycle,
    }

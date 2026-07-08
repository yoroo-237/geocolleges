from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.etablissement import Etablissement

router = APIRouter(prefix="/api", tags=["map"])


@router.get("/map")
def get_map_geojson(db: Session = Depends(get_db)):
    """Retourne tous les établissements au format GeoJSON FeatureCollection, prêt pour Leaflet."""
    rows = db.query(Etablissement).filter(Etablissement.geom.isnot(None)).all()
    features = []
    for e in rows:
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [e.longitude, e.latitude]},
                "properties": {
                    "id": e.id,
                    "nom": e.nom,
                    "statut": e.statut,
                    "quartier": e.quartier_nom,
                    "section": e.section,
                    "cycle": e.cycle_enseignement,
                    "bus": e.moyen_transport,
                    "cantine": e.cantine_scolaire,
                    "sport": e.espace_sportif,
                    "telephone": e.telephone,
                    "route": e.route,
                    "filiere": e.filiere,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


@router.get("/nearby")
def nearby(lat: float, lon: float, rayon_m: float = 1500, db: Session = Depends(get_db)):
    """Établissements dans un rayon donné (mètres) autour d'un point, triés par distance."""
    rows = db.execute(
        text("SELECT * FROM etablissements_proches(:lat, :lon, :rayon)"),
        {"lat": lat, "lon": lon, "rayon": rayon_m},
    ).mappings().all()
    return [dict(r) for r in rows]

import csv
import io

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role, hash_password
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.models.etablissement import Etablissement, Quartier
from app.schemas.user import UserCreate, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_role("admin"))):
    return db.query(User).all()


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.add(ActivityLog(user_id=admin.id, action="CREATE", entity="user", entity_id=user.id))
    db.commit()
    return user


@router.put("/users/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.is_active = not user.is_active
    db.commit()
    db.add(ActivityLog(user_id=admin.id, action="UPDATE", entity="user", entity_id=user.id))
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_role("admin"))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    db.delete(user)
    db.add(ActivityLog(user_id=admin.id, action="DELETE", entity="user", entity_id=user_id))
    db.commit()
    return {"detail": "Utilisateur supprimé"}


@router.get("/logs")
def get_logs(limit: int = 200, db: Session = Depends(get_db), _: User = Depends(require_role("admin"))):
    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id, "user_id": l.user_id, "action": l.action, "entity": l.entity,
            "entity_id": l.entity_id, "details": l.details, "created_at": l.created_at,
        }
        for l in logs
    ]


@router.post("/import-csv")
def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin", "gestionnaire")),
):
    """Import CSV via l'interface admin (même logique que scripts/import_csv.py, en mémoire)."""
    from pyproj import Transformer

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    transformer = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True)

    count = 0
    for row in reader:
        try:
            x = float(row["Coord_X"])
            y = float(row["Coord_Y"])
            lon, lat = transformer.transform(x, y)
        except (ValueError, KeyError, TypeError):
            lat, lon, x, y = None, None, None, None

        quartier_nom = (row.get("quartiers") or "").strip() or None
        if quartier_nom:
            db.merge(Quartier(nom=quartier_nom)) if False else None
            existing = db.query(Quartier).filter(Quartier.nom == quartier_nom).first()
            if not existing:
                db.add(Quartier(nom=quartier_nom))
                db.flush()

        object_id = int(row["OBJECTID"]) if row.get("OBJECTID") else None
        existing_etab = db.query(Etablissement).filter(Etablissement.object_id == object_id).first() if object_id else None

        data = dict(
            object_id=object_id,
            nom=(row.get("Noms_des_établissements") or "Établissement").replace("_", " ").strip(),
            statut=(row.get("STATUT") or "").strip() or "Public",
            type_enseignement=(row.get("type_d_enseignents") or "").strip() or None,
            quartier_nom=quartier_nom,
            moyen_transport=(row.get("moyen_de_transport") or "").strip() or None,
            cantine_scolaire=(row.get("cantines_scolaires") or "").strip() or None,
            telephone=(row.get("numero_de_telephone") or "").strip() or None,
            section=(row.get("Section") or "").strip() or None,
            cycle_enseignement=(row.get("Cycle_d_enseignement") or "").strip() or None,
            route=(row.get("Route") or "").strip() or None,
            filiere=(row.get("Filière") or "").strip() or None,
            espace_sportif=(row.get("Espace_sportif") or "").strip() or None,
            coord_x_utm=x, coord_y_utm=y, latitude=lat, longitude=lon,
        )

        if existing_etab:
            for k, v in data.items():
                setattr(existing_etab, k, v)
        else:
            db.add(Etablissement(**data))
        count += 1

    db.commit()
    db.add(ActivityLog(user_id=admin.id, action="IMPORT", entity="etablissement", details={"lignes": count}))
    db.commit()
    return {"detail": f"{count} lignes importées/mises à jour"}

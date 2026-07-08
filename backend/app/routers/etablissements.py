from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.etablissement import Etablissement
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.etablissement import EtablissementOut, EtablissementCreate, EtablissementUpdate

router = APIRouter(prefix="/api", tags=["etablissements"])


@router.get("/colleges", response_model=list[EtablissementOut])
def list_colleges(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    return db.query(Etablissement).offset(skip).limit(limit).all()


@router.get("/college/{college_id}", response_model=EtablissementOut)
def get_college(college_id: int, db: Session = Depends(get_db)):
    obj = db.query(Etablissement).filter(Etablissement.id == college_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Établissement introuvable")
    return obj


@router.post("/college", response_model=EtablissementOut)
def create_college(
    payload: EtablissementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "gestionnaire")),
):
    obj = Etablissement(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.add(ActivityLog(user_id=user.id, action="CREATE", entity="etablissement", entity_id=obj.id))
    db.commit()
    return obj


@router.put("/college/{college_id}", response_model=EtablissementOut)
def update_college(
    college_id: int,
    payload: EtablissementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "gestionnaire")),
):
    obj = db.query(Etablissement).filter(Etablissement.id == college_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Établissement introuvable")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    db.add(ActivityLog(user_id=user.id, action="UPDATE", entity="etablissement", entity_id=obj.id))
    db.commit()
    return obj


@router.delete("/college/{college_id}")
def delete_college(
    college_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    obj = db.query(Etablissement).filter(Etablissement.id == college_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Établissement introuvable")
    db.delete(obj)
    db.add(ActivityLog(user_id=user.id, action="DELETE", entity="etablissement", entity_id=college_id))
    db.commit()
    return {"detail": "Établissement supprimé"}

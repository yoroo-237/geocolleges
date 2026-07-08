from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, hash_password, get_current_user
from app.models.user import User
from app.models.activity_log import ActivityLog
from app.schemas.user import LoginRequest, Token, UserOut, UserCreate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = create_access_token({"sub": user.email, "role": user.role})
    db.add(ActivityLog(user_id=user.id, action="LOGIN", entity="user", entity_id=user.id))
    db.commit()
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Auto-inscription en rôle 'consultation' uniquement — la promotion en
    admin/gestionnaire se fait ensuite via l'interface d'administration."""
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role="consultation",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

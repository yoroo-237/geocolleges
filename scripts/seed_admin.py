"""Crée le compte administrateur par défaut si aucun n'existe déjà."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@geocolleges.cm")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "Admin123!")


def main():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            print(f"Admin déjà présent: {ADMIN_EMAIL}")
            return
        admin = User(
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            full_name="Administrateur GeoColleges",
            role="admin",
        )
        db.add(admin)
        db.commit()
        print(f"Admin créé: {ADMIN_EMAIL} / {ADMIN_PASSWORD} (à changer immédiatement)")
    finally:
        db.close()


if __name__ == "__main__":
    main()

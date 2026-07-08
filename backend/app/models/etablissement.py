from sqlalchemy import Column, Integer, String, DOUBLE_PRECISION, ForeignKey, DateTime, func

from app.core.database import Base


class Quartier(Base):
    __tablename__ = "quartiers"
    id = Column(Integer, primary_key=True)
    nom = Column(String(150), unique=True, nullable=False)


class Etablissement(Base):
    __tablename__ = "etablissements"

    id = Column(Integer, primary_key=True)
    object_id = Column(Integer, unique=True)
    nom = Column(String(255), nullable=False)
    statut = Column(String(50), nullable=False)
    type_enseignement = Column(String(100))
    quartier_id = Column(Integer, ForeignKey("quartiers.id"))
    quartier_nom = Column(String(150))
    moyen_transport = Column(String(100))
    cantine_scolaire = Column(String(100))
    telephone = Column(String(30))
    section = Column(String(150))
    cycle_enseignement = Column(String(150))
    route = Column(String(100))
    filiere = Column(String(255))
    espace_sportif = Column(String(150))
    coord_x_utm = Column(DOUBLE_PRECISION)
    coord_y_utm = Column(DOUBLE_PRECISION)
    latitude = Column(DOUBLE_PRECISION)
    longitude = Column(DOUBLE_PRECISION)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

from typing import Optional
from pydantic import BaseModel, ConfigDict


class EtablissementBase(BaseModel):
    nom: str
    statut: str
    type_enseignement: Optional[str] = None
    quartier_nom: Optional[str] = None
    moyen_transport: Optional[str] = None
    cantine_scolaire: Optional[str] = None
    telephone: Optional[str] = None
    section: Optional[str] = None
    cycle_enseignement: Optional[str] = None
    route: Optional[str] = None
    filiere: Optional[str] = None
    espace_sportif: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class EtablissementCreate(EtablissementBase):
    pass


class EtablissementUpdate(BaseModel):
    nom: Optional[str] = None
    statut: Optional[str] = None
    type_enseignement: Optional[str] = None
    quartier_nom: Optional[str] = None
    moyen_transport: Optional[str] = None
    cantine_scolaire: Optional[str] = None
    telephone: Optional[str] = None
    section: Optional[str] = None
    cycle_enseignement: Optional[str] = None
    route: Optional[str] = None
    filiere: Optional[str] = None
    espace_sportif: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class EtablissementOut(EtablissementBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    object_id: Optional[int] = None


class EtablissementProche(BaseModel):
    id: int
    nom: str
    quartier_nom: Optional[str]
    distance_m: float


class SearchFilters(BaseModel):
    q: Optional[str] = None
    nom: Optional[str] = None
    quartier: Optional[str] = None
    section: Optional[str] = None
    cycle: Optional[str] = None
    statut: Optional[str] = None
    route: Optional[str] = None
    bus: Optional[bool] = None
    cantine: Optional[bool] = None
    sport: Optional[bool] = None
    filiere: Optional[str] = None
    type_enseignement: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    rayon_m: Optional[float] = None
    fuzzy: bool = False

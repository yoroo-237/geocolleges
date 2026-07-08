-- ============================================================
-- GeoColleges Douala IV — Schéma PostgreSQL/PostGIS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- recherche floue / similarité
CREATE EXTENSION IF NOT EXISTS unaccent;     -- recherche insensible aux accents
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Table de référence : quartiers (normalisation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quartiers (
    id          SERIAL PRIMARY KEY,
    nom         VARCHAR(150) UNIQUE NOT NULL
);

-- ------------------------------------------------------------
-- Table principale : établissements scolaires
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etablissements (
    id                      SERIAL PRIMARY KEY,
    object_id               INTEGER UNIQUE,               -- OBJECTID source CSV
    nom                     VARCHAR(255) NOT NULL,
    statut                  VARCHAR(50)  NOT NULL CHECK (statut IN ('Public', 'Privé')),
    type_enseignement       VARCHAR(100),                  -- general / technique/general ...
    quartier_id             INTEGER REFERENCES quartiers(id),
    quartier_nom            VARCHAR(150),                  -- dénormalisé pour perf recherche
    moyen_transport          VARCHAR(100),                  -- bus disponible / non disponible
    cantine_scolaire        VARCHAR(100),
    telephone               VARCHAR(30),
    section                 VARCHAR(150),                  -- Francophone / Anglophone / bilingue
    cycle_enseignement      VARCHAR(150),
    route                   VARCHAR(100),
    filiere                 VARCHAR(255),
    espace_sportif          VARCHAR(150),
    coord_x_utm             DOUBLE PRECISION,               -- coordonnée source (UTM)
    coord_y_utm             DOUBLE PRECISION,
    latitude                DOUBLE PRECISION,               -- WGS84
    longitude               DOUBLE PRECISION,               -- WGS84
    geom                    GEOMETRY(Point, 4326),          -- géométrie PostGIS WGS84
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Index spatial (obligatoire pour perf des requêtes géo)
CREATE INDEX IF NOT EXISTS idx_etablissements_geom ON etablissements USING GIST (geom);

-- Index trigram pour recherche floue sur le nom
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_trgm ON etablissements USING GIN (nom gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_etablissements_quartier_trgm ON etablissements USING GIN (quartier_nom gin_trgm_ops);

-- Index classiques sur colonnes de filtrage fréquent
CREATE INDEX IF NOT EXISTS idx_etablissements_statut ON etablissements (statut);
CREATE INDEX IF NOT EXISTS idx_etablissements_section ON etablissements (section);
CREATE INDEX IF NOT EXISTS idx_etablissements_cycle ON etablissements (cycle_enseignement);
CREATE INDEX IF NOT EXISTS idx_etablissements_transport ON etablissements (moyen_transport);
CREATE INDEX IF NOT EXISTS idx_etablissements_cantine ON etablissements (cantine_scolaire);
CREATE INDEX IF NOT EXISTS idx_etablissements_sport ON etablissements (espace_sportif);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_etablissements_updated_at ON etablissements;
CREATE TRIGGER trg_etablissements_updated_at
    BEFORE UPDATE ON etablissements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger: recalcule automatiquement geom si lat/lon changent
CREATE OR REPLACE FUNCTION sync_geom() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_etablissements_sync_geom ON etablissements;
CREATE TRIGGER trg_etablissements_sync_geom
    BEFORE INSERT OR UPDATE ON etablissements
    FOR EACH ROW EXECUTE FUNCTION sync_geom();

-- ------------------------------------------------------------
-- Utilisateurs & authentification
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    role            VARCHAR(20) NOT NULL DEFAULT 'consultation'
                     CHECK (role IN ('admin', 'gestionnaire', 'consultation')),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Journal d'activité (audit log admin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,       -- CREATE / UPDATE / DELETE / IMPORT / EXPORT / LOGIN
    entity          VARCHAR(50),                -- etablissement / user
    entity_id       INTEGER,
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Vues utiles
-- ------------------------------------------------------------

-- Vue GeoJSON-ready simplifiée
CREATE OR REPLACE VIEW v_etablissements_geo AS
SELECT
    id, object_id, nom, statut, type_enseignement, quartier_nom,
    moyen_transport, cantine_scolaire, telephone, section, cycle_enseignement,
    route, filiere, espace_sportif, latitude, longitude, geom
FROM etablissements;

-- Vue statistiques par quartier
CREATE OR REPLACE VIEW v_stats_par_quartier AS
SELECT
    quartier_nom,
    COUNT(*)                                            AS total,
    COUNT(*) FILTER (WHERE statut = 'Public')           AS publics,
    COUNT(*) FILTER (WHERE statut = 'Privé')            AS prives,
    COUNT(*) FILTER (WHERE moyen_transport ILIKE '%disponible%' AND moyen_transport NOT ILIKE '%non%') AS avec_bus,
    COUNT(*) FILTER (WHERE espace_sportif ILIKE '%établissement%' AND espace_sportif NOT ILIKE 'pas%') AS avec_sport
FROM etablissements
GROUP BY quartier_nom
ORDER BY total DESC;

-- Vue statistiques par statut
CREATE OR REPLACE VIEW v_stats_par_statut AS
SELECT statut, COUNT(*) AS total
FROM etablissements
GROUP BY statut;

-- Vue statistiques par section (francophone/anglophone/bilingue)
CREATE OR REPLACE VIEW v_stats_par_section AS
SELECT section, COUNT(*) AS total
FROM etablissements
GROUP BY section;

-- Vue statistiques par cycle
CREATE OR REPLACE VIEW v_stats_par_cycle AS
SELECT cycle_enseignement, COUNT(*) AS total
FROM etablissements
GROUP BY cycle_enseignement;

-- ------------------------------------------------------------
-- Procédures utiles
-- ------------------------------------------------------------

-- Recherche des établissements à proximité (rayon en mètres)
CREATE OR REPLACE FUNCTION etablissements_proches(
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION,
    p_rayon_m DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
    id INTEGER, nom VARCHAR, quartier_nom VARCHAR, distance_m DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.nom, e.quartier_nom,
        ST_Distance(
            e.geom::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) AS distance_m
    FROM etablissements e
    WHERE ST_DWithin(
        e.geom::geography,
        ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
        p_rayon_m
    )
    ORDER BY distance_m ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Recherche floue (similarité trigram) sur le nom d'établissement
CREATE OR REPLACE FUNCTION recherche_floue_nom(p_terme TEXT, p_seuil REAL DEFAULT 0.2)
RETURNS TABLE (id INTEGER, nom VARCHAR, similarite REAL) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.nom, similarity(unaccent(lower(e.nom)), unaccent(lower(p_terme))) AS similarite
    FROM etablissements e
    WHERE similarity(unaccent(lower(e.nom)), unaccent(lower(p_terme))) > p_seuil
    ORDER BY similarite DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Utilisateur admin par défaut (mot de passe: Admin123! -- à changer immédiatement)
-- Hash bcrypt généré au démarrage par scripts/seed_admin.py, pas ici (évite dépendance pgcrypto figée).

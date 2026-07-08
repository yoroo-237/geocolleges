-- ============================================================
-- GeoColleges Douala IV — Schéma PostgreSQL (sans PostGIS)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
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
    object_id               INTEGER UNIQUE,
    nom                     VARCHAR(255) NOT NULL,
    statut                  VARCHAR(50)  NOT NULL CHECK (lower(unaccent(statut)) IN ('public', 'prive')),
    type_enseignement       VARCHAR(100),
    quartier_id             INTEGER REFERENCES quartiers(id),
    quartier_nom            VARCHAR(150),
    moyen_transport         VARCHAR(100),
    cantine_scolaire        VARCHAR(100),
    telephone               VARCHAR(30),
    section                 VARCHAR(150),
    cycle_enseignement      VARCHAR(150),
    route                   VARCHAR(100),
    filiere                 VARCHAR(255),
    espace_sportif          VARCHAR(150),
    coord_x_utm             DOUBLE PRECISION,
    coord_y_utm             DOUBLE PRECISION,
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Index trigram pour recherche floue
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_trgm      ON etablissements USING GIN (nom gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_etablissements_quartier_trgm ON etablissements USING GIN (quartier_nom gin_trgm_ops);

-- Index classiques
CREATE INDEX IF NOT EXISTS idx_etablissements_statut    ON etablissements (statut);
CREATE INDEX IF NOT EXISTS idx_etablissements_section   ON etablissements (section);
CREATE INDEX IF NOT EXISTS idx_etablissements_cycle     ON etablissements (cycle_enseignement);
CREATE INDEX IF NOT EXISTS idx_etablissements_transport ON etablissements (moyen_transport);
CREATE INDEX IF NOT EXISTS idx_etablissements_cantine   ON etablissements (cantine_scolaire);
CREATE INDEX IF NOT EXISTS idx_etablissements_sport     ON etablissements (espace_sportif);
CREATE INDEX IF NOT EXISTS idx_etablissements_latlon    ON etablissements (latitude, longitude);

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
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,
    entity      VARCHAR(50),
    entity_id   INTEGER,
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Vues utiles
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_etablissements_geo AS
SELECT id, object_id, nom, statut, type_enseignement, quartier_nom,
       moyen_transport, cantine_scolaire, telephone, section, cycle_enseignement,
       route, filiere, espace_sportif, latitude, longitude
FROM etablissements;

CREATE OR REPLACE VIEW v_stats_par_quartier AS
SELECT quartier_nom,
       COUNT(*)                                                                                   AS total,
       COUNT(*) FILTER (WHERE statut = 'Public')                                                  AS publics,
       COUNT(*) FILTER (WHERE statut = 'Privé')                                                   AS prives,
       COUNT(*) FILTER (WHERE moyen_transport ILIKE '%disponible%'
                          AND moyen_transport NOT ILIKE '%non%')                                  AS avec_bus,
       COUNT(*) FILTER (WHERE espace_sportif ILIKE '%établissement%'
                          AND espace_sportif NOT ILIKE 'pas%')                                    AS avec_sport
FROM etablissements
GROUP BY quartier_nom
ORDER BY total DESC;

CREATE OR REPLACE VIEW v_stats_par_statut AS
SELECT statut, COUNT(*) AS total FROM etablissements GROUP BY statut;

CREATE OR REPLACE VIEW v_stats_par_section AS
SELECT section, COUNT(*) AS total FROM etablissements GROUP BY section;

CREATE OR REPLACE VIEW v_stats_par_cycle AS
SELECT cycle_enseignement, COUNT(*) AS total FROM etablissements GROUP BY cycle_enseignement;

-- ------------------------------------------------------------
-- Recherche de proximité — Haversine pur SQL (sans PostGIS)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION etablissements_proches(
    p_lat    DOUBLE PRECISION,
    p_lon    DOUBLE PRECISION,
    p_rayon_m DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (id INTEGER, nom VARCHAR, quartier_nom VARCHAR, distance_m DOUBLE PRECISION) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.nom, e.quartier_nom,
        (6371000 * acos(LEAST(1.0,
            cos(radians(p_lat)) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(p_lon)) +
            sin(radians(p_lat)) * sin(radians(e.latitude))
        ))) AS distance_m
    FROM etablissements e
    WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
      AND (6371000 * acos(LEAST(1.0,
            cos(radians(p_lat)) * cos(radians(e.latitude)) *
            cos(radians(e.longitude) - radians(p_lon)) +
            sin(radians(p_lat)) * sin(radians(e.latitude))
        ))) <= p_rayon_m
    ORDER BY distance_m ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Recherche floue trigram
CREATE OR REPLACE FUNCTION recherche_floue_nom(p_terme TEXT, p_seuil REAL DEFAULT 0.2)
RETURNS TABLE (id INTEGER, nom VARCHAR, similarite REAL) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.nom,
           similarity(unaccent(lower(e.nom)), unaccent(lower(p_terme))) AS similarite
    FROM etablissements e
    WHERE similarity(unaccent(lower(e.nom)), unaccent(lower(p_terme))) > p_seuil
    ORDER BY similarite DESC;
END;
$$ LANGUAGE plpgsql STABLE;

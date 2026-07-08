"""
Import automatique du CSV des établissements scolaires vers PostgreSQL/PostGIS.

Les coordonnées source (Coord_X, Coord_Y) sont en projection UTM Zone 32N
(EPSG:32632 — zone couvrant Douala, Cameroun). Ce script les convertit
automatiquement en latitude/longitude WGS84 (EPSG:4326) et génère la
géométrie PostGIS correspondante.

Usage:
    python scripts/import_csv.py --csv /path/to/donne_es_att_be_ri.csv
"""
import argparse
import csv
import os
import sys
import unicodedata

import psycopg2
from psycopg2.extras import execute_values
from pyproj import Transformer

DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://geocolleges:geocolleges@localhost:5432/geocolleges",
)

# UTM 32N (mètres, hémisphère nord — Douala ~4°N) -> WGS84 (lat/lon)
_transformer = Transformer.from_crs("EPSG:32632", "EPSG:4326", always_xy=True)


def utm_to_wgs84(x: float, y: float):
    lon, lat = _transformer.transform(x, y)
    return lat, lon


def clean(value: str):
    if value is None:
        return None
    value = unicodedata.normalize("NFC", value).strip()
    return value if value else None


def normalize_statut(value: str) -> str:
    if not value:
        return value
    v = unicodedata.normalize("NFC", value).strip().lower()
    if v == "public":
        return "Public"
    if "priv" in v:
        return "Privé"
    return value


def load_rows(csv_path: str):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            try:
                x = float(row["Coord_X"])
                y = float(row["Coord_Y"])
                lat, lon = utm_to_wgs84(x, y)
            except (ValueError, KeyError, TypeError):
                lat, lon = None, None
                x, y = None, None

            rows.append(
                {
                    "object_id": int(row["OBJECTID"]) if row.get("OBJECTID") else None,
                    "nom": clean(row.get("Noms_des_établissements", "")).replace("_", " ") if clean(row.get("Noms_des_établissements", "")) else "Établissement",
                    "statut": normalize_statut(clean(row.get("STATUT"))),
                    "type_enseignement": clean(row.get("type_d_enseignents")),
                    "quartier_nom": clean(row.get("quartiers")),
                    "moyen_transport": clean(row.get("moyen_de_transport")),
                    "cantine_scolaire": clean(row.get("cantines_scolaires")),
                    "telephone": clean(row.get("numero_de_telephone")),
                    "section": clean(row.get("Section")),
                    "cycle_enseignement": clean(row.get("Cycle_d_enseignement")),
                    "route": clean(row.get("Route")),
                    "filiere": clean(row.get("Filière")),
                    "espace_sportif": clean(row.get("Espace_sportif")),
                    "coord_x_utm": x,
                    "coord_y_utm": y,
                    "latitude": lat,
                    "longitude": lon,
                }
            )
        return rows


def upsert_quartiers(cur, rows):
    quartiers = sorted({r["quartier_nom"] for r in rows if r["quartier_nom"]})
    for q in quartiers:
        cur.execute(
            "INSERT INTO quartiers (nom) VALUES (%s) ON CONFLICT (nom) DO NOTHING",
            (q,),
        )


def upsert_etablissements(cur, rows):
    cols = [
        "object_id", "nom", "statut", "type_enseignement", "quartier_nom",
        "moyen_transport", "cantine_scolaire", "telephone", "section",
        "cycle_enseignement", "route", "filiere", "espace_sportif",
        "coord_x_utm", "coord_y_utm", "latitude", "longitude",
    ]
    values = [tuple(r[c] for c in cols) for r in rows]
    query = f"""
        INSERT INTO etablissements ({", ".join(cols)})
        VALUES %s
        ON CONFLICT (object_id) DO UPDATE SET
            nom = EXCLUDED.nom,
            statut = EXCLUDED.statut,
            type_enseignement = EXCLUDED.type_enseignement,
            quartier_nom = EXCLUDED.quartier_nom,
            moyen_transport = EXCLUDED.moyen_transport,
            cantine_scolaire = EXCLUDED.cantine_scolaire,
            telephone = EXCLUDED.telephone,
            section = EXCLUDED.section,
            cycle_enseignement = EXCLUDED.cycle_enseignement,
            route = EXCLUDED.route,
            filiere = EXCLUDED.filiere,
            espace_sportif = EXCLUDED.espace_sportif,
            coord_x_utm = EXCLUDED.coord_x_utm,
            coord_y_utm = EXCLUDED.coord_y_utm,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude
    """
    execute_values(cur, query, values)

    # Lie quartier_id maintenant que la table quartiers est peuplée
    cur.execute(
        """
        UPDATE etablissements e
        SET quartier_id = q.id
        FROM quartiers q
        WHERE e.quartier_nom = q.nom AND e.quartier_id IS DISTINCT FROM q.id
        """
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Chemin vers le fichier CSV source")
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(f"Fichier introuvable: {args.csv}", file=sys.stderr)
        sys.exit(1)

    rows = load_rows(args.csv)
    print(f"{len(rows)} lignes lues depuis {args.csv}")

    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            upsert_quartiers(cur, rows)
            upsert_etablissements(cur, rows)
        conn.commit()
        print("Import terminé avec succès.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

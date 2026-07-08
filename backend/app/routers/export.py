import csv
import io
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.etablissement import Etablissement

router = APIRouter(prefix="/api/export", tags=["export"])

COLUMNS = [
    "id", "nom", "statut", "type_enseignement", "quartier_nom", "moyen_transport",
    "cantine_scolaire", "telephone", "section", "cycle_enseignement", "route",
    "filiere", "espace_sportif", "latitude", "longitude",
]


def _rows(db: Session):
    return db.query(Etablissement).all()


@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(COLUMNS)
    for e in _rows(db):
        writer.writerow([getattr(e, c) for c in COLUMNS])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=etablissements.csv"},
    )


@router.get("/geojson")
def export_geojson(db: Session = Depends(get_db)):
    features = []
    for e in _rows(db):
        if e.latitude is None or e.longitude is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [e.longitude, e.latitude]},
                "properties": {c: getattr(e, c) for c in COLUMNS if c not in ("latitude", "longitude")},
            }
        )
    content = json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=etablissements.geojson"},
    )


@router.get("/sql")
def export_sql(db: Session = Depends(get_db)):
    lines = ["-- Export SQL généré automatiquement — table etablissements", ""]
    for e in _rows(db):
        vals = []
        for c in COLUMNS:
            v = getattr(e, c)
            if v is None:
                vals.append("NULL")
            elif isinstance(v, (int, float)):
                vals.append(str(v))
            else:
                vals.append("'" + str(v).replace("'", "''") + "'")
        lines.append(f"INSERT INTO etablissements ({', '.join(COLUMNS)}) VALUES ({', '.join(vals)});")
    content = "\n".join(lines)
    return StreamingResponse(
        iter([content]),
        media_type="application/sql",
        headers={"Content-Disposition": "attachment; filename=etablissements.sql"},
    )


@router.get("/excel")
def export_excel(db: Session = Depends(get_db)):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Établissements"
    ws.append(COLUMNS)
    for e in _rows(db):
        ws.append([getattr(e, c) for c in COLUMNS])
    for i, col in enumerate(COLUMNS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = max(14, len(col) + 2)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=etablissements.xlsx"},
    )


@router.get("/pdf")
def export_pdf(db: Session = Depends(get_db)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = [Paragraph("Établissements scolaires — Douala IV", styles["Title"])]

    headers = ["Nom", "Statut", "Quartier", "Section", "Bus", "Cantine", "Sport"]
    data = [headers]
    for e in _rows(db):
        data.append([e.nom, e.statut, e.quartier_nom or "", e.section or "", e.moyen_transport or "", e.cantine_scolaire or "", e.espace_sportif or ""])

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=etablissements.pdf"},
    )

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, etablissements, search, map as map_router, statistics, export, admin

app = FastAPI(
    title=settings.APP_NAME,
    description="API géospatiale des établissements scolaires de Douala IV",
    version="1.0.0",
)

_cors_origins = settings.CORS_ORIGINS + [
    o.strip() for o in settings.CORS_EXTRA_ORIGINS.split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Parsed-Filters"],
)

app.include_router(auth.router)
app.include_router(etablissements.router)
app.include_router(search.router)
app.include_router(map_router.router)
app.include_router(statistics.router)
app.include_router(export.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": settings.APP_NAME}

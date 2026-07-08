"""
Interprétation de requêtes en langage naturel vers filtres structurés SearchFilters.

Priorité des providers IA :
  1. DeepSeek  (DEEPSEEK_API_KEY configurée)
  2. Anthropic (ANTHROPIC_API_KEY configurée)
  3. Fallback local (règles + Levenshtein, sans IA)
"""
import json
import re

import httpx

from app.core.config import settings
from app.schemas.etablissement import SearchFilters

SYSTEM_PROMPT = """Tu es un moteur d'interprétation de requêtes pour une base de données
d'établissements scolaires à Douala IV, Cameroun.

Convertis la requête utilisateur en JSON strict avec ces clés (toutes optionnelles, n'inclure que celles mentionnées) :
- q           : texte libre résiduel non structuré
- quartier    : nom du quartier
- statut      : "Public" ou "Privé"
- section     : "Francophone", "Anglophone" ou "bilingue"
- cycle       : contient "premier cycle" et/ou "second cycle"
- type_enseignement : "general" ou "technique"
- filiere     : ex. "Scientifique", "Littéraire", "Technique"
- route       : type de route (bitumée, terre…)
- moyen_transport   : valeur exacte de transport (ex: "bus disponible")
- cantine_scolaire  : valeur exacte de cantine (ex: "interieur")
- espace_sportif    : valeur exacte d'espace sportif
- bus         : true si transport scolaire disponible, false si non disponible
- cantine     : true si cantine présente
- sport       : true si espace sportif présent
- fuzzy       : true si la requête semble approximative ou contient des fautes

Réponds UNIQUEMENT avec l'objet JSON, sans texte ni balises markdown."""


def _call_openai_compat(base_url: str, api_key: str, model: str, query: str) -> SearchFilters:
    """Appel générique vers toute API compatible OpenAI Chat Completions."""
    resp = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            "max_tokens": 400,
            "temperature": 0,
        },
        timeout=10.0,
    )
    resp.raise_for_status()
    text_out = resp.json()["choices"][0]["message"]["content"].strip()
    text_out = text_out.strip("`")
    if text_out.startswith("json"):
        text_out = text_out[4:].strip()
    data = json.loads(text_out)
    data.setdefault("fuzzy", True)
    return SearchFilters(**{k: v for k, v in data.items() if hasattr(SearchFilters, k)})


def _call_anthropic(query: str) -> SearchFilters:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    resp = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": query}],
    )
    text_out = "".join(b.text for b in resp.content if hasattr(b, "text")).strip().strip("`")
    if text_out.startswith("json"):
        text_out = text_out[4:].strip()
    data = json.loads(text_out)
    data.setdefault("fuzzy", True)
    return SearchFilters(**{k: v for k, v in data.items() if hasattr(SearchFilters, k)})


def _local_fallback_parse(query: str) -> SearchFilters:
    q = query.lower()
    filters = SearchFilters(q=query, fuzzy=True)

    if "public" in q:
        filters.statut = "Public"
    elif "privé" in q or "prive" in q:
        filters.statut = "Privé"

    if "bus" in q:
        filters.bus = "sans bus" not in q and "pas de bus" not in q
    if "cantine" in q:
        filters.cantine = "sans cantine" not in q and "pas de cantine" not in q
    if "sport" in q or "terrain" in q:
        filters.sport = "sans sport" not in q and "pas d'espace" not in q

    if "anglophone" in q:
        filters.section = "anglophone"
    elif "francophone" in q:
        filters.section = "francophone"
    elif "bilingue" in q:
        filters.section = "bilingue"

    if "technique" in q:
        filters.type_enseignement = "technique"
    elif "général" in q or "general" in q:
        filters.type_enseignement = "general"

    match = re.search(r"\b(?:à|a|au|dans)\s+([a-zàâäéèêëïîôöùûüç\- ]{3,})$", q)
    if match:
        filters.quartier = match.group(1).strip()

    return filters


def parse_natural_language_query(query: str) -> SearchFilters:
    # 1. DeepSeek (priorité)
    if settings.DEEPSEEK_API_KEY:
        try:
            return _call_openai_compat(
                settings.DEEPSEEK_BASE_URL,
                settings.DEEPSEEK_API_KEY,
                settings.DEEPSEEK_MODEL,
                query,
            )
        except Exception:
            pass

    # 2. Anthropic
    if settings.ANTHROPIC_API_KEY:
        try:
            return _call_anthropic(query)
        except Exception:
            pass

    # 3. Fallback local
    return _local_fallback_parse(query)

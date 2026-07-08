"""
Interprétation de requêtes en langage naturel vers filtres structurés SearchFilters.

Priorité des providers IA :
  1. DeepSeek  (DEEPSEEK_API_KEY configurée)
  2. Anthropic (ANTHROPIC_API_KEY configurée)
  3. Fallback local (règles + Levenshtein, sans IA)
"""
import json
import logging
import re

import httpx

from app.core.config import settings
from app.schemas.etablissement import SearchFilters

logger = logging.getLogger(__name__)

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
    try:
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
        response_data = resp.json()
        text_out = response_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        
        if not text_out:
            logger.warning(f"Empty response from AI service. Response: {response_data}")
            return None
            
        text_out = text_out.strip("`")
        if text_out.startswith("json"):
            text_out = text_out[4:].strip()
        
        data = json.loads(text_out)
        data.setdefault("fuzzy", True)
        return SearchFilters(**{k: v for k, v in data.items() if hasattr(SearchFilters, k)})
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parsing error from AI response: {e}")
        return None
    except httpx.HTTPError as e:
        logger.warning(f"HTTP error calling AI service at {base_url}: {e}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected error calling AI service: {type(e).__name__}: {e}")
        return None


def _call_anthropic(query: str) -> SearchFilters:
    try:
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
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parsing error from Anthropic response: {e}. Falling back to local parser.")
        return None
    except Exception as e:
        logger.warning(f"Error calling Anthropic service: {e}. Falling back to local parser.")
        return None


def _local_fallback_parse(query: str) -> SearchFilters:
    q = query.lower()
    filters = SearchFilters(q=query, fuzzy=True)

    # Statut établissement
    if "public" in q:
        filters.statut = "Public"
    elif "privé" in q or "prive" in q:
        filters.statut = "Privé"

    # Équipements
    if "bus" in q or "transport" in q:
        filters.bus = "sans bus" not in q and "pas de bus" not in q and "pas de transport" not in q
    if "cantine" in q or "cantine scolaire" in q:
        filters.cantine = "sans cantine" not in q and "pas de cantine" not in q
    if "sport" in q or "terrain" in q or "espace sportif" in q:
        filters.sport = "sans sport" not in q and "pas d'espace" not in q and "pas de terrain" not in q

    # Section
    if "anglophone" in q or "anglais" in q or "english" in q:
        filters.section = "Anglophone"
    elif "francophone" in q or "français" in q or "francais" in q or "french" in q:
        filters.section = "Francophone"
    elif "bilingue" in q or "bilingüe" in q:
        filters.section = "bilingue"

    # Type d'enseignement
    if "technique" in q or "technicien" in q:
        filters.type_enseignement = "technique"
    elif "général" in q or "general" in q or "générale" in q or "generale" in q:
        filters.type_enseignement = "general"

    # Cycles
    if "lycée" in q or "lycee" in q or "second" in q or "baccalauréat" in q or "baccalaureat" in q:
        filters.cycle = "second cycle"
    elif "collège" in q or "college" in q or "premier" in q or "bepc" in q or "brevet" in q:
        filters.cycle = "premier cycle"

    # Quartier - regex pour chercher après "à", "a", "au", "dans"
    match = re.search(r"\b(?:à|a|au|dans|à|près|pres)\s+([a-zàâäéèêëïîôöùûüç\- ]{3,})", q)
    if match:
        filters.quartier = match.group(1).strip()

    return filters


def parse_natural_language_query(query: str) -> SearchFilters:
    # 1. DeepSeek (priorité)
    if settings.DEEPSEEK_API_KEY:
        result = _call_openai_compat(
            settings.DEEPSEEK_BASE_URL,
            settings.DEEPSEEK_API_KEY,
            settings.DEEPSEEK_MODEL,
            query,
        )
        if result:
            logger.info(f"DeepSeek successfully parsed query: {query}")
            return result

    # 2. Anthropic
    if settings.ANTHROPIC_API_KEY:
        result = _call_anthropic(query)
        if result:
            logger.info(f"Anthropic successfully parsed query: {query}")
            return result

    # 3. Fallback local
    logger.info(f"Using local fallback parser for query: {query}")
    return _local_fallback_parse(query)

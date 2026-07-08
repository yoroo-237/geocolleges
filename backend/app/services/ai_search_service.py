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

SYSTEM_PROMPT = """Tu es un parseur de requêtes pour une base de données d'établissements scolaires \
à Douala IV (Cameroun). Tu dois extraire des filtres structurés depuis une requête en langage naturel.

════════════════════════════════════════
VALEURS EXACTES PRÉSENTES EN BASE DE DONNÉES
════════════════════════════════════════

statut          : "Public" | "Privé"
section         : "Francophone" | "anglophone" | "Francophone et anglophone"
cycle_enseignement : "premier cycle" | "premier cycle et second cycle"
  ⚠ Il n'existe PAS de "second cycle" seul — les lycées ont "premier cycle et second cycle"
type_enseignement : "general" | "technique/general" | "general/technique"
route           : "Route goudronnée" | "Route en pavé" | "Route en terre"
moyen_transport : "bus disponible" | "bus non disponible"
cantine_scolaire : "interieur" | "exterieur" | "interieur/ exterieur" | "interieur/exterieur"
espace_sportif  : "Dans l'établissement" | "hors de l'établissement" | "pas d'espace sportif"

════════════════════════════════════════
CHAMPS JSON DISPONIBLES (tous optionnels)
════════════════════════════════════════

q               → Nom partiel ou terme sans autre catégorie. Ne pas y mettre ce qui a un champ dédié.
quartier        → Nom du quartier (ex: "Mabanda", "Bojongo", "Bonandale")
statut          → Utilise exactement "Public" ou "Privé"
section         → Utilise une des 3 valeurs ci-dessus
cycle           → "premier cycle" (collège/BEPC) ou "second cycle" (lycée/BAC) ou omets si non mentionné
                  ⚠ "second cycle" dans ce champ matche "premier cycle et second cycle" via ILIKE
type_enseignement → "general", "technique/general" ou "general/technique"
filiere         → "Scientifique", "Littéraire", "Commerciale", "Industrielle"…
route           → UNE des 3 valeurs exactes (voir mapping ci-dessous)
bus             → true si l'utilisateur veut un bus, false s'il veut sans bus
cantine         → true si cantine voulue
sport           → true si espace sportif voulu
moyen_transport → N'utilise que si bus/cantine/sport ne suffisent pas
cantine_scolaire → N'utilise que si tu veux préciser interieur/exterieur
espace_sportif  → N'utilise que si tu veux préciser l'emplacement
fuzzy           → true SEULEMENT si la requête contient des fautes d'orthographe évidentes (ex: "licée", "cantime")
                  NE PAS mettre fuzzy:true pour des requêtes normales en langage naturel

════════════════════════════════════════
MAPPING LANGAGE NATUREL → CHAMPS
════════════════════════════════════════

"goudron" / "bitume" / "bitumée" / "asphalté"  → route: "Route goudronnée"
"pavé" / "pavée"                                → route: "Route en pavé"
"terre" / "latérite" / "piste" / "non bitumée" → route: "Route en terre"
"lycée" / "bac" / "terminale"                  → cycle: "second cycle"  +  q: "lycée"
"collège" / "bepc" / "brevet"                  → cycle: "premier cycle" +  q: "collège"
"bilingue"                                      → section: "Francophone et anglophone"
"anglophone" / "english"                        → section: "anglophone"
"francophone" / "français"                      → section: "Francophone"
"public"                                        → statut: "Public"
"privé" / "privée" / "laïc"                    → statut: "Privé"
"bus" / "transport"                             → bus: true
"sans bus" / "pas de bus"                       → bus: false
"cantine" / "restauration"                      → cantine: true
"sport" / "terrain" / "stade"                   → sport: true
"technique" / "technicien"                      → type_enseignement: "technique/general"
"général" / "generale"                          → type_enseignement: "general"

════════════════════════════════════════
EXEMPLES (few-shot)
════════════════════════════════════════

Requête: "lycée avec goudron"
→ {"q": "lycée", "cycle": "second cycle", "route": "Route goudronnée"}

Requête: "collège public avec bus à Mabanda"
→ {"q": "collège", "cycle": "premier cycle", "statut": "Public", "bus": true, "quartier": "Mabanda"}

Requête: "établissement anglophone privé"
→ {"statut": "Privé", "section": "anglophone"}

Requête: "lycée bilingue avec cantine et sport"
→ {"q": "lycée", "cycle": "second cycle", "section": "Francophone et anglophone", "cantine": true, "sport": true}

Requête: "école sur route en terre sans bus"
→ {"route": "Route en terre", "bus": false}

Requête: "collège technique francophone"
→ {"q": "collège", "cycle": "premier cycle", "type_enseignement": "technique/general", "section": "Francophone"}

Requête: "lisée publik" (faute d'orthographe)
→ {"q": "lycée", "cycle": "second cycle", "statut": "Public", "fuzzy": true}

Requête: "Lycée bilingue de bonaberi"
→ {"q": "lycée bilingue de bonaberi"}

════════════════════════════════════════

RÈGLE ABSOLUE : Réponds UNIQUEMENT avec l'objet JSON. Zéro texte, zéro balise markdown, zéro explication."""


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
    filters = SearchFilters(fuzzy=False)

    # Statut
    if "public" in q:
        filters.statut = "Public"
    elif any(w in q for w in ("privé", "prive", "laïc", "laic")):
        filters.statut = "Privé"

    # Équipements booléens
    if "bus" in q or "transport" in q:
        filters.bus = not any(w in q for w in ("sans bus", "pas de bus", "pas de transport"))
    if "cantine" in q:
        filters.cantine = not any(w in q for w in ("sans cantine", "pas de cantine"))
    if any(w in q for w in ("sport", "terrain", "stade", "espace sportif")):
        filters.sport = not any(w in q for w in ("sans sport", "pas d'espace", "pas de terrain"))

    # Section — valeurs exactes BD
    if any(w in q for w in ("anglophone", "anglais", "english")):
        filters.section = "anglophone"
    elif any(w in q for w in ("francophone", "français", "francais", "french")):
        filters.section = "Francophone"
    elif any(w in q for w in ("bilingue",)):
        filters.section = "Francophone et anglophone"

    # Type d'enseignement
    if any(w in q for w in ("technique", "technicien")):
        filters.type_enseignement = "technique/general"
    elif any(w in q for w in ("général", "general", "générale", "generale")):
        filters.type_enseignement = "general"

    # Cycle
    if any(w in q for w in ("lycée", "lycee", "bac", "terminale", "baccalauréat")):
        filters.cycle = "second cycle"
        filters.q = "lycée"
    elif any(w in q for w in ("collège", "college", "bepc", "brevet")):
        filters.cycle = "premier cycle"
        filters.q = "collège"

    # Route — valeurs exactes BD
    if any(w in q for w in ("goudron", "bitume", "bitumée", "asphalte", "asphalt")):
        filters.route = "Route goudronnée"
    elif any(w in q for w in ("pavé", "pave")):
        filters.route = "Route en pavé"
    elif any(w in q for w in ("terre", "latérite", "piste")):
        filters.route = "Route en terre"

    # Quartier — après "à", "au", "dans", "vers"
    match = re.search(r"\b(?:à|a|au|dans|vers|près de|pres de)\s+([a-zàâäéèêëïîôöùûüç\- ]{3,})", q)
    if match:
        filters.quartier = match.group(1).strip()

    # Si rien n'a été extrait, mettre toute la requête en q
    if not any([filters.statut, filters.section, filters.cycle, filters.route,
                filters.type_enseignement, filters.bus, filters.cantine, filters.sport,
                filters.quartier, filters.filiere]):
        filters.q = query
        filters.fuzzy = True

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

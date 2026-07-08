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


def _fmt(lst: list) -> str:
    """Formate une liste de valeurs BD pour le prompt."""
    return " | ".join(f'"{v}"' for v in lst)


def _build_system_prompt(options: dict | None = None) -> str:
    """
    Construit le system prompt en injectant les valeurs exactes de la BD.
    Si options=None, utilise des valeurs par défaut (fallback statique).
    """
    if options is None:
        options = {
            "statuts":            ["Public", "Privé"],
            "sections":           ["Francophone", "anglophone", "Francophone et anglophone"],
            "cycles":             ["premier cycle", "premier cycle et second cycle"],
            "types_enseignement": ["general", "technique/general", "general/technique"],
            "routes":             ["Route goudronnée", "Route en pavé", "Route en terre"],
            "moyens_transport":   ["bus disponible", "bus non disponible"],
            "cantines":           ["interieur", "exterieur", "interieur/ exterieur"],
            "espaces_sportifs":   ["Dans l'établissement", "hors de l'établissement", "pas d'espace sportif"],
            "quartiers":          ["Mabanda", "Bojongo", "Bonandale", "Fokou", "Grand hangar"],
            "filieres":           ["Scientifique", "Littéraire", "Commerciale", "Industrielle"],
        }

    quartiers_sample = _fmt(options["quartiers"][:6])
    if len(options["quartiers"]) > 6:
        quartiers_sample += ", …"

    return f"""Tu es un parseur de requêtes pour une base de données d'établissements scolaires \
à Douala IV (Cameroun). Extrais des filtres structurés depuis la requête utilisateur.

════════════════════════════════════════
VALEURS EXACTES EN BASE DE DONNÉES — utilise UNIQUEMENT ces valeurs, mot pour mot
════════════════════════════════════════

statut            : {_fmt(options["statuts"])}
section           : {_fmt(options["sections"])}
cycle             : {_fmt(options["cycles"])}
  ⚠ Il n'y a PAS de "second cycle" seul. Pour un lycée, utilise le champ cycle="second cycle" :
    il matchera "premier cycle et second cycle" via ILIKE dans la requête SQL.
type_enseignement : {_fmt(options["types_enseignement"])}
route             : {_fmt(options["routes"])}
moyen_transport   : {_fmt(options["moyens_transport"])}
cantine_scolaire  : {_fmt(options["cantines"])}
espace_sportif    : {_fmt(options["espaces_sportifs"])}
quartier          : l'un des quartiers existants ex: {quartiers_sample}
filiere           : {_fmt(options["filieres"])}

════════════════════════════════════════
CHAMPS JSON DE SORTIE (tous optionnels)
════════════════════════════════════════

q               → Nom partiel de l'établissement ou terme sans catégorie dédiée
quartier        → Quartier mentionné (choisis le plus proche parmi les valeurs ci-dessus)
statut          → Copie exacte depuis la liste statut
section         → Copie exacte depuis la liste section
cycle           → "premier cycle" ou "second cycle" (pas la valeur BD complète — voir ⚠ ci-dessus)
type_enseignement → Copie exacte depuis la liste type_enseignement
filiere         → Copie exacte depuis la liste filiere
route           → Copie exacte depuis la liste route
bus             → true si bus voulu, false si explicitement sans bus
cantine         → true si cantine voulue
sport           → true si espace sportif voulu
moyen_transport → Copie exacte depuis la liste moyen_transport (seulement si bus/cantine/sport insuffisant)
cantine_scolaire → Copie exacte depuis la liste cantine_scolaire (pour préciser interieur/exterieur)
espace_sportif  → Copie exacte depuis la liste espace_sportif (pour préciser l'emplacement)
fuzzy           → true SEULEMENT si fautes d'orthographe évidentes. NE PAS mettre pour du langage naturel normal.

════════════════════════════════════════
MAPPING SÉMANTIQUE → CHAMPS
════════════════════════════════════════

"goudron" / "bitume" / "bitumée" / "asphalte" / "asphalté"  → route: "Route goudronnée"
"pavé" / "pavée"                                             → route: "Route en pavé"
"terre" / "latérite" / "piste" / "non bitumée"              → route: "Route en terre"
"lycée" / "bac" / "terminale" / "baccalauréat"              → cycle: "second cycle" + q: "lycée"
"collège" / "bepc" / "brevet"                               → cycle: "premier cycle" + q: "collège"
"bilingue"                                                   → section: "Francophone et anglophone"
"anglophone" / "english" / "en anglais"                     → section: "anglophone"
"francophone" / "français" / "en français"                  → section: "Francophone"
"public" / "gouvernement"                                    → statut: "Public"
"privé" / "privée" / "laïc" / "confessionnel"              → statut: "Privé"
"avec bus" / "transport scolaire" / "navette"               → bus: true
"sans bus" / "pas de bus" / "pas de transport"              → bus: false
"cantine" / "restauration" / "repas"                        → cantine: true
"sport" / "terrain" / "stade" / "espace sportif"            → sport: true
"technique" / "technicien" / "professionnel"                → type_enseignement: "technique/general"
"général" / "générale" / "classique"                        → type_enseignement: "general"

════════════════════════════════════════
EXEMPLES (few-shot)
════════════════════════════════════════

Requête: "lycée avec goudron"
→ {{"q": "lycée", "cycle": "second cycle", "route": "Route goudronnée"}}

Requête: "collège public avec bus à Mabanda"
→ {{"q": "collège", "cycle": "premier cycle", "statut": "Public", "bus": true, "quartier": "mabanda"}}

Requête: "établissement anglophone privé"
→ {{"statut": "Privé", "section": "anglophone"}}

Requête: "lycée bilingue avec cantine et sport"
→ {{"q": "lycée", "cycle": "second cycle", "section": "Francophone et anglophone", "cantine": true, "sport": true}}

Requête: "école sur route en terre sans bus"
→ {{"route": "Route en terre", "bus": false}}

Requête: "collège technique francophone"
→ {{"q": "collège", "cycle": "premier cycle", "type_enseignement": "technique/general", "section": "Francophone"}}

Requête: "lycée à Bojongo avec terrain de sport"
→ {{"q": "lycée", "cycle": "second cycle", "quartier": "bojongo", "sport": true}}

Requête: "lisée publik avec bous" (fautes d'orthographe)
→ {{"q": "lycée", "cycle": "second cycle", "statut": "Public", "bus": true, "fuzzy": true}}

Requête: "Lycée bilingue de bonaberi"
→ {{"q": "Lycée bilingue de bonaberi"}}

════════════════════════════════════════

RÈGLE ABSOLUE : Réponds UNIQUEMENT avec l'objet JSON. Zéro texte, zéro balise markdown."""


def _parse_ai_response(text_out: str) -> SearchFilters | None:
    """Parse la réponse texte de l'IA vers SearchFilters."""
    text_out = text_out.strip().strip("`").strip()
    if text_out.lower().startswith("json"):
        text_out = text_out[4:].strip()
    data = json.loads(text_out)
    # Ne pas forcer fuzzy=True — laisser l'IA décider
    valid_fields = {k: v for k, v in data.items() if hasattr(SearchFilters.model_fields, k) or k in SearchFilters.model_fields}
    return SearchFilters(**valid_fields)


def _call_openai_compat(base_url: str, api_key: str, model: str, query: str, system_prompt: str) -> SearchFilters | None:
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
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ],
                "max_tokens": 500,
                "temperature": 0,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        response_data = resp.json()
        text_out = response_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

        if not text_out:
            logger.warning(f"Empty response from AI. Full response: {response_data}")
            return None

        return _parse_ai_response(text_out)

    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error from AI response: {e}")
        return None
    except httpx.HTTPError as e:
        logger.warning(f"HTTP error calling AI at {base_url}: {e}")
        return None
    except Exception as e:
        logger.warning(f"Unexpected AI error: {type(e).__name__}: {e}")
        return None


def _call_anthropic(query: str, system_prompt: str) -> SearchFilters | None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=500,
            system=system_prompt,
            messages=[{"role": "user", "content": query}],
        )
        text_out = "".join(b.text for b in resp.content if hasattr(b, "text"))
        return _parse_ai_response(text_out)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse error from Anthropic: {e}")
        return None
    except Exception as e:
        logger.warning(f"Anthropic error: {e}")
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
    elif "bilingue" in q:
        filters.section = "Francophone et anglophone"

    # Type d'enseignement
    if any(w in q for w in ("technique", "technicien")):
        filters.type_enseignement = "technique/general"
    elif any(w in q for w in ("général", "general", "générale", "generale")):
        filters.type_enseignement = "general"

    # Cycle + q pour nom
    if any(w in q for w in ("lycée", "lycee", "bac", "terminale", "baccalauréat")):
        filters.cycle = "second cycle"
        filters.q = "lycée"
    elif any(w in q for w in ("collège", "college", "bepc", "brevet")):
        filters.cycle = "premier cycle"
        filters.q = "collège"

    # Route — valeurs exactes BD
    if any(w in q for w in ("goudron", "bitume", "bitumée", "asphalte")):
        filters.route = "Route goudronnée"
    elif any(w in q for w in ("pavé", "pave")):
        filters.route = "Route en pavé"
    elif any(w in q for w in ("terre", "latérite", "piste")):
        filters.route = "Route en terre"

    # Quartier — après préposition
    match = re.search(r"\b(?:à|a|au|dans|vers|près de|pres de)\s+([a-zàâäéèêëïîôöùûüç\- ]{3,})", q)
    if match:
        filters.quartier = match.group(1).strip()

    # Dernier recours : tout en q avec fuzzy
    if not any([filters.statut, filters.section, filters.cycle, filters.route,
                filters.type_enseignement, filters.bus, filters.cantine, filters.sport,
                filters.quartier, filters.filiere, filters.q]):
        filters.q = query
        filters.fuzzy = True

    return filters


def parse_natural_language_query(query: str, options: dict | None = None) -> SearchFilters:
    """
    Parse une requête langage naturel vers SearchFilters.
    options : valeurs distinctes issues de la BD (injectées dans le prompt si fournies).
    """
    prompt = _build_system_prompt(options)

    # 1. DeepSeek (priorité)
    if settings.DEEPSEEK_API_KEY:
        result = _call_openai_compat(
            settings.DEEPSEEK_BASE_URL,
            settings.DEEPSEEK_API_KEY,
            settings.DEEPSEEK_MODEL,
            query,
            prompt,
        )
        if result:
            logger.info(f"DeepSeek parsed '{query}' → {result.model_dump(exclude_none=True)}")
            return result

    # 2. Anthropic
    if settings.ANTHROPIC_API_KEY:
        result = _call_anthropic(query, prompt)
        if result:
            logger.info(f"Anthropic parsed '{query}' → {result.model_dump(exclude_none=True)}")
            return result

    # 3. Fallback local
    logger.info(f"Local fallback for '{query}'")
    return _local_fallback_parse(query)

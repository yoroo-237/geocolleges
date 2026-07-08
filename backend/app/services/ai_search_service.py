"""
Interprétation de requêtes en langage naturel ("je cherche un lycée public
avec bus à Sodiko") en filtres structurés SearchFilters.

Si ANTHROPIC_API_KEY est absente ou l'appel échoue, on retombe automatiquement
sur un parsing local par mots-clés + recherche floue Levenshtein.
"""
import json
import re

from app.core.config import settings
from app.schemas.etablissement import SearchFilters

SYSTEM_PROMPT = """Tu es un moteur d'interprétation de requêtes pour une base de données
d'établissements scolaires à Douala IV, Cameroun. Convertis la requête utilisateur en JSON
strict avec ces clés optionnelles uniquement si mentionnées explicitement ou implicitement :
q (texte libre residuel), quartier, section (Francophone/Anglophone/bilingue), statut (Public/Privé),
cycle (contient 'premier cycle' et/ou 'second cycle'), bus (true/false), cantine (true/false),
sport (true/false), filiere, type_enseignement (general/technique).
Réponds UNIQUEMENT avec l'objet JSON, sans texte additionnel, sans balises markdown."""


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
        filters.sport = "sans sport" not in q and "pas de sport" not in q and "pas d'espace" not in q

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

    # Détection basique de quartier: dernier mot après "à" / "au" / "a "
    match = re.search(r"\b(?:à|a|au|dans)\s+([a-zàâäéèêëïîôöùûüç\- ]{3,})$", q)
    if match:
        filters.quartier = match.group(1).strip()

    return filters


def parse_natural_language_query(query: str) -> SearchFilters:
    if not settings.ANTHROPIC_API_KEY:
        return _local_fallback_parse(query)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        resp = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=300,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
        text_out = "".join(block.text for block in resp.content if hasattr(block, "text"))
        text_out = text_out.strip().strip("`")
        if text_out.startswith("json"):
            text_out = text_out[4:].strip()
        data = json.loads(text_out)
        data["fuzzy"] = True
        return SearchFilters(**data)
    except Exception:
        # Fallback automatique en cas d'absence de clé, quota dépassé, ou erreur réseau
        return _local_fallback_parse(query)

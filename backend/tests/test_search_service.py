"""Tests unitaires du fallback Levenshtein (ne nécessite pas de DB pour la logique pure)."""
import Levenshtein


def test_levenshtein_basic():
    assert Levenshtein.distance("lycee", "lycée") <= 2


def test_levenshtein_ratio_similar_words():
    ratio = Levenshtein.ratio("mabanda", "mabana")
    assert ratio > 0.8

"""
Name / city normalization for matching runners across sources.

almaty-marathon.kz stores names as entered (Cyrillic or Latin, any order);
athletex.kz (myrace.info timing) stores Latin "Surname Name". To match the
same person across both, names are folded to a loose Latin key:
transliterate Cyrillic (incl. Kazakh letters), then collapse common
transliteration variants (Aleksandr/Alexandr, Sergey/Sergei, Yermek/Ermek).
"""

import re
import unicodedata
from typing import Optional

_CYR_TO_LAT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    # Kazakh
    "ә": "a", "ғ": "g", "қ": "k", "ң": "n", "ө": "o", "ұ": "u", "ү": "u",
    "һ": "h", "і": "i",
}

# Applied in order to the transliterated, lowercased string.
_FOLDS = [
    ("shch", "sh"),
    ("kh", "h"),
    ("x", "ks"),
    ("yu", "u"), ("iu", "u"),
    ("ya", "a"), ("ia", "a"),
    ("yo", "o"),
    ("ye", "e"),
    # After the vowel folds, so "Zhuvanov" -> "juvanov" keeps its "j".
    ("zh", "j"), ("dj", "j"),
    ("y", "i"),
    ("w", "v"), ("q", "k"), ("ck", "k"),
]

# Folded city spellings that mean the same place.
# Keys are already folded (see fold()), e.g. "Moscow" folds to "moscov".
_CITY_ALIASES = {
    "almata": "almati",
    "nur-sultan": "astana", "nursultan": "astana", "akmola": "astana",
    "oskemen": "ust-kamenogorsk", "ustkamenogorsk": "ust-kamenogorsk",
    "kapchagai": "konaev",
    "oral": "uralsk",
    "semipalatinsk": "semei",
    "turkistan": "turkestan",
    "sankt-pererburg": "sankt-peterburg", "saint-petersburg": "sankt-peterburg",
    "st-petersburg": "sankt-peterburg", "petersburg": "sankt-peterburg",
    "moscov": "moskva",
}

# Display form (as used by existing almaty-marathon.kz rows) per city key.
_CITY_DISPLAY = {
    "almati": "Алматы", "astana": "Астана", "shimkent": "Шымкент",
    "karaganda": "Караганда", "aktobe": "Актобе", "taraz": "Тараз",
    "pavlodar": "Павлодар", "kostanai": "Костанай", "atirau": "Атырау",
    "taldikorgan": "Талдыкорган", "petropavlovsk": "Петропавловск",
    "ust-kamenogorsk": "Усть-Каменогорск", "aktau": "Актау", "semei": "Семей",
    "kokshetau": "Кокшетау", "uralsk": "Уральск", "konaev": "Конаев",
    "kizilorda": "Кызылорда", "talgar": "Талгар", "ekibastuz": "Экибастуз",
    "temirtau": "Темиртау", "turkestan": "Туркестан", "jezkazgan": "Жезказган",
    "kaskelen": "Каскелен", "zerenda": "Зеренда", "shuchinsk": "Щучинск",
    "bishkek": "Бишкек", "tashkent": "Ташкент", "moskva": "Москва",
    "sankt-peterburg": "Санкт-Петербург", "novosibirsk": "Новосибирск",
    "ekaterinburg": "Екатеринбург", "omsk": "Омск", "akutsk": "Якутск",
}


def fold(text: str) -> str:
    """Lowercase, transliterate and collapse spelling variants."""
    s = unicodedata.normalize("NFKC", text).lower().strip()
    s = "".join(_CYR_TO_LAT.get(ch, ch) for ch in s)
    s = "".join(
        ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch)
    )
    for a, b in _FOLDS:
        s = s.replace(a, b)
    s = re.sub(r"(.)\1+", r"\1", s)  # Daniil -> Danil, Anna -> Ana
    return s


def name_key(full_name: str) -> Optional[str]:
    """
    Order-insensitive key from the first two name tokens
    ("Surname Name" and "Name Surname" match; a trailing patronymic is ignored).
    """
    tokens = [t for t in re.split(r"[^a-z0-9]+", fold(full_name)) if t]
    if len(tokens) < 2:
        return None
    return " ".join(sorted(tokens[:2]))


def city_key(city: Optional[str]) -> str:
    if not city:
        return ""
    key = re.sub(r"[\s_]+", "-", fold(city)).strip("-.")
    return _CITY_ALIASES.get(key, key)


def display_city(city: Optional[str]) -> str:
    """Canonical display spelling (Cyrillic for known cities, else as given)."""
    if not city:
        return ""
    return _CITY_DISPLAY.get(city_key(city), city.strip())

"""
backend/identity.py — Strict caller identity parsing.
A caller is verified only when the FULL date of birth (year, month, day) is spoken.
"""

import re
from typing import Optional

MONTHS = {
    "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
    "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
    "august": 8, "aug": 8, "september": 9, "sept": 9, "sep": 9, "october": 10, "oct": 10,
    "november": 11, "nov": 11, "december": 12, "dec": 12,
    # Spanish
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6, "julio": 7,
    "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

_UNITS = {
    "first": 1, "one": 1, "second": 2, "two": 2, "third": 3, "three": 3, "fourth": 4, "four": 4,
    "fifth": 5, "five": 5, "sixth": 6, "six": 6, "seventh": 7, "seven": 7, "eighth": 8, "eight": 8,
    "ninth": 9, "nine": 9, "tenth": 10, "ten": 10, "eleventh": 11, "eleven": 11,
    "twelfth": 12, "twelve": 12, "thirteenth": 13, "thirteen": 13, "fourteenth": 14, "fourteen": 14,
    "fifteenth": 15, "fifteen": 15, "sixteenth": 16, "sixteen": 16, "seventeenth": 17, "seventeen": 17,
    "eighteenth": 18, "eighteen": 18, "nineteenth": 19, "nineteen": 19, "twentieth": 20, "twenty": 20,
    "thirtieth": 30, "thirty": 30,
}


def _words_to_day(text: str) -> Optional[int]:
    m = re.search(r"\b(twenty|thirty)[\s-]+(first|one|second|two|third|three|fourth|four|fifth|five|sixth|six|seventh|seven|eighth|eight|ninth|nine)\b", text)
    if m:
        return _UNITS[m.group(1)] + _UNITS[m.group(2)]
    for word, val in sorted(_UNITS.items(), key=lambda kv: -len(kv[0])):
        if re.search(rf"\b{word}\b", text):
            return val
    return None


def parse_spoken_dob(text: str) -> Optional[str]:
    """Returns ISO 'YYYY-MM-DD' if a complete date of birth is present, else None."""
    t = text.lower().replace(",", " ")

    m = re.search(r"\b(19|20)(\d{2})-(\d{1,2})-(\d{1,2})\b", t)
    if m:
        return f"{m.group(1)}{m.group(2)}-{int(m.group(3)):02d}-{int(m.group(4)):02d}"

    m = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-]((?:19|20)\d{2})\b", t)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    year_m = re.search(r"\b((?:19|20)\d{2})\b", t)
    if not year_m:
        return None
    year = year_m.group(1)
    rest = t.replace(year, " ")

    month = None
    for name, num in sorted(MONTHS.items(), key=lambda kv: -len(kv[0])):
        if re.search(rf"\b{name}\b", rest):
            month = num
            rest = re.sub(rf"\b{name}\b", " ", rest, count=1)
            break
    if month is None:
        return None

    day = None
    d = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\b", rest)
    if d:
        day = int(d.group(1))
    else:
        day = _words_to_day(rest)
    if not day or not 1 <= day <= 31:
        return None
    return f"{year}-{month:02d}-{day:02d}"

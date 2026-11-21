"""How familiar each country name is in general (not per question).

Used only to break ties when one spelling fits two countries (Congo, Korea) and
to order review lists. Points come from data/<pack>_tiers.json, not from here.

Base score: Zipf frequency of the country's English names in written English
(wordfreq: Wikipedia, books, news, subtitles, web). Zipf is log10 per billion
words, so 1 point = 10x more or less common. 5+ is very common, under 3 is rare.

Word frequency is fooled by names that are also ordinary words (Jordan, Chad,
Georgia, Turkey, Guinea) and by multi-word names built from common words
(Central African Republic, Marshall Islands). Those get a hand-checked score in
OVERRIDES, set relative to similar countries. Review these when adding packs.

Data: wordfreq (Robyn Speer), code Apache-2.0, data CC BY-SA 4.0.
"""

from __future__ import annotations

from wordfreq import zipf_frequency

# Hand-checked scores for names that word frequency gets wrong. Comment = why.
OVERRIDES: dict[str, float] = {
    "Vatican City": 3.4,              # "Vatican" common in religious news; rarely named as a country
    "Central African Republic": 3.3,  # phrase of common words
    "Saint Vincent and the Grenadines": 2.7,  # "Saint Vincent" is a common name
    "Marshall Islands": 3.0,          # "Marshall" is a common name
    "Solomon Islands": 3.0,           # "Solomon" is a common name
    "Guinea": 3.1,                    # guinea pig, guinea fowl
    "Jordan": 3.9,                    # first name, Michael Jordan
    "Georgia": 3.8,                   # US state, first name
    "Chad": 3.3,                      # first name
    "Türkiye": 4.3,                   # "turkey" the bird inflates it; still well known
    "Republic of the Congo": 3.2,     # shares "Congo" with DR Congo, less known of the two
    "DR Congo": 3.6,
    "Equatorial Guinea": 2.9,
    "Papua New Guinea": 3.3,
    "Dominica": 2.6,                  # usually confused with the Dominican Republic
    "Niger": 3.3,                     # the river, and part of "Nigeria" searches
    "Saint Lucia": 3.0,
    "Trinidad and Tobago": 3.4,
    "Sierra Leone": 3.3,
    "Costa Rica": 3.7,
    "El Salvador": 3.4,
    "Dominican Republic": 3.6,
    "South Sudan": 3.4,
    "Sri Lanka": 3.9,
    "South Africa": 4.6,
    "United Arab Emirates": 3.9,
    "Saudi Arabia": 4.1,
    "North Korea": 4.3,
    "South Korea": 4.4,
    "Cape Verde": 2.9,
    "Ivory Coast": 3.3,
    "Burkina Faso": 2.9,
    "San Marino": 3.0,
    "Antigua and Barbuda": 2.9,
    "Bosnia and Herzegovina": 3.6,
    "North Macedonia": 3.1,
    "Timor-Leste": 2.8,
    "São Tomé and Príncipe": 2.4,
    "Saint Kitts and Nevis": 2.6,
    "Mali": 3.3,                      # common word fragment, Bali/Malibu confusion
    "Togo": 2.9,                      # "to go"
    "Panama": 3.6,                    # Panama hat, Panama Canal
    "Chile": 3.9,                     # chile pepper
    "Palestine": 3.9,
}


def familiarity(name: str, english_names: list[str]) -> float:
    if name in OVERRIDES:
        return OVERRIDES[name]
    return max(zipf_frequency(n, "en") for n in english_names)

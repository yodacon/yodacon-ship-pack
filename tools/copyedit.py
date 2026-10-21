"""Copy-editing for the 1997–98 texts: spelling fixed, voice kept.

The plugins' descriptions and readmes were written by a middle-schooler in
1997. The pack shows them corrected; the exact originals stay in the archives
in sources/ and, for ship descriptions, beside the corrected text in each
ship.json (`description_original`, `escort_original`).

Corrections are listed by hand, never guessed: game names (Exeon, Cenron,
Schmelta-V) and period voice ("Whoo Momma") are left alone.
"""
import re

# Whole phrases first, where a word's fix depends on its neighbours.
PHRASES = [
    ("people where crazy", "people were crazy"),
    ("plans where showed", "plans were shown"),
    ("stared building", "started building"),
    ("they though the", "they thought the"),
    ("Its turning are", "Its turning is"),
    ("is has a top speed", "it has a top speed"),
    ("the acceleration is terrible, the dart has", "the acceleration is terrible, but the Dart has"),
    ("The ConEx dart", "The ConEx Dart"),
    ("The large Pin", "The Large Pin"),
    ("week combate", "weak combat"),
    ("the only problem it is terrable accelaterion", "the only problem is its terrible acceleration"),
    ("Which now holds a crew of 25, no 2 as the original", "It now holds a crew of 25, not 2 as the original"),
    ("is will match with the UE Fighter", "is a match for the UE Fighter"),
    ("The design was designed at the end", "It was designed at the end"),
    ("This Fast but little ship", "This fast but little ship"),
    ("little fire power, but almost", "little firepower, but is almost"),
    ("great fire power", "great firepower"),
    ("used to trade commodity exchange", "used for commodity exchange"),
    ("Do to space limitations, I will not show the pictures here, But you can stop at "
     "the plants in the Systems ConEx, and Exeon.",
     "Due to space limitations, I will not show the pictures here, but you can stop at "
     "the planets in the systems ConEx and Exeon."),
    ("Uses Resources150-185", "Uses resources 150–185"),
    ("To make every thing", "To make everything"),
    ("for a Head Quoters", "for a headquarters"),
    ("is Ok as long", "is OK as long"),
    ("addiction to your fleat, I'l Bet my Life on it\" says", "addition to your fleet, I'll bet my life on it,\" he says"),
    ("This Little Shipp", "This little ship"),
    ("The Worker for", "The worker for"),
    ("100 Tons of Cargo space", "100 tons of cargo space"),
    ("outrun Pirates", "outrun pirates"),
    ("I Am Looking For New Beta Testers, Please E-Mail me about it.d li",
     "I am looking for new beta testers, please e-mail me about it."),
    ("Equiped with three", "equipped with three"),
    ("Equipped with Three", "equipped with three"),
    ("your ships ", "your ship's "),
    ("guided missile.", "guided missiles."),
    ("out run", "outrun"),
]

# Single words, matched whole.
WORDS = {
    "cary": "carry", "amout": "amount", "dident": "didn't", "realy": "really",
    "dosent": "doesn't", "doesnt": "doesn't", "Meduim": "Medium", "littel": "little",
    "alown": "alone", "Equiped": "Equipped", "imediatly": "immediately",
    "galixy": "galaxy", "unice": "unique", "Luxery": "Luxury", "makeing": "making",
    "shiping": "shipping", "usefull": "useful", "mutch": "much", "louse": "lose",
    "Necromencer": "Necromancer", "releaced": "released", "Hopfully": "Hopefully",
    "beginer": "beginner", "inorder": "in order", "Dirve": "Drive",
    "caption": "captain", "Caption": "Captain",
}

WORD_RE = re.compile(r"\b(" + "|".join(map(re.escape, WORDS)) + r")\b")


def fix(text):
    """The corrected text, or None for None."""
    if text is None:
        return None
    text = re.sub(r"(?<=\S)  +(?=\S)", " ", text)  # stray double spaces
    for old, new in PHRASES:
        text = text.replace(old, new)
    return WORD_RE.sub(lambda m: WORDS[m.group(1)], text)


GEOCITIES_URL = "http://www.geocities.com/SiliconValley/Way/9298"
GEOCITIES_MAIL = "conex@geocities.com"
TERMS = "ConEx is property of Paul Richeson. Any reproduction"


def readme(text):
    """A readme chapter, corrected, with its dead addresses marked.

    ConEx's home page and mailbox were on GeoCities, which closed in 2009; the
    page was never archived. The beta testers' 1997 addresses belong to other
    people and are left out, not reprinted."""
    text = fix(text)
    text = text.replace(GEOCITIES_URL, f"`{GEOCITIES_URL[7:]}` *(inactive: GeoCities closed in "
                                       "2009, and this page was never archived)*")
    text = text.replace(GEOCITIES_MAIL, f"`{GEOCITIES_MAIL}` *(inactive)*")
    text = re.sub(r"[ \t]+[\w.+-]+@[\w-]+(\.[\w-]+)+(?=\n|$)", "", text)  # other people's mail
    text = text.replace("Beta Testers:", "Beta testers (their 1997 e-mail addresses are left out):")
    if TERMS in text:
        text = re.sub(r"(do the same as it is for public domain\.)",
                      r"\1 *(These 1997–98 terms are replaced by GPL-2.0-or-later: see the "
                      r"pack's LICENSE.)*", text)
    text = text.replace("7/10/97", "7/10/97 *(so it reads; the files are dated 10 July 1998)*")
    return text

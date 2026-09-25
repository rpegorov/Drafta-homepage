"""Regenerates the static TTFs that src/lib/og.ts feeds to satori.

satori reads TTF/OTF/WOFF only (no woff2) and renders a variable font at its
default instance, so the site's variable woff2 files (public/fonts/, Latin and
Cyrillic in one file) are decompressed and pinned to the weights the OG card
uses. The glyphs stay identical to the ones the pages render.

Run from the repository root with fontTools + brotli installed:
    python3 scripts/og-fonts/make-fonts.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC = Path("public/fonts")
OUT = Path("scripts/og-fonts")

# (source woff2, output ttf, wght)
INSTANCES = [
    ("Lora.woff2", "Lora-SemiBold.ttf", 600),
    ("GolosText.woff2", "GolosText-Regular.ttf", 400),
    ("GolosText.woff2", "GolosText-SemiBold.ttf", 600),
]


def main() -> None:
    for source, target, weight in INSTANCES:
        font = TTFont(SRC / source)
        font.flavor = None
        if "fvar" in font:
            font = instantiateVariableFont(font, {"wght": weight}, updateFontNames=False)
        font.save(OUT / target)
        print(f"{target}: wght {weight}")


if __name__ == "__main__":
    main()

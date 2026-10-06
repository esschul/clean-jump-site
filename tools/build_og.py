#!/usr/bin/env python3
"""Draws the pictures shown when a Hiku page is shared (Open Graph, 1200×630): the name, one line in the page's
language, and two tiles with the dashed arc of a jump, as on the app icon.

    python3 tools/build_og.py

Writes img/og-<lang>.png for the homepage and rules page of each language, and img/og.png without the line, for
Daily Hiku itself, which is shared from every language.
"""
import math
import pathlib

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINE = {"nb": "Tallet sier hvor langt det hopper.", "en": "The number says how far it jumps.",
        "sv": "Talet säger hur långt det hoppar.", "da": "Tallet siger, hvor langt det springer.",
        "fi": "Luku kertoo, kuinka pitkälle se hyppää.", "de": "Die Zahl sagt, wie weit sie springt."}
NAVY, EDGE, CREAM, INK, MUTED, GOLD = "#3b4a7a", "#26305a", "#f3eee6", "#2b2f45", "#c9cee6", "#e0a43a"
S = 2  # drawn at twice the size and scaled down, for smooth edges
GEORGIA = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SANS = "/System/Library/Fonts/HelveticaNeue.ttc"


def font(path, size, index=0):
    return ImageFont.truetype(path, size * S, index=index)


def tile(d, x, y, size, n):
    r = 26 * S
    d.rounded_rectangle([x, y + 12 * S, x + size, y + size + 12 * S], r, fill=EDGE)
    d.rounded_rectangle([x, y, x + size, y + size], r, fill="#fffaf2")
    d.text((x + size / 2, y + size * 0.46), str(n), font=font(SANS, 96), fill=INK, anchor="mm")
    for k in range(n):
        cx = x + size / 2 + (k - (n - 1) / 2) * 16 * S
        d.ellipse([cx - 4.5 * S, y + size * 0.8 - 4.5 * S, cx + 4.5 * S, y + size * 0.8 + 4.5 * S], fill="#5a5d6f")


def dashed_arc(d, a, b, lift):
    """A quadratic arc from a to b, drawn as round-ended dashes."""
    c = ((a[0] + b[0]) / 2, min(a[1], b[1]) - lift)
    points = [((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1])
              for t in (i / 600 for i in range(601))]
    length, dash, gap, w = 0.0, 16 * S, 20 * S, 9 * S
    for p, q in zip(points, points[1:]):
        if length % (dash + gap) < dash:
            d.line([p, q], fill=GOLD, width=w)
            for e in (p, q):
                d.ellipse([e[0] - w / 2, e[1] - w / 2, e[0] + w / 2, e[1] + w / 2], fill=GOLD)
        length += math.dist(p, q)


def draw(line):
    img = Image.new("RGB", (1200 * S, 630 * S), NAVY)
    d = ImageDraw.Draw(img)
    name = font(GEORGIA, 176)
    x0, base = 84 * S, (300 if line else 340) * S
    d.text((x0, base), "Hiku", font=name, fill=CREAM, anchor="ls")
    d.text((x0 + d.textlength("Hiku", font=name), base), ".", font=name, fill=GOLD, anchor="ls")
    if line:
        # Wrapped so it stays clear of the tiles.
        words, rows = line.split(), [""]
        for w in words:
            if d.textlength((rows[-1] + " " + w).strip(), font=font(SANS, 38)) > 560 * S:
                rows.append(w)
            else:
                rows[-1] = (rows[-1] + " " + w).strip()
        for i, row in enumerate(rows):
            d.text((x0 + 6 * S, base + (78 + 50 * i) * S), row, font=font(SANS, 38), fill=CREAM, anchor="ls")
    d.text((x0 + 6 * S, 560 * S), "hikupuzzle.com", font=font(SANS, 30), fill=MUTED, anchor="ls")
    size, top = 176 * S, 300 * S
    left, right = 712 * S, 948 * S
    tile(d, left, top, size, 2)
    tile(d, right, top, size, 2)
    dashed_arc(d, (left + size / 2, top - 22 * S), (right + size / 2, top - 22 * S), 230 * S)
    return img.resize((1200, 630), Image.LANCZOS)


if __name__ == "__main__":
    for lang, line in LINE.items():
        draw(line).save(ROOT / f"img/og-{lang}.png", optimize=True)
    draw(None).save(ROOT / "img/og.png", optimize=True)
    print("wrote img/og.png and img/og-<lang>.png for", ", ".join(LINE))

#!/usr/bin/env python3
"""Writes the texts of "Why?" for the web game, from the iOS app's string catalog, so the web says the same as the apps.

    python3 tools/build_explain_texts.py [path/to/Localizable.xcstrings]

Reads the explain.* and list.* keys of ../clean-jump/CleanJump/Localizable.xcstrings (or the path given) and writes
daily/explain-texts.js, which daily/explain.js fills in. A key like "explain.number %lld %@" is stored as
explain.number with its text as it is in the catalog (%1$lld, %@ …): explain.js fills those in itself. Run this after
changing the texts in the catalog.
"""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
catalog_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / "clean-jump/CleanJump/Localizable.xcstrings"
catalog = json.loads(catalog_path.read_text())["strings"]
languages = ["nb", "en", "sv", "da", "fi", "de"]

texts = {lang: {} for lang in languages}
for key, entry in sorted(catalog.items()):
    name = key.split(" ")[0]
    if not (name.startswith("explain.") or name.startswith("list.")):
        continue
    for lang in languages:
        texts[lang][name] = entry["localizations"][lang]["stringUnit"]["value"]

out = root / "daily/explain-texts.js"
out.write_text(
    "// Written by tools/build_explain_texts.py from the iOS app's Localizable.xcstrings; don't edit by hand.\n"
    "export const TEXTS = " + json.dumps(texts, ensure_ascii=False, indent=1) + ";\n")
print(f"{out.relative_to(root)}: {len(texts['nb'])} texts in {len(languages)} languages")

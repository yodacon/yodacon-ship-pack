#!/usr/bin/env python3
"""Read entries from a Cythera Guides add-on listing (their mirror of
Ambrosia's add-on archive) into the catalogue's own seven columns.

  catalogue.py <listing-url-or-file> <anchor> [<anchor> ...]

Prints a JSON list: title, size, description, category, author, date,
rating, votes, downloads, file URL and the listing's URL. The anchor is the
entry's id on the page, which is also its file name, e.g. 792_ConEx12.sit.hqx.
"""
import html
import json
import re
import sys
import urllib.request
from urllib.parse import urljoin

COLUMNS = ("category", "author", "date", "rating", "votes", "downloads")


def clean(fragment: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", fragment))).strip()


def entries(page: str, base: str, anchors):
    rows = []
    for anchor in anchors:
        at = page.index(f'id="{anchor}"')
        start, end = page.rindex("<tr", 0, at), page.index("</tr>", at)
        cells = re.findall(r"<td[^>]*>(.*?)</td>", page[start:end], re.S)
        first = cells[0]
        link = re.search(rf'id="{re.escape(anchor)}" href="([^"]+)">([^<]+)</a>', first)
        size = re.search(r"<small>\(([^)]+)\)</small>", first)
        desc = re.search(r'<div class="desc">(.*?)</div>', first, re.S)
        row = {"title": clean(link.group(2)), "size": size.group(1) if size else None,
               "description": clean(desc.group(1)) if desc else ""}
        row.update({k: clean(v) for k, v in zip(COLUMNS, cells[1:])})
        row["file"] = urljoin(base, link.group(1))
        row["listing"] = f"{base}#{anchor}"
        rows.append(row)
    return rows


def main():
    source, anchors = sys.argv[1], sys.argv[2:]
    if source.startswith("http"):
        with urllib.request.urlopen(source, timeout=60) as r:
            page = r.read().decode("latin-1")
    else:
        page = open(source, encoding="latin-1").read()
        source = "http://www.cytheraguides.com/archives/ambrosia_addons/"  # override with a URL
    print(json.dumps(entries(page, source, anchors), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

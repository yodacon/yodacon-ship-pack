#!/usr/bin/env python3
"""Collect one source page for the game-design research, the same way every time.

  research_fetch.py <slug> <url>

Saves the raw download to .research-cache/<slug>/ (git-ignored: other people's
pages are read here, not redistributed), with a plain-text version beside it,
and prints the record a report starts from: URL, UTC time, HTTP status, bytes,
SHA-256, page title, and the first of the text. Reports in docs/research/ cite
that record; only short quotations go into the repository.
"""
import hashlib
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PACK = Path(__file__).resolve().parents[1]
CACHE = PACK / ".research-cache"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) yodacon-ship-pack-research/1.0"


def text_of(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript|svg)\b.*?</\1>", " ", page)
    page = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|section|article)>", "\n", page)
    page = html.unescape(re.sub(r"<[^>]+>", " ", page))
    lines = (re.sub(r"[ \t ]+", " ", line).strip() for line in page.splitlines())
    return "\n".join(line for line in lines if line)


def main():
    slug, url = sys.argv[1], sys.argv[2]
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    when = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with urllib.request.urlopen(req, timeout=60) as r:
        raw, status, ctype = r.read(), r.status, r.headers.get("Content-Type", "")
    out = CACHE / slug
    out.mkdir(parents=True, exist_ok=True)
    # time plus a hash prefix: several files fetched in one second must not collide
    stamp = when.replace(":", "") + "-" + hashlib.sha256(raw).hexdigest()[:10]
    ext = ".json" if "json" in ctype else ".txt" if ctype.startswith("text/plain") else ".html"
    (out / f"{stamp}{ext}").write_bytes(raw)
    body = raw.decode("utf-8", "replace")
    text = body if ext != ".html" else text_of(body)
    (out / f"{stamp}.text").write_text(text, encoding="utf-8")
    title = re.search(r"(?is)<title[^>]*>(.*?)</title>", body)
    record = {"slug": slug, "url": url, "retrieved": when, "status": status,
              "content_type": ctype, "bytes": len(raw),
              "sha256": hashlib.sha256(raw).hexdigest(),
              "title": html.unescape(title.group(1).strip()) if title else None,
              "raw": str((out / f"{stamp}{ext}").relative_to(PACK)),
              "text": str((out / f"{stamp}.text").relative_to(PACK))}
    (out / f"{stamp}.record.json").write_text(json.dumps(record, indent=2) + "\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()

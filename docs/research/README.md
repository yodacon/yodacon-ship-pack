# Game-design research

What other space games do with planets and sprites, collected so the pack's
next examples and games rest on something better than guesses. Started
21 October 2026, at Paul Richeson's request, to plan more browser examples and
an accurate Konquest.

## Reports

| # | Source | What it gave |
| --- | --- | --- |
| [01](2026-10-21-01-itch-space.md) | itch.io, top games tagged *space* | The landscape: simulation, strategy, adventure; 15 of 36 in the browser |
| [02](2026-10-21-02-itch-strategy-space.md) | itch.io, top *strategy* games tagged *space* | Planet conquest is the genre's core; short sessions win |
| [03](2026-10-21-03-itch-html5-space.md) | itch.io, top *HTML5* games tagged *space* | Gravity games, mining, and the target pictures as a game board |
| [04](2026-10-21-04-kde-konquest.md) | KDE's Konquest page | Konquest's rules as players see them; GPL-2.0+ |
| [05](2026-10-21-05-konquest-source.md) | Konquest's source, commit `3a90a7ed` | The exact rules, numbers and AI, from the code |
| [06](2026-10-21-06-webgpu-and-wasm.md) | MDN WebGPU, macroquad, local toolchains | WebGPU's status; Rust, Go and Zig to WebAssembly |
| [07](2026-10-21-07-treadcore-crates.md) | treadcore on crates.io | The Rust/Bevy crates.io project; a version gap and a licence gap to settle |

The ideas these led to are in [`../game-ideas.md`](../game-ideas.md); the plan
is in [`../../BACKLOG.md`](../../BACKLOG.md).

## How the material was collected

1. **One tool, every time.** `tools/research_fetch.py <slug> <url>` downloads a
   page, saves the raw bytes and a plain-text copy under `.research-cache/<slug>/`,
   and writes a record: URL, UTC time, HTTP status, size and SHA-256. Each
   report's header copies that record, so any claim can be traced to the exact
   bytes it was read from.
2. **Downloads stay local.** `.research-cache/` is git-ignored: these are other
   people's pages, read here, not redistributed. Reports quote only short
   pitches and rules, with the source named.
3. **Each report is written right after its download,** before the next fetch,
   from what that page says. Interpretation is kept apart from quotation:
   pitches are quoted as listed, and "Takeaways" and "Assets this points to"
   are this project's reading.
4. **Listings are parsed, not skimmed.** itch.io pages are grids of game
   cards; the title, pitch, author, genre and platforms were extracted from
   the saved HTML, so the genre counts in the reports are counts, not
   impressions.
5. **Source code is read at a pinned commit.** Konquest's files were fetched
   from `master` with the commit recorded, and each file's SHA-256 is listed.

### What went wrong, and what changed

- `itch.io/games/html5/genre-strategy/tag-space` answered **403 Forbidden**
  (22:38 UTC). itch.io serves one filter plus a tag; reports 02 and 03 use
  `genre-strategy/tag-space` and `html5/tag-space` instead.
- The first version of the fetch tool named cache files by the second. Files
  fetched within one second **overwrote each other**, and a JSON download
  was overwritten by its own record. The tool now writes `<time>-<hash>.<ext>`
  and `<time>-<hash>.record.json`; the Konquest sources were re-fetched, and
  every file read before the fix was confirmed byte-identical by SHA-256.

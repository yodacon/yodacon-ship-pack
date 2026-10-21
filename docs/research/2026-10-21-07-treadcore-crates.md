# 07 · treadcore on crates.io: the Rust game project

| | |
| --- | --- |
| Source | https://crates.io/api/v1/crates/treadcore-client, and the local checkout `~/code/treadcore` (README, `Cargo.toml`) |
| Retrieved | 2026-10-21 22:46:23 UTC, HTTP 200, 4,042 bytes |
| SHA-256 | `d441604d8e0b3861c9e3f2493b90be913230f2abdf15b01ebff5b4ab64125ef6` |
| Why | Paul Richeson asked for treadcore to be added "as a project with a crates.io game" |

## What treadcore is

From its README: "A sixteen-player overhead tank game … the gun fires
indirect like artillery, and the tank keeps itself alive … with a drone crew
flown off its own hull." Rust, **Bevy** for the window, plain `std` UDP for
the network; peers elect a host among themselves, and "nobody runs a game
server". Site: [treadcore.org](https://treadcore.org); repository:
[github.com/treadcore/treadcore](https://github.com/treadcore/treadcore).

One Cargo workspace: `treadcore-sim` (the deterministic, headless world),
`treadcore-proto`, `treadcore-net`, `treadcore-brain` (bots),
`treadcore-server`, and `treadcore-client` (the only crate with Bevy). Players
install it with `cargo install treadcore-client` and run `treadcore --solo`.

## The crates.io record

| Field | Value |
| --- | --- |
| Crate | `treadcore-client` |
| Description | "Treadcore's Bevy client: overhead map, HUD telemetry overlay, controls." |
| Versions on crates.io | **0.1.0-rc.1** only |
| Licence | **MIT** |
| Rust | 1.85 or newer |
| Keywords · categories | bevy, bolo, game, multiplayer, tank · Games, Game engines, Simulation |
| Downloads · published | 10 · 2026-10-13 |

## Two things to check

1. **Versions differ.** The README calls the current release
   **0.1.0-rc.6** ("the first with packages"), but crates.io has only
   **0.1.0-rc.1**. Either later candidates weren't published to crates.io,
   or the README runs ahead of it.
2. **Licences differ.** treadcore's crates are **MIT**; the ship pack is
   **GPL-2.0-or-later**. treadcore can *load* the pack at run time from a
   separate, unmodified folder (the pack's "vendored folder" route), but
   building the art into an MIT crate would make that crate's distribution
   GPL. Paul owns both, so he can also license the art to treadcore directly.

## The project: a crates.io game with the ships

treadcore is the pack's Rust and crates.io project. It is overhead, Bevy-based
and already published, and its architecture keeps the world (`treadcore-sim`)
apart from the window (`treadcore-client`). The plan, in order:

1. **A small Bevy example in the pack** (`examples/bevy/`): load
   `sheet-alpha.png` as a `TextureAtlas` with a 6 × 6 grid of the ship's frame
   size, pick the frame from the heading, fly it. The Rust counterpart of
   `examples/canvas/`, using the same Bevy treadcore uses.
2. **A crate for the pack**: `yodacon-ship-pack` on crates.io, giving Rust
   games the catalogue (`catalog.json` as typed structs) and a helper for the
   frame index, with the PNGs fetched or vendored rather than packed into the
   crate (crates.io's size limit and the licence point above both argue for
   that).
3. **The ships in treadcore**: drone or support craft drawn from the pack
   (the Defender, Gryphon and Trident are the right size for drones), loaded
   at run time from a vendored copy of the pack.
4. **In the browser**: Bevy targets `wasm32-unknown-unknown`, so the Bevy
   example (and in time treadcore's client, minus raw UDP) can run in a tab.
   It needs the `wasm32` Rust target installed here first (report 06).

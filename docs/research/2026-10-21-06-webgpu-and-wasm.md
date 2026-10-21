# 06 · Techniques: WebGPU, and compiled code in the browser

| | |
| --- | --- |
| Sources | https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API · https://macroquad.rs/ |
| Retrieved | 2026-10-21 22:41:56–57 UTC, HTTP 200 (216,210 and 9,116 bytes) |
| SHA-256 | MDN `08270fd07fe18b6a0169f603be9e25d64d12bf1b2b44d8ace973b551843c0307` · macroquad `70fb0eb136cbf1d115c2f708b383244768dcbea0e027753e6181e3919ecbde67` |
| Also checked | the toolchains on this machine, 2026-10-21 22:42 UTC |

## WebGPU (MDN)

- Status: **"Limited availability … not Baseline because it does not work in
  some of the most widely-used browsers."** It needs a **secure context**
  (HTTPS); yodacon.org and GitHub Pages qualify, `localhost` does too.
- Entry point: `navigator.gpu` → `requestAdapter()` → `requestDevice()`.
  Shaders are written in **WGSL** ("a low-level Rust-like language").
- MDN notes a *core* versus *compatibility* mode, detectable through the
  `core-features-and-limits` feature.

**For the pack:** a WebGPU example must feature-test `navigator.gpu` and fall
back (to WebGL via three.js, or to Canvas 2D) with a visible note. Good
subjects, where the GPU earns its place: **ten thousand ships at once**
(instanced quads, each picking its frame from the 6×6 sheet in the vertex
shader), and **planets lit in a fragment shader** (the asset gap below,
generated on the GPU).

## Rust in the browser (macroquad)

- Macroquad: "Simple and easy to use game library for Rust", with "First class
  browsers support, WebGL1 and iOS Safari supported"; "UI, efficient 2D
  rendering, sound system—everything needed to make a 2D game included!"
- Start: `cargo new`, `cargo add macroquad`, an `async fn main` loop with
  `clear_background`, `draw_texture…`, `next_frame().await`.

**For the pack:** a macroquad example that loads `sheet-alpha.png` and draws a
frame by heading is the Rust counterpart of `examples/canvas/`.

## What this machine can build (checked, not assumed)

| Toolchain | Version | Browser target |
| --- | --- | --- |
| Rust (cargo, rustc, rustup) | 1.98.1 | needs `rustup target add wasm32-unknown-unknown` (a download, not yet done); no `wasm-pack` / `wasm-bindgen` installed |
| Go | 1.27.1 | **built in**: `GOOS=js GOARCH=wasm`, with `wasm_exec.js` at `/usr/local/lib/go/lib/wasm/` |
| Zig | 0.16.0 | **built in**: `-target wasm32-freestanding`, no runtime needed |
| Chromium | 152 | runs WebGPU and WebAssembly for testing |

Two findings worth acting on:

1. **Gonex can run in a browser tab.** It is Go and Ebitengine, and Ebitengine
   supports `GOOS=js GOARCH=wasm`. A browser build of Gonex is the biggest
   "compiled game" example the project could have, and it already flies the
   pack's ships.
2. **The smallest compiled example needs no installs**: a Zig (or Go) module
   that does the pack's frame maths, or a whole Konquest battle loop, exported
   to JavaScript. That shows the technique, and a WebAssembly Konquest engine
   could be checked turn for turn against the JavaScript one.

## Assets this points to

- Nothing new: compiled and GPU examples use the same PNG sheets. That is the
  point of the pack's plain layout.

// Confirmation beeps for the pack's games, made with Web Audio: no sound files.
// docs/STYLE.md, "Sound": short sine tones, higher for yes, lower for no, quiet,
// and always behind a mute switch that is remembered.
//
//   import { play, isMuted, setMuted, tone } from "…/lib/yodacon-sound.js";
//   play("send");                 // a named figure (below)
//   tone(440, 0, 0.1, "square");  // or any single tone
//
// Browsers only start audio after the player has clicked or pressed a key, so
// the AudioContext is created on the first sound that follows a gesture.
// The mute switch is remembered in localStorage (when the browser allows it).

const STORE = "yodacon-muted";   // one mute switch for every game
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(STORE) === "1"; } catch { /* storage blocked: default on */ }

function audio() {
  if (!ctx) {
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// One tone: frequency in Hz, start offset and length in seconds, a waveform,
// and a short attack and release so it clicks neither on nor off.
export function tone(freq, at = 0, length = 0.08, wave = "sine", gain = 0.18) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const amp = a.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

// Each event has its own short figure, so the ear learns them.
const SOUNDS = {
  select: () => tone(660, 0, 0.06),                                   // picked a source planet
  target: () => tone(880, 0, 0.06),                                   // picked a destination
  send: () => { tone(660, 0, 0.06); tone(990, 0.07, 0.09); },         // fleet ordered
  cancel: () => tone(440, 0, 0.08),                                   // deselect, take back an order
  error: () => tone(180, 0, 0.14, "square", 0.08),                    // order refused
  endTurn: () => { tone(523, 0, 0.07); tone(659, 0.08, 0.1); },
  conquered: () => { tone(523, 0, 0.08); tone(659, 0.08, 0.08); tone(784, 0.16, 0.14); },
  lost: () => { tone(392, 0, 0.1, "triangle"); tone(262, 0.11, 0.18, "triangle"); },
  held: () => { tone(330, 0, 0.07, "triangle"); tone(330, 0.09, 0.1, "triangle"); },
  won: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.16)),
  // for action games
  shot: () => tone(1200, 0, 0.04, "square", 0.05),
  hit: () => tone(300, 0, 0.06, "triangle", 0.12),
  boom: () => { tone(120, 0, 0.18, "sawtooth", 0.1); tone(80, 0.05, 0.25, "triangle", 0.12); },
  pickup: () => { tone(880, 0, 0.05); tone(1320, 0.05, 0.07); },
  coin: () => { tone(988, 0, 0.05); tone(1319, 0.06, 0.12); },
};

export function play(name) {
  if (!muted) SOUNDS[name]?.();
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(STORE, value ? "1" : "0"); } catch { /* not remembered: fine */ }
}

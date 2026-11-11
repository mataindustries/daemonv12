// Four competing 2-bar hooks, each stated twice (Bm bars 1-2, G bars 3-4) over identical
// minimal accompaniment. Dry, cheap Node route: no mix/effects/automation/render fields.
import { N, T, SRC, project, write, pos } from './score-lib.mjs';

const BARS = 4;
function accompaniment() {
  const pad = [N('horizon', 0, 'B2', { g: 32, off: 1.6, a: 0.15, r: 0.9, v: 0.4 }),
    N('horizon', 32, 'G2', { g: 32, off: 1.6, a: 0.15, r: 1.2, v: 0.4 })];
  const sub = [N('abyss', 0, 'B1', { g: 31, a: 0.004, r: 0.08, v: 0.42 }),
    N('abyss', 32, 'G1', { g: 31, a: 0.004, r: 0.08, v: 0.42 })];
  const kick = [0, 8, 16, 24, 32, 40, 48, 56].map((i) => N('kick', i, i < 32 ? 'B1' : 'G1', { v: 0.6 }));
  return [T('pad', SRC.horizon, BARS, pad), T('sub', SRC.abyss, BARS, sub), T('kick', SRC.kick, BARS, kick)];
}
const twice = (fn) => [...fn(0), ...fn(32)];
const lead = (inst) => (list) => list.map(([i, p, g, v, o = {}]) => N(inst, i, p, { g, v, a: 0.005, r: 0.12, ...o }));

const hooks = {
  // A: repeated-note tresillo call (3+3+2) -> minor-sixth leap to the flat-6 -> sigh down to 5.
  'hook-a-tresillo-leap': [T('lead', SRC.phantom, BARS, twice((b) => lead('phantom')([
    [b, 'B4', 5, 0.72], [b + 6, 'B4', 5, 0.7], [b + 12, 'B4', 3, 0.76], [b + 16, 'G5', 11, 0.9], [b + 28, 'F#5', 4, 0.8]])))],
  // B: SIGNAL 16th ostinato grouped 3+3+3+3+2+2; top line rises (bar 1) then falls (bar 2).
  'hook-b-grouped-ostinato': [T('lead', SRC.signal, BARS, twice((b) => {
    const bars = ['B3 F#4 D5 B3 F#4 E5 B3 F#4 F#5 B3 F#4 G5 B3 F#5 B3 D5', 'B3 F#4 G5 B3 F#4 F#5 B3 F#4 E5 B3 F#4 C#5 B3 D5 B3 F#4'];
    const vel = [0.5, 0.42, 0.78, 0.5, 0.42, 0.78, 0.5, 0.42, 0.78, 0.5, 0.42, 0.78, 0.5, 0.7, 0.5, 0.7];
    return bars.flatMap((s, k) => s.split(' ').map((p, j) => N('signal', b + 16 * k + j, p, { g: 1, a: 0.001, r: 0.04, v: vel[j] })));
  }))],
  // C: CHROME bell: three off-beat repeated notes -> stepwise ascent to a ringing E5 -> off-beat descent, withheld.
  'hook-c-offbeat-bell': [T('lead', SRC.chrome, BARS, twice((b) => [
    ...[[2, 'B4', 0.66], [6, 'B4', 0.64], [10, 'B4', 0.68], [12, 'C#5', 0.58], [14, 'D5', 0.72]].map(([i, p, v]) => N('chrome', b + i, p, { g: '1/4', r: 0.25, v })),
    N('chrome', b + 16, 'E5', { g: 6, r: 0.6, v: 0.8 }), N('chrome', b + 22, 'D5', { g: '1/4', r: 0.25, v: 0.6 }), N('chrome', b + 26, 'C#5', { g: 5, r: 0.5, v: 0.62 })]))],
  // D: long high B5, quarter-note-triplet descent (3 against 2), low landing on D5, pickup F#5-A5 back to B5.
  'hook-d-triplet-descent': [T('lead', SRC.phantom, BARS, twice((b) => {
    const bar = b / 16 + 1;
    return lead('phantom')([[b, 'B5', 7, 0.84], [`${bar}:3`, 'A5', '1/6', 0.74], [`${bar}:3+1/6`, 'G5', '1/6', 0.72],
      [`${bar}:4+1/12`, 'F#5', '1/6', 0.74], [b + 16, 'E5', 6, 0.82], [b + 22, 'F#5', 2, 0.68], [b + 24, 'D5', 5, 0.8],
      [b + 30, 'F#5', 1, 0.64], [b + 31, 'A5', 1, 0.68]]);
  }))],
};
for (const [name, leadTracks] of Object.entries(hooks))
  write(`${name}.json`, project(name, 140, BARS, [...leadTracks, ...accompaniment()]));
console.log(Object.keys(hooks).join('\n'));
void pos;

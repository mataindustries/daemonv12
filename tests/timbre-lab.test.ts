/** Timbre Lab: the frozen rack is untouched without the registration, and the lab instruments are valid rack instruments. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { ScoreInput } from '../studio-001/rack/types.ts';

// The rack registry as every other process sees it, loaded BEFORE the lab registers itself.
const core = await import('../studio-001/rack/registry.ts');
const coreDoc = JSON.stringify(core.registryDocument());
const { rack, LAB_INSTRUMENTS } = await import('../timbre-lab/index.ts');
const { labMarkdown, LAB_MD } = await import('../timbre-lab/docs.ts');

const RATE = 44100;
const score = (parts: ScoreInput['parts'], bars = 1): ScoreInput => ({ schema: rack.SCORE_SCHEMA, title: 'lab test', bpm: 120, key: 'D minor', seed: 5, tailSeconds: 0.5, sections: [{ id: 'a', bars }], parts });
const render = async (parts: ScoreInput['parts'], bars = 1) => (await rack.renderScore(rack.normalizeScore(score(parts, bars)))).parts.map(p => p.audio);
const rms = (w: Float64Array, from = 0, to = w.length) => { let s = 0; for (let i = from; i < to; i++) s += w[i]! * w[i]!; return Math.sqrt(s / (to - from)); };
const db = (x: number) => 20 * Math.log10(x + 1e-12);
const brightness = (w: Float64Array, from: number, to: number) => { let n = 0, d = 0; for (let i = from + 1; i < to; i++) { n += (w[i]! - w[i - 1]!) ** 2; d += w[i]! ** 2; } return Math.sqrt(n / (d + 1e-30)); };
const digest = (chs: Float64Array[]) => { const h = createHash('sha256'); for (const c of chs) h.update(new Uint8Array(c.buffer, c.byteOffset, c.byteLength)); return h.digest('hex'); };
/** Fundamental in Hz near `expect`, by autocorrelation with parabolic interpolation. */
function pitch(w: Float64Array, from: number, len: number, expect: number): number {
  let best = -1, at = 0; const c: number[] = [];
  for (let lag = Math.floor(RATE / (expect * 1.3)); lag <= Math.ceil(RATE / (expect / 1.3)); lag++) {
    let s = 0, a = 0, b = 0;
    for (let i = from; i < from + len; i++) { s += w[i]! * w[i + lag]!; a += w[i]! ** 2; b += w[i + lag]! ** 2; }
    c[lag] = s / Math.sqrt(a * b + 1e-30); if (c[lag]! > best) { best = c[lag]!; at = lag; }
  }
  const y0 = c[at - 1] ?? best, y2 = c[at + 1] ?? best;
  return RATE / (at + 0.5 * (y0 - y2) / (y0 - 2 * best + y2 || 1));
}

test('without the registration the rack registry is exactly the frozen one', () => {
  assert.equal(core.listInstruments().length, 10);
  for (const i of LAB_INSTRUMENTS) assert.equal(core.getInstrument(i.id), undefined, i.id);
  // and the registered view keeps the frozen instruments first, unchanged
  const doc = rack.registryDocument();
  assert.equal(JSON.stringify({ ...doc, instruments: doc.instruments.slice(0, 10) }), coreDoc);
  assert.deepEqual(doc.instruments.slice(10).map(i => i.id), ['organic-percussion/skin', 'organic-percussion/log', 'organic-percussion/pot', 'breath-reed']);
});

test('lab instruments are complete rack instruments and the reference is current', () => {
  for (const i of LAB_INSTRUMENTS) {
    assert.equal(rack.getInstrument(i.id)?.id, i.id);
    assert.match(i.version, /^\d+\.\d+\.\d+\+timbre-lab$/);
    assert.ok(i.range[0] < i.range[1] && Object.keys(i.articulations).length >= 4, i.id);
    assert.ok(i.controls.length >= 5, i.id);
    for (const c of i.controls) assert.ok(c.min < c.max && c.description, `${i.id}.${c.name}`);
  }
  assert.equal(readFileSync(LAB_MD, 'utf8'), labMarkdown(), 'timbre-lab/LAB.md is stale: run node timbre-lab/docs.ts');
  const index = JSON.parse(readFileSync('timbre-lab/auditions/auditions.json', 'utf8')) as { clips: { id: string; family: string; compare: boolean }[] };
  for (const fam of ['organic-percussion', 'breath-reed']) {
    assert.ok(index.clips.filter(c => c.family === fam && !c.compare).length >= 3, fam);
    assert.equal(index.clips.filter(c => c.family === fam && c.compare).length, 1, fam);
  }
  for (const c of index.clips) assert.ok(existsSync(`timbre-lab/auditions/${c.id}.mp3`), c.id);
});

test('scores validate lab parts like any other part', () => {
  const bad = (parts: ScoreInput['parts'], re: RegExp) => assert.throws(() => rack.normalizeScore(score(parts)), re);
  bad([{ id: 'd', instrument: 'organic-percussion/skin', notes: [[0, 1, 'C7', 0.8]] }], /outside organic-percussion\/skin range/);
  bad([{ id: 'd', instrument: 'organic-percussion/pot', notes: [[0, 1, 'D2', 0.8, { articulation: 'slap' }]] }], /articulation "slap"/);
  bad([{ id: 'r', instrument: 'breath-reed', controls: { shell: 0.2 } }], /not a control of breath-reed/);
  assert.equal(rack.normalizeScore(score([{ id: 'r', instrument: 'breath-reed', notes: [[0, 1, 'A3', 0.8, { articulation: 'fall', fall: 4 }]] }])).parts[0]!.instrument.id, 'breath-reed');
});

test('every lab instrument is deterministic, finite and calibrated to the rack level', async () => {
  for (const i of LAB_INSTRUMENTS) {
    const arts = Object.keys(i.articulations), mid = Math.round((i.range[0] + i.range[1]) / 2);
    const part = { id: 'p', instrument: i.id, macro: [[0, 0], [8, 1]] as [number, number][], setup: { seed: 9 },
      notes: arts.map((articulation, k) => [k * (8 / arts.length), 0.9, mid + (k % 3) * 2, 0.4 + 0.6 * ((k * 7) % 10) / 10, { articulation }] as [number, number, number, number, Record<string, string>]) };
    const [a] = await render([part], 2), [b] = await render([part], 2);
    assert.equal(digest(a!), digest(b!), `${i.id}: two renders differ`);
    for (const ch of a!) for (let k = 0; k < ch.length; k++) assert.ok(Number.isFinite(ch[k]!) && Math.abs(ch[k]!) < 8, `${i.id}: sample ${k}`);
    assert.ok(db(rms(a![0]!)) > -45, `${i.id}: silent`);
  }
  // the rack's contract: a reference note at macro 0, velocity 0.8 is -20 dBFS RMS (expression 0.7 is neutral)
  const [skinParts, reedParts] = await Promise.all([
    render([{ id: 'p', instrument: 'organic-percussion/skin', setup: { spread: 0 }, notes: [[0, 1, 55, 0.8, { articulation: 'open', pos: 0.5 }]] }]),
    render([{ id: 'p', instrument: 'breath-reed', controls: { vib: 0, drift: 0 }, notes: [[0, 3, 57, 0.8]] }]),
  ]);
  const skin = skinParts[0]![0], reed = reedParts[0]![0];
  assert.ok(Math.abs(db(rms(skin!, 0, Math.round(0.3 * RATE))) + 20) < 1.5, `skin reference ${db(rms(skin!, 0, Math.round(0.3 * RATE))).toFixed(1)} dBFS`);
  assert.ok(Math.abs(db(rms(reed!, Math.round(0.3 * RATE), Math.round(0.9 * RATE))) + 20) < 1.5, `reed reference ${db(rms(reed!, Math.round(0.3 * RATE), Math.round(0.9 * RATE))).toFixed(1)} dBFS`);
});

test('organic percussion answers the hand: velocity, place, staying on the skin, squeeze', async () => {
  const hit = async (opts: Record<string, number | string>, velocity = 0.8, extra: Record<string, unknown> = {}) =>
    (await render([{ id: 'p', instrument: 'organic-percussion/skin', setup: { spread: 0, seed: 3 }, ...extra, notes: [[0, 1.5, 55, velocity, opts]] }]))[0]![0]!;
  const win = Math.round(0.3 * RATE), [soft, hard, bass, slap, mute] = await Promise.all([hit({ articulation: 'open' }, 0.3), hit({ articulation: 'open' }, 0.95), hit({ articulation: 'bass' }), hit({ articulation: 'slap' }), hit({ articulation: 'mute' })]);
  assert.ok(db(rms(hard!, 0, win)) - db(rms(soft!, 0, win)) > 8, 'a hard hit is much louder');
  assert.ok(brightness(hard!, 0, 2205) > brightness(soft!, 0, 2205), 'and brighter: the contact is shorter');
  assert.ok(brightness(slap!, 0, 2205) > 2.5 * brightness(bass!, 0, 2205), 'a slap at the edge is far brighter than a palm in the centre');
  const open = await hit({ articulation: 'open' });
  assert.ok(db(rms(open, Math.round(0.15 * RATE), win)) - db(rms(mute!, Math.round(0.15 * RATE), win)) > 10, 'a hand that stays on the skin kills the ring');
  assert.ok(Math.abs(1200 * Math.log2(pitch(open, Math.round(0.12 * RATE), 6000, 196) / 196)) < 25, 'the open tone settles on the written pitch');
  // friction: a rubbed note sustains at the skin's pitch and follows the squeeze upward
  const rub = await hit({ articulation: 'rub', bend: 5 }, 0.8, { controls: { buzz: 0 } });
  const early = pitch(rub, Math.round(0.1 * RATE), 5000, 200), late = pitch(rub, Math.round(0.6 * RATE), 5000, 250);
  assert.ok(db(rms(rub, Math.round(0.4 * RATE), Math.round(0.6 * RATE))) > -32, 'the rub sustains');
  assert.ok(late / early > 1.15, `the rub follows the squeeze (${early.toFixed(0)} -> ${late.toFixed(0)} Hz)`);
  // the pot's pitch is the air inside: it whoops up to the written note
  const pot = (await render([{ id: 'p', instrument: 'organic-percussion/pot', macro: 0.6, notes: [[0, 1.5, 45, 0.6, { articulation: 'whoop' }]] }]))[0]![0]!;
  assert.ok(pitch(pot, 300, 2400, 90) < 104 && Math.abs(pitch(pot, Math.round(0.3 * RATE), 6000, 110) - 110) < 4, 'the pot whoops up to its pitch');
});

/** Normalised autocorrelation at the period of A3: near 1 for a tone, low for breath noise. */
function pitchiness(w: Float64Array, from: number): number {
  let s = 0, x = 0, y = 0; const lag = Math.round(RATE / 220);
  for (let i = from; i < from + 8000; i++) { s += w[i]! * w[i + lag]!; x += w[i]! ** 2; y += w[i + lag]! ** 2; }
  return s / Math.sqrt(x * y + 1e-30);
}
test('breath reed answers the breath: dynamics, tuning, slides, falls, the register break', async () => {
  const play = async (notes: unknown[], extra: Record<string, unknown> = {}) => (await render([{ id: 'r', instrument: 'breath-reed', controls: { vib: 0, drift: 0 }, ...extra, notes } as ScoreInput['parts'][number]], 2))[0]![0]!;
  const a = Math.round(0.4 * RATE), b = Math.round(1.2 * RATE);
  const [soft, loud, air] = await Promise.all([play([[0, 4, 57, 0.2]]), play([[0, 4, 57, 1]]), play([[0, 4, 57, 0.8]], { controls: { breath: 0.06, vib: 0, drift: 0 } })]);
  assert.ok(db(rms(loud!, a, b)) - db(rms(soft!, a, b)) > 10, 'blowing harder is much louder');
  assert.ok(db(rms(loud!, a, b)) - db(rms(air!, a, b)) > 15 && db(rms(air!, a, b)) > -55 && pitchiness(air!, a) < 0.7 && pitchiness(loud!, a) > 0.95, 'under the threshold pressure there is only air');
  for (const [midi, f] of [[45, 110], [57, 220], [69, 440], [81, 880]] as const) {
    const w = await play([[0, 4, midi, 0.8]]);
    assert.ok(Math.abs(1200 * Math.log2(pitch(w, a, 8000, f) / f)) < 8, `in tune at MIDI ${midi}`);
  }
  const line = await play([[0, 2, 57, 0.8], [2, 2, 64, 0.8, { slide: 1 }], [4, 3, 62, 0.9, { articulation: 'fall', fall: 5 }]]);
  const mid = pitch(line, Math.round(1.25 * RATE), 3000, 270), end = pitch(line, Math.round(1.9 * RATE), 4000, 330);
  assert.ok(mid > 235 && mid < 315 && Math.abs(end - 329.6) < 6, `a slide travels under one breath (${mid.toFixed(0)} -> ${end.toFixed(0)} Hz)`);
  assert.ok(pitch(line, Math.round(3.3 * RATE), 3000, 250) < 275, 'a fall falls');
  const broken = await play([[0, 6, 50, 0.9, { articulation: 'overblow' }]]);
  assert.ok(Math.abs(pitch(broken, Math.round(0.4 * RATE), 8000, 146.8) - 146.8) < 3, 'starts on the fundamental');
  assert.ok(Math.abs(pitch(broken, Math.round(2.6 * RATE), 8000, 440) - 440) < 12, 'breaks to the twelfth');
});

/**
 * Score -> DaemonV12 project builder. A Song collects kits (sample families rendered on demand),
 * tracks of sample notes in absolute ticks, sections and automation, then writes:
 *   <dir>/assets/<kit>/<hit>.wav + kit.json, <dir>/<name>.json, <dir>/<name>.catalog.json
 * Only engine-documented project fields are emitted (formatVersion 1, engine 0.7.0).
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { encodeWav, peakOf, trimTail, dbAmp, SR, type Wave } from './dsp.ts';

export const PPQ = 960, BAR = 3840, STEP = 240;
export interface Section { name: string; bar: number; bars: number; note?: string }
export interface Hit { tick: number; hit: string; v?: number; gate?: number; attack?: number; release?: number; choke?: string;
  rate?: number; glideTo?: number; glideTicks?: number; offset?: number; end?: number }
export interface AutoPoint { tick: number; value: number; linear?: boolean }
interface KitEntry { name: string; pitch: number; render: () => Wave[]; recipe: string; tuning?: string }
export interface KitOptions { peakDb?: number; trimDb?: number; recipeFamily: string }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export function fmtDuration(ticks: number): string { const g = gcd(ticks, 3840); return `${ticks / g}/${3840 / g}`; }
export function fmtPosition(tick: number): string {
  const bar = Math.floor(tick / BAR) + 1, r = tick % BAR, beat = Math.floor(r / 960) + 1, off = r % 960;
  return `${bar}:${beat}${off ? '+' + fmtDuration(off) : ''}`;
}
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const r6 = (x: number) => Number(x.toFixed(6));

export class Kit {
  entries: KitEntry[] = []; private byName = new Map<string, KitEntry>(); name: string; opts: KitOptions;
  constructor(name: string, opts: KitOptions) { this.name = name; this.opts = opts; }
  /** Registers (once) a sound by name; returns the name for use in notes. */
  add(name: string, render: () => Wave[], recipe: string, tuning?: string): string {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || name.length > 32) throw new Error(`bad hit name ${name}`);
    if (!this.byName.has(name)) { const e = { name, pitch: this.entries.length, render, recipe, tuning }; this.entries.push(e); this.byName.set(name, e); }
    return name;
  }
  has(name: string) { return this.byName.has(name); }
}

export class Track {
  hits: Hit[] = []; auto: { gainDb?: AutoPoint[]; pan?: AutoPoint[] } = {};
  id: string; kit: Kit; description: string; mix: { gainDb?: number; pan?: number }; effects: Record<string, unknown>[];
  constructor(id: string, kit: Kit, description: string, mix: { gainDb?: number; pan?: number } = {}, effects: Record<string, unknown>[] = []) {
    this.id = id; this.kit = kit; this.description = description; this.mix = mix; this.effects = effects;
  }
  add(h: Hit): this { if (!this.kit.has(h.hit)) throw new Error(`${this.id}: unknown hit ${h.hit}`); this.hits.push(h); return this; }
}

export class Song {
  kits = new Map<string, Kit>(); tracks: Track[] = []; sections: Section[] = [];
  master: Record<string, unknown> = {}; render: Record<string, unknown> | undefined;
  title: string; bpm: number; bars: number; key: string; description: string; seed: number;
  constructor(title: string, bpm: number, bars: number, key: string, description: string, seed = 0) {
    this.title = title; this.bpm = bpm; this.bars = bars; this.key = key; this.description = description; this.seed = seed;
  }
  get usPerQuarter() { return Math.round(60_000_000 / this.bpm); }
  get tickSec() { return this.usPerQuarter / PPQ / 1_000_000; }
  get beatSec() { return this.usPerQuarter / 1_000_000; }
  /** Absolute tick of bar (1-based), 16th step (1-based) plus extra ticks. */
  at(bar: number, step = 1, extra = 0) { return (bar - 1) * BAR + (step - 1) * STEP + extra; }
  kit(name: string, opts: KitOptions): Kit { let k = this.kits.get(name); if (!k) { k = new Kit(name, opts); this.kits.set(name, k); } return k; }
  track(id: string, kit: Kit, description: string, mix: { gainDb?: number; pan?: number } = {}, effects: Record<string, unknown>[] = []): Track {
    const t = new Track(id, kit, description, mix, effects); this.tracks.push(t); return t;
  }
  section(name: string, bar: number, bars: number, note?: string) { this.sections.push({ name, bar, bars, note }); }

  private noteJson(h: Hit, base: number) {
    const o: Record<string, unknown> = { start: fmtPosition(h.tick - base), pitch: h.hit };
    if (h.v !== undefined && h.v !== 0.8) o.velocity = r6(Math.min(1, Math.max(0.01, h.v)));
    if (h.rate !== undefined && h.rate !== 1) o.playbackRate = r6(h.rate);
    if (h.offset) o.offsetSeconds = r6(h.offset);
    if (h.glideTo !== undefined) o.glide = { to: r6(h.glideTo), duration: fmtDuration(h.glideTicks ?? 240) };
    if (h.end !== undefined) o.endSeconds = r6(h.end);
    if (h.gate !== undefined) o.gate = fmtDuration(h.gate);
    if (h.attack !== undefined || h.release !== undefined) o.envelope = { attackSeconds: r6(h.attack ?? 0.001), releaseSeconds: r6(h.release ?? 0.005) };
    if (h.choke) o.chokeGroup = h.choke;
    return o;
  }
  private lane(points: AutoPoint[]) {
    const sorted = [...points].sort((a, b) => a.tick - b.tick), out: Record<string, unknown>[] = [];
    for (const p of sorted) {
      if (out.length && fmtPosition(p.tick) === (out[out.length - 1]!.at as { musical: string }).musical) out.pop();
      out.push({ at: { musical: fmtPosition(p.tick) }, value: r6(p.value), ...(p.linear ? { transition: 'linear' } : {}) });
    }
    return out;
  }
  projectJson(assetRoot: string): Record<string, unknown> {
    const tracks = this.tracks.map(t => {
      const patterns: Record<string, unknown>[] = [], clips: Record<string, unknown>[] = [], seen = new Map<string, string>();
      for (const s of this.sections) {
        const lo = (s.bar - 1) * BAR, hi = lo + s.bars * BAR;
        const hits = t.hits.filter(h => h.tick >= lo && h.tick < hi).sort((a, b) => a.tick - b.tick || a.hit.localeCompare(b.hit));
        if (!hits.length) continue;
        const notes = hits.map(h => this.noteJson(h, lo)), key = `${s.bars}|${JSON.stringify(notes)}`;
        let id = seen.get(key);
        if (!id) { id = s.name; seen.set(key, id); patterns.push({ id, bars: s.bars, notes }); }
        clips.push({ bar: s.bar, pattern: id });
      }
      const track: Record<string, unknown> = { id: t.id, description: t.description, instrument: { type: 'drumkit', kit: `${assetRoot}/${t.kit.name}/kit.json` } };
      track.clips = clips; track.patterns = patterns;
      track.mix = { gainDb: r6(t.mix.gainDb ?? 0), pan: r6(t.mix.pan ?? 0) };
      if (t.effects.length) track.effects = t.effects;
      const auto: Record<string, unknown> = {};
      if (t.auto.gainDb?.length) auto.gainDb = this.lane(t.auto.gainDb);
      if (t.auto.pan?.length) auto.pan = this.lane(t.auto.pan);
      if (Object.keys(auto).length) track.automation = auto;
      return track;
    });
    const p: Record<string, unknown> = { formatVersion: 1, title: this.title, description: this.description, bpm: this.bpm, timeSignature: '4/4', key: this.key, bars: this.bars, seed: this.seed, tracks };
    if (this.render) p.render = this.render;
    p.master = this.master;
    return p;
  }
  /** Renders only the sounds a kit registered, normalizes each kit once (relative levels preserved), writes WAV + kit.json. */
  writeAssets(dir: string, assetRoot = 'assets/sodium'): Record<string, unknown>[] {
    const catalog: Record<string, unknown>[] = [];
    for (const kit of this.kits.values()) {
      const kdir = join(dir, assetRoot, kit.name);
      if (existsSync(kdir)) rmSync(kdir, { recursive: true });
      mkdirSync(kdir, { recursive: true });
      const rendered = kit.entries.map(e => ({ e, chs: trimTail(e.render(), kit.opts.trimDb ?? -78, 0.03) }));
      const peak = Math.max(...rendered.map(r => peakOf(r.chs))), gain = dbAmp(kit.opts.peakDb ?? -1) / peak;
      const samples: Record<string, unknown>[] = [];
      for (const { e, chs } of rendered) {
        const file = `${e.name}.wav`, bytes = encodeWav(chs, gain);
        writeFileSync(join(kdir, file), bytes);
        samples.push({ name: e.name, pitch: e.pitch, file });
        catalog.push({ kit: kit.name, hit: e.name, file: `${assetRoot}/${kit.name}/${file}`, sha256: sha(bytes), bytes: bytes.length,
          frames: chs[0]!.length, seconds: r6(chs[0]!.length / SR), channels: chs.length, family: kit.opts.recipeFamily, tuning: e.tuning ?? null, recipe: e.recipe });
      }
      writeFileSync(join(kdir, 'kit.json'), JSON.stringify({ formatVersion: 1, samples }, null, 2) + '\n');
    }
    return catalog;
  }
  write(dir: string, name: string, assetRoot = 'assets/sodium'): { project: string; catalog: Record<string, unknown>[] } {
    mkdirSync(dir, { recursive: true });
    const catalog = this.writeAssets(dir, assetRoot);
    const project = join(dir, `${name}.json`);
    writeFileSync(project, JSON.stringify(this.projectJson(assetRoot), null, 2) + '\n');
    return { project, catalog };
  }
}

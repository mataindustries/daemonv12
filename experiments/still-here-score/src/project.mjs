// Score -> DaemonV12 project (formatVersion 1, engine 0.7.0). Every track becomes one pattern
// spanning the whole piece, placed once at bar 1, so each note's position string IS its
// absolute musical position. Drum-kit and sampler notes are native engine triggers; a
// sampler track holding a full-length external performance has a single note at 1:1.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { writePcm16 } from './wav.mjs';
import { createHash } from 'node:crypto';

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const chans = a => (Array.isArray(a) ? a : a.L ? [a.L, a.R] : [a]);
const r6 = v => Math.round(v * 1e6) / 1e6;

/**
 * spec: { name, title, description, bpm, bars, key, grid, master, tracks: [track] }
 * track: { id, description, kit?: [{ name, pitch, audio }], sample?: audio, external?: true,
 *          notes: [{ pos, hit?, vel?, ...articulation }], mix?, effects?, automation? }
 * audio: Float64Array (mono), [L, R] or { L, R }.
 * Returns { path, project, assets: [{ path, sha256, bytes }] }.
 */
export function writeProject(dir, spec) {
  rmSync(join(dir, 'assets'), { recursive: true, force: true });
  mkdirSync(join(dir, 'assets'), { recursive: true });
  const assets = [], g = spec.grid;
  const save = (rel, audio) => {
    const buf = writePcm16(join(dir, rel), chans(audio), rel);
    assets.push({ path: rel, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length });
  };
  const tracks = spec.tracks.map(t => {
    if (!ID.test(t.id)) throw new Error(`track id ${t.id}`);
    let instrument;
    if (t.kit) {
      const kit = { formatVersion: 1, samples: t.kit.map(k => {
        if (!ID.test(k.name)) throw new Error(`kit name ${k.name}`);
        save(`assets/${t.id}/${k.name}.wav`, k.audio);
        return { name: k.name, pitch: k.pitch, file: `${k.name}.wav` };
      }) };
      const rel = `assets/${t.id}/kit.json`, text = JSON.stringify(kit, null, 2) + '\n';
      writeFileSync(join(dir, rel), text);
      assets.push({ path: rel, sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text) });
      instrument = { type: 'drumkit', kit: rel };
    } else {
      save(`assets/${t.id}.wav`, t.sample);
      instrument = { type: 'sampler', sample: `assets/${t.id}.wav` };
    }
    const notes = [...t.notes].sort((a, b) => a.pos - b.pos).map(({ pos, hit, vel = 0.8, ...rest }) => {
      const note = { start: g.position(pos) };
      if (t.kit) note.pitch = hit;
      note.velocity = r6(Math.min(1, Math.max(0.001, vel)));
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) note[k] = v;
      return note;
    });
    const track = { id: t.id, description: t.description, instrument };
    if (t.mix) track.mix = t.mix;
    if (t.effects?.length) track.effects = t.effects;
    if (t.automation) track.automation = t.automation;
    track.patterns = [{ id: 'all', bars: spec.bars, notes }];
    track.clips = [{ bar: 1, pattern: 'all' }];
    return track;
  });
  const project = {
    formatVersion: 1, title: spec.title, description: spec.description, bpm: spec.bpm, timeSignature: '4/4', key: spec.key, bars: spec.bars, seed: spec.seed ?? 1,
    render: { duration: { seconds: 12 }, tail: 'none' }, master: spec.master, tracks,
  };
  const path = join(dir, `${spec.name}.daemonv12.json`);
  writeFileSync(path, JSON.stringify(project, null, 2) + '\n');
  return { path, project, assets };
}

/**
 * Authored sidechain: a gain lane (absolute dB, seconds) that dips under each trigger time and
 * recovers linearly in dB. DaemonV12 has no track sidechain; this is the documented substitute.
 */
export function duckLane(base, times, { depth = 12, pre = 0.003, recover = 0.11, from = 0, to = 12 } = {}) {
  const ts = [...new Set(times)].filter(t => t >= from && t < to).sort((a, b) => a - b);
  const pts = [{ t: from, v: base }];
  ts.forEach((t, k) => {
    // approach: ramp into the dip over `pre` seconds (no gain step under a waveform)
    if (k === 0 || t - pre > pts[pts.length - 1].t + 0.001) pts.push({ t: t - pre, v: base, lin: true });
    pts.push({ t, v: base - depth, lin: true });
    const next = ts[k + 1] ?? Infinity;
    if (t + recover + pre + 0.002 < next) pts.push({ t: t + recover, v: base });
    else if (next < Infinity) { // the next dip arrives mid-recovery: stop the ramp where it is
      const end = next - pre, v = base - depth * (1 - (end - t) / recover);
      pts.push({ t: end, v, lin: true });
    }
  });
  const out = [];
  for (const p of pts) {
    const f = Math.floor(p.t * 44100 + 0.5);
    if (out.length && f <= out[out.length - 1].f) continue;
    out.push({ ...p, f });
  }
  return out.map(p => ({ at: { seconds: r6(Math.max(0, p.t)) }, value: r6(p.v), ...(p.lin ? { transition: 'linear' } : {}) }));
}

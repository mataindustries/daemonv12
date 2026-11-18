/** Original spectral and modal performance voices for WEST//GHOST 001.
 * No recordings, historical MORPH code, external formant tables or presets.
 * These are synthesis instruments, not simulations of an identifiable voice or object. */
import { SR, TAU, valueAt, frequency, envelope, random, removeDc, type Performance } from './westghost-dsp.ts';

// Hand-authored broad spectral peaks. The continuum is ah -> eh -> ee -> oh -> oo.
const vowels = [
  [760, 1220, 2540], [530, 1810, 2520], [310, 2260, 3000], [490, 890, 2530], [340, 730, 2310],
] as const;
const widths = [115, 170, 240] as const;

/** Harmonic spectral resynthesis keeps vowel centres independent of note pitch.
 * Sixty-four harmonics maximum, below both 8 kHz and 0.42 times sample rate.
 * Spectral weights interpolate over 32 samples instead of switching coefficients.
 * Motion opens delayed vibrato; breath is seeded high-passed, low-passed noise.
 * The fixed tanh gain bounds peaks without normalizing one note against another.
 * Its mild nonlinear output stage is not claimed to be alias-free. */
export function apparition(p: Performance): Float64Array {
  const release = p.release ?? 0.4, out = new Float64Array(Math.round((p.gate + release) * SR));
  const noise = random(p.seed ?? 0x41505041), whisper = p.articulation === 'whisper';
  const previous = new Float64Array(64), target = new Float64Array(64);
  let phase = 0, noiseLow = 0, airLow = 0;
  const airHp = 1 - Math.exp(-TAU * 1200 / SR), airLp = 1 - Math.exp(-TAU * 6500 / SR);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, pressure = valueAt(p.expression, t, 0.8), motion = valueAt(p.motion, t, 0.35);
    const vibrato = 0.13 * motion * (1 - Math.exp(-Math.max(0, t - 0.25) / 0.35)) * Math.sin(TAU * 5.2 * t);
    const hz = frequency(valueAt(p.pitch, t, p.note) + vibrato);
    if (i % 32 === 0) {
      previous.set(target);
      const position = Math.max(0, Math.min(1, valueAt(p.timbre, t, 0.75))) * 4;
      const vowel = Math.min(3, Math.floor(position)), blend = position - vowel;
      const centres = vowels[vowel]!.map((v, k) => v + (vowels[vowel + 1]![k]! - v) * blend);
      let squared = 0;
      for (let h = 1; h <= 64; h++) {
        const f = h * hz;
        let weight = 0;
        if (f < Math.min(8000, SR * 0.42)) {
          weight = 0.045 / h;
          for (let band = 0; band < 3; band++) {
            const distance = (f - centres[band]!) / widths[band]!;
            weight += [1, 0.7, 0.4][band]! * Math.exp(-0.5 * distance * distance) / h ** (0.35 + 0.3 * (1 - pressure));
          }
          // A raised-cosine ceiling avoids admitting a new partial abruptly.
          weight *= Math.min(1, Math.max(0, (Math.min(8000, SR * 0.42) - f) / 400));
        }
        target[h - 1] = weight;
        squared += weight * weight;
      }
      const scale = 0.38 / Math.sqrt(Math.max(squared, 1e-12));
      for (let h = 0; h < 64; h++) target[h] = target[h]! * scale;
      if (i === 0) previous.set(target);
    }
    const sine = Math.sin(phase), cosine = Math.cos(phase), blend = (i % 32) / 32;
    let harmonicSin = sine, harmonicCos = cosine, voiced = 0;
    for (let h = 0; h < 64; h++) {
      voiced += harmonicSin * (previous[h]! + (target[h]! - previous[h]!) * blend);
      const nextSin = harmonicSin * cosine + harmonicCos * sine;
      harmonicCos = harmonicCos * cosine - harmonicSin * sine; harmonicSin = nextSin;
    }
    const n = noise(); noiseLow += airHp * (n - noiseLow); airLow += airLp * (n - noiseLow - airLow);
    const breath = valueAt(p.breath, t, whisper ? 0.8 : 0.2);
    const aspiration = (whisper ? 0.16 : 0.018) + breath * (whisper ? 0.18 : 0.11) + 0.09 * Math.exp(-t / 0.06);
    const source = voiced * (whisper ? 0.52 : 1) + airLow * aspiration;
    const gain = envelope(t, p.gate, release, whisper ? 0.035 : 0.018) * (0.25 + pressure * 0.75) * (p.velocity ?? 0.85);
    out[i] = 0.55 * Math.tanh(source * 1.6) * gain;
    phase = (phase + TAU * hz / SR) % TAU;
  }
  return removeDc(out);
}

// Original chosen modal ratios: a tuned body plus inharmonic spring/metal modes.
const ratios = [1, 1.997, 2.731, 3.917, 5.383, 6.863, 8.947, 10.691, 13.291, 16.741, 20.117, 24.031] as const;

/** A bank of phase-continuous dispersive modes, contact noise and a motor pulse.
 * 'strike' decays naturally; 'bow' continuously feeds the virtual modal bank.
 * This is a playable modal approximation, not a calibrated spring or bow model.
 * Pitch changes integrate each mode's phase; changing hardness changes dispersion.
 * Modes fade before Nyquist. No nonlinear feedback loop can become unstable. */
export function ironBloom(p: Performance): Float64Array {
  const release = p.release ?? 0.4, out = new Float64Array(Math.round((p.gate + release) * SR));
  const phases = new Float64Array(ratios.length), noise = random(p.seed ?? 0x49524f4e), bow = p.articulation === 'bow';
  let motor = 0, noiseLow = 0;
  const noisePole = 1 - Math.exp(-TAU * 1900 / SR);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, pressure = valueAt(p.expression, t, 0.8), hardness = valueAt(p.timbre, t, 0.5), motion = valueAt(p.motion, t, 0.35);
    const hz = frequency(valueAt(p.pitch, t, p.note));
    // The motor repeatedly changes virtual contact strength; it does not reset modes.
    const motorContact = (0.5 + 0.5 * Math.sin(motor)) ** 8;
    let resonating = 0;
    for (let mode = 0; mode < ratios.length; mode++) {
      const dispersion = Math.sqrt(1 + hardness * 0.0016 * mode * mode);
      const f = hz * ratios[mode]! * dispersion;
      const ceiling = Math.min(1, Math.max(0, (SR * 0.45 - f) / 1200));
      const decay = Math.exp(-t * (0.78 + mode * 0.21) * (0.7 + hardness * 0.7));
      const held = (1 - Math.exp(-t / 0.055)) * (0.72 + 0.28 * motion * motorContact);
      const amplitude = (bow ? held * (0.55 + pressure * 0.45) : decay) / (1 + mode) ** (1.08 - hardness * 0.25);
      resonating += Math.sin(phases[mode]!) * amplitude * ceiling;
      phases[mode] = (phases[mode]! + TAU * Math.min(f, SR * 0.49) / SR) % TAU;
    }
    const n = noise(); noiseLow += noisePole * (n - noiseLow);
    const contact = (n - noiseLow) * (0.09 + 0.1 * hardness) * (bow ? 0.2 + 0.8 * motorContact : Math.exp(-t / (0.006 + hardness * 0.018)));
    const spring = Math.sin(phases[1]! + 1.5 * hardness * Math.sin(phases[0]!)) * (bow ? 0.08 : 0.16 * Math.exp(-t * 3));
    const gain = envelope(t, p.gate, release, bow ? 0.02 : 0.0015) * (0.3 + pressure * 0.7) * (p.velocity ?? 0.85);
    out[i] = 0.6 * Math.tanh(0.52 * resonating + contact + spring) * gain;
    motor = (motor + TAU * (1.5 + motion * 9) / SR) % TAU;
  }
  return removeDc(out);
}

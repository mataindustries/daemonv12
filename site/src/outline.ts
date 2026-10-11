// Waveform outline geometry, shared by the page (src/visuals.tsx) and the OG image
// script (scripts/og.ts). Plain TypeScript so Node can import it directly.

const f = (v: number) => Math.round(v * 10) / 10;

export type Outline = {env: readonly number[]};

/** Closed, mirrored envelope path in a width × height box, zero line through the middle. */
export const outlinePath = ({env}: Outline, width: number, height: number, gain = 0.92): string => {
  const n = env.length;
  const cy = height / 2;
  const amp = (height / 2) * gain;
  const x = (i: number) => f((i / (n - 1)) * width);
  const top = env.map((v, i) => `${x(i)},${f(cy - Math.max(v, 0.012) * amp)}`);
  const bottom = env.map((v, i) => `${x(i)},${f(cy + Math.max(v, 0.012) * amp)}`).reverse();
  return `M${top.join('L')}L${bottom.join('L')}Z`;
};

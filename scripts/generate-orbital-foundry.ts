/** ORBITAL FOUNDRY — offline, original synthesis. No runtime synth or external audio.
 * Run: node scripts/generate-orbital-foundry.ts [output project directory]
 * Float64 synthesis -> DC removal -> peak headroom -> rounded PCM16, no dither.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const RATE = 44100, TAU = 2 * Math.PI;
const sin = (cycles: number) => Math.sin(TAU * cycles);
const exp = (t: number, decay: number) => Math.exp(-t / decay);
const attack = (t: number, seconds = 0.001) => 1 - exp(t, seconds);
type Wave = Float64Array;
export const sounds = [
  {id:'sub-pulse', name:'SUB PULSE', seconds:0.30, channels:1, peak:-6, pitch:35, seed:0x0f0101, role:'49 Hz propulsion with 98/147 Hz translation; short recovery.', use:'Offbeat eighths or quarter notes; velocity 0.55–0.85.', method:'49 Hz sine, brief pitch fall, harmonic body and filtered contact transient.'},
  {id:'mechanical-kick', name:'MECHANICAL KICK', seconds:0.42, channels:1, peak:-6, pitch:36, seed:0x0f0202, role:'68 Hz body, 150–900 Hz mechanism and 2–5 kHz contact.', use:'Quarter-note drive or half-time; velocity 0.65–0.95.', method:'Exponential pitch sweep into 68 Hz, nonlinear body, damped 731/1837 Hz modes and band-limited noise.'},
  {id:'metallic-strike', name:'METALLIC STRIKE', seconds:1.65, channels:1, peak:-7, pitch:43, seed:0x0f0303, role:'Steel presence from 1–6 kHz with a 437 Hz support mode.', use:'Syncopated accents, sparse eighths; velocity 0.40–0.85.', method:'Seven inharmonic exponentially damped modes with frequency-dependent decay, contact noise and a secondary rattle.'},
  {id:'machine-tick', name:'MACHINE TICK', seconds:0.085, channels:1, peak:-9, pitch:42, seed:0x0f0404, role:'Crisp 2–9 kHz detail; negligible low-frequency energy.', use:'Eighths/sixteenths with alternating velocities 0.35–0.75.', method:'Two filtered contact impulses 7 ms apart, three very short metal modes.'},
  {id:'industrial-snare', name:'INDUSTRIAL SNARE', seconds:0.38, channels:1, peak:-6, pitch:38, seed:0x0f0505, role:'Hard 600 Hz–5 kHz piston/clamp accent, no acoustic snare model.', use:'Backbeat or displaced machinery accents; velocity 0.60–0.95.', method:'Band-limited noise clamp, inharmonic 337/829/1543/2711 Hz body, delayed contact burst and saturated envelope.'},
  {id:'low-boom', name:'LOW BOOM', seconds:2.4, channels:1, peak:-7, pitch:41, seed:0x0f0606, role:'41–95 Hz weight with 170–600 Hz pressure; rolled-off infrasonics.', use:'Phrase boundaries; allow 2.4 s tail; velocity 0.55–0.85.', method:'Slow falling low modes, saturated harmonics, low-passed pressure noise, 28 Hz high-pass.'},
  {id:'cinematic-impact', name:'CINEMATIC IMPACT', seconds:3.6, channels:2, peak:-6, pitch:49, seed:0x0f0707, role:'Broadband transient, 62 Hz mass, 400 Hz–6 kHz debris and spatial tail.', use:'Major edit points; leave space at onset; velocity 0.65–0.95.', method:'Layered body, seven metal modes, noise blast and deterministic asymmetric multitap reflections; dry low end remains centered.'},
  {id:'tension-riser', name:'TENSION RISER', seconds:4, channels:2, peak:-8, pitch:null, seed:0x0f0808, role:'Rising 220–1760 Hz pressure and opening 500 Hz–8 kHz air.', use:'Two bars at 120 BPM, ending exactly at the edit; velocity 0.55–0.90.', method:'Integrated exponential pitch sweep with restrained FM, accelerating amplitude modulation and moving noise cutoff; 8 ms endpoint fade.'},
  {id:'reverse-swell', name:'REVERSE SWELL', seconds:2, channels:2, peak:-8, pitch:null, seed:0x0f0909, role:'Mid/high suction with restrained 190 Hz support, complementary to bass impacts.', use:'One bar at 120 BPM; start 2 s before target; velocity 0.45–0.80.', method:'Reversed damped inharmonic metal and colored noise, stereo reflections before reversal; 6 ms endpoint taper.'},
  {id:'dark-drone', name:'DARK DRONE', seconds:8, channels:2, peak:-10, pitch:null, seed:0x0f0a0a, role:'110–900 Hz orbital machinery with restrained 2 kHz friction, not pure sub.', use:'Underlay at velocity 0.40–0.75; overlap every 7 s for longer beds; non-looping.', method:'Detuned harmonic and inharmonic oscillators, slow independent AM/FM, filtered turbulence and decorrelated reflections; 0.8/1.2 s fades.'},
  {id:'air-texture', name:'AIR / NOISE TEXTURE', seconds:8, channels:2, peak:-11, pitch:null, seed:0x0f0b0b, role:'Soft 900 Hz–7 kHz atmosphere and width, low end removed.', use:'Atmospheric bed at velocity 0.35–0.70; overlap every 7 s; non-looping.', method:'Independent seeded band-limited noise streams, slow multirate amplitude motion, faint upper resonances and 1/1.5 s fades.'},
  {id:'alarm-energy-pulse', name:'ALARM / ENERGY PULSE', seconds:0.8, channels:1, peak:-8, pitch:null, seed:0x0f0c0c, role:'D4/A-flat4 tension with 1–3 kHz motor harmonics; no laser sweep.', use:'Three-part motif at 120 BPM; repeat every 1–2 s; velocity 0.45–0.85.', method:'Three unequal 250 ms-spaced amplitude gates, fixed tritone carriers, low-index FM and filtered mechanical noise.'},
] as const;

function noise(length: number, seed: number): Wave {
  let state = seed;
  return Float64Array.from({length}, () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 2147483648 - 1;
  });
}
// Offline one-pole filters, cascaded as needed. Cutoffs are deliberately below Nyquist.
function lowpass(input: Wave, hz: number): Wave {
  const a = 1 - Math.exp(-TAU * hz / RATE); let y = 0;
  return input.map(x => (y += a * (x - y)));
}
function highpass(input: Wave, hz: number): Wave {
  const low = lowpass(input, hz); return input.map((x,i) => x - low[i]!);
}
function band(input: Wave, low: number, high: number): Wave {
  return lowpass(lowpass(highpass(highpass(input, low), low), high), high);
}
function modes(t: number, base: number, decay: number): number {
  return [1,2.731,4.113,5.827,8.219,10.631,13.127].reduce((sum,r,k) =>
    sum + sin(base*r*t + 0.035*sin((1.3+k*0.37)*t)) * exp(t,decay/(1+k*0.38)) * (k===0?0.30:1/(1+k*0.45)), 0);
}
function reflections(dry: Wave, side: number, amount: number): Wave {
  const taps = side === 0 ? [0.023,0.061,0.113,0.197,0.307] : [0.031,0.079,0.137,0.229,0.349];
  const diffuse = lowpass(highpass(dry,350),5200);
  return dry.map((x,i) => x + taps.reduce((s,t,k) => s + (diffuse[i-Math.round(t*RATE)]??0)*amount/(k+1),0));
}

export function synthesize(index: number): Buffer {
  const spec = sounds[index]!;
  const frames = Math.round(spec.seconds * RATE), raw = noise(frames,spec.seed);
  const contact = band(raw,1600,7800), grit = band(raw,430,4800), pressure = lowpass(raw,500);
  const waves: Wave[] = [];
  for (let c=0;c<spec.channels;c++) {
    const air = band(noise(frames,spec.seed + c*0x10001 + 17),900,6500);
    let moving = 0;
    let wave: Wave = Float64Array.from({length:frames},(_,i) => {
      const t=i/RATE, u=t/spec.seconds;
      switch (spec.id) {
        case 'sub-pulse': return attack(t)*exp(t,0.066)*(0.8*sin(49*t+0.26*(1-exp(t,0.008)))+0.18*sin(98*t)+0.07*sin(147*t)) + 0.10*grit[i]!*exp(t,0.006)*attack(t,0.0003);
        case 'mechanical-kick': {
          const phase=68*t+95*0.019*(1-exp(t,0.019));
          return attack(t,0.0006)*(Math.tanh(1.5*sin(phase))*exp(t,0.072)+0.17*sin(731*t)*exp(t,0.027)+0.10*sin(1837*t)*exp(t,0.009)+0.25*contact[i]!*exp(t,0.013));
        }
        case 'metallic-strike': return attack(t,0.00035)*(0.36*modes(t,437,0.38)+0.6*contact[i]!*exp(t,0.013)+0.10*grit[i]!*exp(t,0.16)*(0.5+0.5*sin(37*t)));
        case 'machine-tick': return attack(t,0.0002)*(0.7*contact[i]!*exp(t,0.005)+0.2*(sin(2711*t)+0.6*sin(4937*t)+0.3*sin(7151*t))*exp(t,0.009))+(t>0.007?0.23*contact[i]!*exp(t-0.007,0.003):0);
        case 'industrial-snare': return attack(t,0.0004)*Math.tanh(1.8*(0.9*grit[i]!*exp(t,0.046)+0.25*(sin(337*t)+0.7*sin(829*t)+0.45*sin(1543*t)+0.3*sin(2711*t))*exp(t,0.029)))+(t>0.019?0.2*contact[i]!*exp(t-0.019,0.026):0);
        case 'low-boom': return attack(t,0.006)*(0.60*Math.tanh(1.25*sin(41*t+17*0.12*(1-exp(t,0.12))))*exp(t,0.44)+0.18*sin(93.7*t)*exp(t,0.32)+0.22*pressure[i]!*exp(t,0.28)+0.08*sin(173*t)*exp(t,0.18));
        case 'cinematic-impact': return attack(t,0.0005)*(0.58*Math.tanh(1.5*sin(62*t+45*0.03*(1-exp(t,0.03))))*exp(t,0.23)+0.31*modes(t,293,0.69)+1.1*grit[i]!*exp(t,0.14)+0.36*contact[i]!*exp(t,0.021)+0.38*air[i]!*exp(t,0.75)*(0.65+0.35*sin(19*t)));
        case 'tension-riser': {
          const phase=220*4/Math.log(8)*(Math.pow(8,u)-1);
          const cutoff=500+7500*u*u, a=1-Math.exp(-TAU*cutoff/RATE);
          moving += a*(raw[i]!-moving);
          return Math.pow(u,1.5)*(0.26*sin(phase+0.4*sin(phase*1.017))+0.8*(moving-pressure[i]!)+0.30*air[i]!)*(0.7+0.3*sin(2*t+2*t*t));
        }
        case 'reverse-swell': return attack(t,0.003)*(0.24*modes(t,389,0.4)+0.7*grit[i]!*exp(t,0.31)+0.08*sin(190*t)*exp(t,0.21));
        case 'dark-drone': return 0.21*sin(110*t+0.12*sin(0.17*t))* (0.8+0.2*sin(0.13*t)) + 0.19*sin(164.81*t+0.2*sin(0.21*t+c*0.1))+0.13*sin(221.1*t+0.3*sin(0.11*t))+0.09*sin(311.13*t+0.5*sin(0.09*t+c*0.07))+0.06*sin(659.25*t+0.8*sin(0.19*t)) + 0.07*grit[i]!*(0.6+0.4*sin(0.31*t));
        case 'air-texture': return air[i]!*(0.55+0.2*sin(0.19*t+c*0.17)+0.12*sin(0.43*t+c*0.31))+0.035*sin(1831*t+0.7*sin(0.27*t))*sin(0.23*t)**2;
        case 'alarm-energy-pulse': {
          let value=0;
          for(let k=0;k<3;k++) {
            const dt=t-k*0.25;
            if(dt>=0) {const f=k===1?415.305:293.665;value += (k===2?0.72:1)*attack(dt,0.004)*exp(dt,0.060)*(sin(f*dt+0.12*sin(f*2.003*dt))+0.24*sin(f*3*dt)+0.08*sin(f*7*dt)+0.12*grit[i]!);}
          }
          return value;
        }
      }
    });
    if(spec.channels===2 && spec.id!=='air-texture') wave=reflections(wave,c,spec.id==='dark-drone'?0.23:0.48);
    if(spec.id==='reverse-swell') wave.reverse();
    wave=highpass(wave, ['low-boom','sub-pulse'].includes(spec.id)?28:spec.id==='dark-drone'?85:spec.id==='air-texture'?750:spec.id==='reverse-swell'?160:35);
    if(spec.id==='dark-drone' || spec.id==='air-texture') {
      const fadeIn=spec.id==='dark-drone'?0.8:1, fadeOut=spec.id==='dark-drone'?1.2:1.5;
      wave=wave.map((x,i)=>x*Math.sin(Math.min(1,i/RATE/fadeIn)*Math.PI/2)**2*Math.sin(Math.min(1,(frames-1-i)/RATE/fadeOut)*Math.PI/2)**2);
    }
    // Every file starts/ends at zero, including edit-point swells. No implicit silent padding.
    const edge=spec.id==='tension-riser'?0.008:spec.id==='reverse-swell'?0.006:0.004;
    wave=wave.map((x,i)=>x*Math.min(1,i/12)*Math.min(1,(frames-1-i)/(RATE*edge)));
    waves.push(wave);
  }
  let peak=0; for(const w of waves)for(const x of w) {if(!Number.isFinite(x))throw new Error('Non-finite synthesis');peak=Math.max(peak,Math.abs(x));}
  const gain=Math.pow(10,spec.peak/20)/peak;
  const bytes=Buffer.alloc(44+frames*spec.channels*2);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(spec.channels,22);
  bytes.writeUInt32LE(RATE,24);bytes.writeUInt32LE(RATE*spec.channels*2,28);bytes.writeUInt16LE(spec.channels*2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);
  for(let i=0;i<frames;i++)for(let c=0;c<spec.channels;c++)bytes.writeInt16LE(Math.round(waves[c]![i]!*gain*32767),44+(i*spec.channels+c)*2);
  return bytes;
}

export function generatePack(output='examples'): void {
  const directory=join(output,'assets/orbital-foundry');mkdirSync(directory,{recursive:true});
  const entries=sounds.map((sound,i)=>{
    const bytes=synthesize(i),file=`${String(i+1).padStart(2,'0')}-${sound.id}.wav`;
    writeFileSync(join(directory,file),bytes);
    return {...sound,file:`assets/orbital-foundry/${file}`,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
  });
  writeFileSync(join(directory,'kit.json'),JSON.stringify({formatVersion:1,samples:entries.filter(s=>s.pitch!==null).map(s=>({name:s.id,pitch:s.pitch,file:s.file.split('/').at(-1)}))},null,2)+'\n');
  // Metadata lives outside assets/: discovery correctly treats every asset JSON as a kit.
  writeFileSync(join(output,'orbital-foundry.catalog.json'),JSON.stringify({pack:'ORBITAL FOUNDRY',version:1,sampleRate:RATE,bitsPerSample:16,provenance:'All assets are generated in this repository. No third-party sample material is incorporated.',license:'CC0-1.0',generator:'scripts/generate-orbital-foundry.ts',sounds:entries},null,2)+'\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)generatePack(process.argv[2]);

// The whole landing page. Rendered to static HTML at build time (src/prerender.tsx);
// no React runs in the browser. Every number on this page is taken from the repository:
// README.md, CHANGELOG.md, docs/, examples/, reports/shoot-the-moon/REPORT.md,
// and the owner-supplied IGNITION 002 showcase brief.
import type {ReactNode} from 'react';
import {config} from './config.ts';
import type {Outbound} from './links.ts';
import {contact, github, ignitionVideo, portfolio, repo, requestPack, status, support} from './site.ts';
import {ACTS, ActRuler, ghostCounts, ghostSourceSeconds, IrisDefs, LoopLayers, PitchTrace, Registration, SyncMap, Wave, type SoundId} from './visuals.tsx';

export type PageProps = {
  /** True when the GLASS//FIRE web cut exists in public/media at build time. */
  promoAvailable: boolean;
};

const Ext = ({href, children, className, track}: {href: string; children: ReactNode; className?: string; track?: string}) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={className} data-outbound={track}>
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

const Arrow = () => (
  <span className="arrow" aria-hidden="true">
    ↗
  </span>
);

const SectionHead = ({index, label, id}: {index: string; label: string; id?: string}) => (
  <p className="kicker" id={id}>
    <span className="kicker__index">{index}</span>
    <span className="kicker__rule" aria-hidden="true" />
    <span>{label}</span>
  </p>
);

/** A configured outbound button, or an intentional pending state when the URL is empty. */
const ConfigButton = ({link, label, pending, track}: {link: Outbound | null; label: string; pending: string; track: string}) =>
  link ? (
    <a className="btn btn--primary" href={link.href} target={link.target} rel={link.rel} data-outbound={track}>
      {label}
      {link.target ? (
        <>
          <Arrow />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      ) : null}
    </a>
  ) : (
    <span className="btn btn--pending" role="link" aria-disabled="true" data-pending={track}>
      {label}
      <span className="btn__note">{pending}</span>
    </span>
  );

// ——————————————————————————————————————————————————————————————— header

const Header = () => (
  <header className="top" role="banner">
    <div className="top__inner wrap">
      <a className="wordmark" href="#top" aria-label="DaemonV12, back to top">
        DAEMONV12
      </a>
      <nav className="top__nav" aria-label="Sections">
        <a href="#proof">Proof</a>
        <a href="#how">How it works</a>
        <a href="#contact">Work with Sergio</a>
      </nav>
      <span className="top__status">{status}</span>
      <Ext href={config.repoUrl} className="top__gh" track="github">
        GitHub
        <Arrow />
      </Ext>
    </div>
  </header>
);

// ——————————————————————————————————————————————————————————————— hero + film

const PromoFrame = ({available}: {available: boolean}) => {
  const {video, poster, width, height} = config.promo;
  return (
    <figure className="film" id="glass-fire" aria-labelledby="film-caption" tabIndex={-1}>
      <div className="film__frame" style={{aspectRatio: `${width} / ${height}`}}>
        <Registration />
        {available ? (
          <>
            <video
              className="film__video"
              data-promo
              controls
              muted
              loop
              playsInline
              preload="none"
              poster={poster}
              width={width}
              height={height}
              aria-describedby="film-caption"
            >
              <source src={video} type="video/mp4" />
              <p className="film__fallback">
                Your browser can’t play this video. <a href={video}>Download GLASS//FIRE (MP4)</a>.
              </p>
            </video>
            <button className="film__play" type="button" data-promo-play hidden>
              <span className="film__play-icon" aria-hidden="true" />
              <span>Play GLASS//FIRE</span>
            </button>
          </>
        ) : (
          <div className="film__pending">
            <Wave sound="glass-hit" tone="iris" width={480} height={120} className="film__wave" />
            <p className="film__pending-title">GLASS//FIRE</p>
            <p className="film__pending-note">
              The 24-second film lands here soon. Until then, <Ext href={repo('promo/glass-fire', 'tree')}>read how it’s built</Ext>.
            </p>
          </div>
        )}
      </div>
      <figcaption className="film__meta" id="film-caption">
        <span>
          <b>GLASS//FIRE</b> · 24.000 s · 160 BPM · 16 bars
        </span>
        <span>Music composed by an agent through DaemonV12 MCP · GLASSHOUSE</span>
        <span>Motion synced to the real stems · Remotion · 60 fps</span>
      </figcaption>
    </figure>
  );
};

const Hero = ({promoAvailable}: PageProps) => (
  <section className="hero" aria-labelledby="hero-title">
    <div className="wrap">
      <h1 className="hero__title" id="hero-title">
        <span className="hero__brand">DAEMONV12</span>
        <span className="hero__statement">
          <span>GIVE AGENTS</span>
          <span>INSTRUMENTS.</span>
        </span>
      </h1>
      <div className="hero__row">
        <p className="hero__lede">A headless music production engine built for agents.</p>
        <p className="hero__status">{status}</p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="#glass-fire" data-watch>
            Watch GLASS//FIRE
          </a>
          <a className="btn btn--ghost" href={github.href} target={github.target} rel={github.rel} data-outbound="github">
            View GitHub
            <Arrow />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      <p className="hero__paths">
        <a href="#ignition">Watch V12 Overdrive</a>
        <a href="#request">Request a custom pack</a>
        <a href="#contact">Work with Sergio <Arrow /></a>
      </p>
      <PromoFrame available={promoAvailable} />
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— synchronized motion

const Ignition = () => (
  <section className="section ignition" id="ignition" aria-labelledby="ignition-title">
    <div className="wrap">
      <SectionHead index="002" label="Ignition · Music for motion" />
      <div className="ignition__grid">
        <div>
          <h2 className="fund__title ignition__title" id="ignition-title">
            <span className="sr-only">IGNITION 002 — </span>V12 OVERDRIVE
          </h2>
          <p className="ignition__body">
            An original DaemonV12 soundtrack for a procedural V12 animation. A 15-second loop at 128 BPM shows a different use case:
            repeatable, exact-duration music for synchronized motion.
          </p>
          <div className="ignition__actions">
            <ConfigButton link={ignitionVideo} label="Watch on YouTube" pending="Video coming soon" track="ignition-video" />
            <a href="#contact">Discuss a project <Arrow /></a>
          </div>
        </div>
        <div>
          <ul className="case__stats ignition__stats" aria-label="V12 Overdrive specifications">
            <li>128 BPM</li>
            <li>15-second loop</li>
            <li>1080 × 1920</li>
            <li>60 fps · 900 frames</li>
          </ul>
          <dl className="facts ignition__credits">
            <div>
              <dt>DaemonV12 · soundtrack</dt>
              <dd>Composition and audio rendering for the original, exact-duration music loop.</dd>
            </div>
            <div>
              <dt>Remotion / Three.js · picture</dt>
              <dd>Remotion sequences and renders the video frames. Three.js supplies the procedural V12 scene and animation.</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— what it is

const WhatItIs = () => (
  <section className="section what" aria-labelledby="what-title">
    <div className="wrap">
      <SectionHead index="01" label="What it is" />
      <h2 className="statement" id="what-title">
        <span>Coding agents have code tools.</span>
        <span className="statement__dim">They should have instruments too.</span>
      </h2>
      <div className="what__grid">
        <p className="what__body">
          DaemonV12 is a headless composition and rendering engine exposed through MCP. Agents author structured music projects, arrange
          instruments and samples, apply production processing, render stems and analyze the result, without opening a DAW.
        </p>
        <dl className="facts">
          <div>
            <dt>Not a generator</dt>
            <dd>There is no model inside. The agent writes every note as data; DaemonV12 plays it exactly where it was written.</dd>
          </div>
          <div>
            <dt>Deterministic</dt>
            <dd>Same project, same tool versions, same bytes. Every render records input, asset, tool and output SHA-256 hashes.</dd>
          </div>
          <div>
            <dt>Safe tool surface</dt>
            <dd>Edits are validated, revision-checked transactions inside one workspace. Agents can’t run commands or choose output paths.</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— capabilities

const CAPS: {value: string; label: string; note: string}[] = [
  {value: '9', label: 'MCP tools', note: 'stdio server: create, patch, validate, render, analyze'},
  {value: '128', label: 'GM voices', note: 'General MIDI through FluidSynth and a SoundFont'},
  {value: '2', label: 'Original sound packs', note: 'generated in the repo, CC0-1.0'},
  {value: 'STEMS', label: 'WAV / MP3 / MIDI', note: 'sample-aligned per-track stems'},
  {value: 'GAIN/PAN', label: 'Automation', note: 'in musical or wall-clock time'},
  {value: 'FX', label: 'Processing', note: 'HPF · LPF · delay · compressor · reverb · saturation · VO ducking'},
  {value: 'EXACT', label: 'Timelines', note: 'output lengths in bars, musical time or seconds'},
  {value: 'SHA-256', label: 'Deterministic renders', note: 'a provenance manifest for every render'},
];

const Capabilities = () => (
  <section className="section caps" aria-labelledby="caps-title">
    <div className="wrap">
      <h2 className="sr-only" id="caps-title">
        Capabilities
      </h2>
      <ul className="caps__grid">
        {CAPS.map(c => (
          <li key={c.label} className="cap">
            <span className="cap__value">{c.value}</span>
            <span className="cap__label">{c.label}</span>
            <span className="cap__note">{c.note}</span>
          </li>
        ))}
          <li className="cap cap--new">
            <span className="cap__value">0.25–4×</span>
            <span className="cap__label">Sample performance</span>
            <span className="cap__note">per-note rate · glides · source offsets</span>
          </li>
          <li className="cap cap--new">
            <span className="cap__value">SLICE/GATE</span>
            <span className="cap__label">Sampler articulation</span>
            <span className="cap__note">attack / release · track-local choke groups</span>
          </li>
      </ul>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— proof

type Case = {index: string; title: string; kind: string; body: ReactNode; stats: string[]; figure: ReactNode; figureCaption: string; links: {href: string; label: string}[]};

const CASES: Case[] = [
  {
    index: 'A',
    title: 'Shoot the Moon',
    kind: 'Film score',
    body: (
      <>
        A 24-bar cinematic score composed by an agent through the MCP tools against a locked picture timeline: a sync map from the opening
        drone to the final chord, with one measured revision after a written critique.
      </>
    ),
    stats: ['57.600 s exact delivery', '100 BPM · 24 bars', '14 tracks / stems', 'Orbital Foundry + 4 GM voices', '−16.95 LUFS'],
    figure: <SyncMap />,
    figureCaption: '25 locked sync points across the reel',
    links: [
      {href: repo('reports/shoot-the-moon/REPORT.md'), label: 'Read the report'},
      {href: repo('examples/shoot-the-moon-locked-score.json'), label: 'Project JSON'},
    ],
  },
  {
    index: 'B',
    title: 'Shoot the Moon',
    kind: 'Adaptive game audio',
    body: (
      <>
        Built for a layered soundtrack where gameplay state decides what plays: every layer shares tempo, meter and an exact bar boundary,
        so the game can bring layers in and out without drift. The game does the switching; DaemonV12 renders layers that line up to the
        sample.
      </>
    ),
    stats: ['4 bars @ 100 BPM = 423,360 frames', 'tails cut at the boundary', 'aligned stems'],
    figure: <LoopLayers />,
    figureCaption: 'Layers locked to one boundary',
    links: [
      {href: repo('docs/V0_5_TIMELINE_DYNAMICS.md'), label: 'Timeline contract'},
      {href: repo('examples/v05-loop-demo.json'), label: 'Loop project'},
    ],
  },
  {
    index: 'C',
    title: 'GLASS//FIRE',
    kind: 'Electronic showcase',
    body: (
      <>
        A 24-second electronic piece composed by an agent through DaemonV12 using the GLASSHOUSE sound pack, then synchronized to motion
        graphics from the real stems and onsets. Authored, edited, validated, rendered and analyzed solely through MCP.
      </>
    ),
    stats: ['24.000 s · 160 BPM · C# minor', 'all 10 GLASSHOUSE sounds', '15 stems', 'Remotion · 60 fps'],
    figure: <ActRuler />,
    figureCaption: ACTS.map(a => a.id.replace(' ', '\u00a0')).join(' · '),
    links: [
      {href: repo('examples/glass-fire.json'), label: 'Project JSON'},
      {href: repo('promo/glass-fire', 'tree'), label: 'Motion system'},
    ],
  },
];

const Proof = () => (
  <section className="section proof" id="proof" aria-labelledby="proof-title">
    <div className="wrap">
      <SectionHead index="02" label="Built by using it" />
      <h2 className="statement" id="proof-title">
        <span>Not designed</span>
        <span className="statement__dim">in isolation.</span>
      </h2>
      <p className="section__lede">Each release came out of a real piece of music that needed it.</p>
      <ol className="cases">
        {CASES.map(c => (
          <li key={c.index} className="case">
            <div className="case__head">
              <span className="case__index" aria-hidden="true">
                {c.index}
              </span>
              <h3 className="case__title">
                {c.title}
                <span className="case__kind">{c.kind}</span>
              </h3>
            </div>
            <div className="case__body">
              <p>{c.body}</p>
              <ul className="case__stats">
                {c.stats.map(s => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="case__links">
                {c.links.map(l => (
                  <Ext key={l.href} href={l.href}>
                    {l.label}
                    <Arrow />
                  </Ext>
                ))}
              </p>
            </div>
            <figure className="case__fig">
              {c.figure}
              <figcaption>{c.figureCaption}</figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— sampler controls

const SamplePerformance = () => (
  <section className="section perf" id="sample-performance" aria-labelledby="perf-title">
    <div className="wrap">
      <SectionHead index="03" label="V0.7 · Sampler articulation" />
      <div className="perf__head">
        <h2 className="statement" id="perf-title">
          <span>One sample.</span>
          <span className="statement__dim">Performed.</span>
        </h2>
      </div>
      <p className="section__lede">
        V0.7 adds source slices, musical gates, attack/release envelopes and track-local choke groups to sampler and drum-kit notes.
        Shape a voice and leave space between hits, using the original WAV.
      </p>
      <ul className="perf__fields perf__fields--articulation">
        <li><b>Source slices</b><span>Select a region with source offsets and endpoints, without creating another asset.</span></li>
        <li><b>Musical gates</b><span>Request release in note fractions, independently of playback speed.</span></li>
        <li><b>Attack/release envelopes</b><span>Shape each voice with amplitude ramps measured in output seconds.</span></li>
        <li><b>Track-local choke groups</b><span>New grouped hits release older voices on the same track. Simultaneous hits coexist.</span></li>
      </ul>
      <p className="case__links">
        <Ext href={repo('docs/V0_7_SAMPLER_ARTICULATION.md')}>V0.7 articulation contract <Arrow /></Ext>
        <Ext href={repo('examples/one-sound-after.json')}>ONE SOUND project <Arrow /></Ext>
      </p>
      <p className="perf__foot">Try the before/after comparison: <code>npm run demo:one-sound</code>.</p>
      <p className="perf__foot">Alongside the sample-performance controls introduced in V0.6:</p>
      <ul className="perf__fields">
        <li>
          <code>playbackRate</code>
          <span>Per-note rate, 0.25–4×. Two octaves either way.</span>
        </li>
        <li>
          <code>glide</code>
          <span>Linear rate moves from the onset: bends, spin-ups, dives, tape stops.</span>
        </li>
        <li>
          <code>offsetSeconds</code>
          <span>Start reading inside the source, to the nearest frame.</span>
        </li>
      </ul>
      <p className="perf__truth">
        <b>Rate changes pitch and length together</b>, like tape or a turntable. It is not time-stretching.
      </p>

      <figure className="perf__fig">
        <div className="perf__source">
          <span className="perf__label">Source · GLASSHOUSE ghost-vox · {ghostSourceSeconds.toFixed(2)} s · C#4</span>
          <Wave sound="ghost-vox" tone="iris" width={320} height={48} />
        </div>
        <div className="perf__trace">
          <span className="perf__axis perf__axis--top" aria-hidden="true">
            +24 st
          </span>
          <span className="perf__axis perf__axis--mid" aria-hidden="true">
            C#4
          </span>
          <span className="perf__axis perf__axis--low" aria-hidden="true">
            −24 st
          </span>
          <PitchTrace />
        </div>
        <figcaption>
          <span>
            <b>GHOST//SHIFT</b>: the pitch of every ghost-vox voice over the 12-second demo, drawn from <code>examples/ghost-shift.json</code>.
          </span>
          <span className="perf__legend">
            <span className="lg lg--hook">hook</span>
            <span className="lg lg--high">octave up</span>
            <span className="lg lg--fx">risers · tape stop</span>
            <span className="lg lg--bass">bass dives</span>
          </span>
        </figcaption>
      </figure>

      <ul className="perf__stats">
        <li>
          <b>{ghostCounts.rates}</b> playback rates
        </li>
        <li>
          <b>{ghostCounts.offsets}</b> source offsets
        </li>
        <li>
          <b>{ghostCounts.glidesUp}</b> upward · <b>{ghostCounts.glidesDown}</b> downward glides
        </li>
        <li>
          <b>1</b> source WAV
        </li>
      </ul>
      <p className="perf__foot">
        GHOST//SHIFT demonstrates the V0.6 rate, glide and offset controls. Each performed trigger records them and its voice length in
        the render manifest. V0.7 adds articulation provenance through the same nine MCP tools. Existing projects without articulation
        keep their historical audio bytes with the same pinned toolchain. Try it: <code>npm run demo:ghost-shift</code>.
      </p>
      <p className="case__links">
        <Ext href={repo('docs/V0_6_SAMPLE_PERFORMANCE.md')}>
          Sample performance contract
          <Arrow />
        </Ext>
        <Ext href={repo('examples/ghost-shift.json')}>
          GHOST//SHIFT project
          <Arrow />
        </Ext>
      </p>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— packs

type Pack = {name: string; tag: string; body: string; meta: string[]; tone: 'iris' | 'steel'; sounds: {id: SoundId; label: string}[]; href: string};

const PACKS: Pack[] = [
  {
    name: 'Orbital Foundry',
    tag: 'Industrial · mechanical · cinematic',
    body: 'Twelve sounds, from sub pulse, mechanical kick and metallic strike to low boom, cinematic impact, tension riser, dark drone and alarm energy.',
    meta: ['12 sounds', '7-hit kit', 'CC0-1.0'],
    tone: 'steel',
    sounds: [
      {id: 'mechanical-kick', label: 'Mechanical kick'},
      {id: 'cinematic-impact', label: 'Cinematic impact'},
      {id: 'tension-riser', label: 'Tension riser'},
      {id: 'dark-drone', label: 'Dark drone'},
    ],
    href: repo('examples/assets/orbital-foundry', 'tree'),
  },
  {
    name: 'GLASSHOUSE',
    tag: 'Glass · synthetic voice · low end · percussion',
    body: 'One glass identity and one vocal identity: glass hit, reverse, crush and prism impact; ghost vox and vox chip; a phase-locked punch/sub pair; clap and hat.',
    meta: ['10 sounds', 'tuned to C#', '7-hit kit', 'CC0-1.0'],
    tone: 'iris',
    sounds: [
      {id: 'glass-hit', label: 'Glass hit'},
      {id: 'glass-reverse', label: 'Glass reverse'},
      {id: 'ghost-vox', label: 'Ghost vox'},
      {id: 'prism-impact', label: 'Prism impact'},
    ],
    href: repo('examples/assets/glasshouse', 'tree'),
  },
];

const Packs = () => (
  <section className="section packs" aria-labelledby="packs-title">
    <div className="wrap">
      <SectionHead index="04" label="Sound packs" />
      <h2 className="statement statement--sm" id="packs-title">
        <span>Original sounds,</span>
        <span className="statement__dim">made for agents to read.</span>
      </h2>
      <p className="section__lede">
        Generated in the repository and dedicated to the public domain, each with a machine-readable catalog of roles, tuning and suggested
        use. The outlines below are drawn from the actual WAVs.
      </p>
      <ul className="packs__list">
        {PACKS.map(p => (
          <li key={p.name} className={`pack pack--${p.tone}`}>
            <div className="pack__id">
              <h3 className="pack__name">{p.name}</h3>
              <p className="pack__tag">{p.tag}</p>
              <p className="pack__body">{p.body}</p>
              <p className="pack__meta">
                {p.meta.map(m => (
                  <span key={m}>{m}</span>
                ))}
              </p>
              <Ext href={p.href} className="pack__link">
                Browse the pack
                <Arrow />
              </Ext>
            </div>
            <ul className="pack__sounds">
              {p.sounds.map(s => (
                <li key={s.id}>
                  <Wave sound={s.id} tone={p.tone} width={240} height={56} />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— how it works

const STEPS: {verb: string; body: string; tools: string[]}[] = [
  {verb: 'Connect', body: 'Register the stdio server with one workspace root.', tools: ['instruments_list', 'drumkits_list']},
  {verb: 'Compose', body: 'Create a project; add tracks, patterns and clips in validated, revision-checked batches.', tools: ['project_create', 'project_patch', 'project_read']},
  {verb: 'Process', body: 'Gain, pan and automation; filters, delay, compression, reverb, saturation, ducking.', tools: ['project_patch', 'project_validate']},
  {verb: 'Render', body: 'WAV, MP3, MIDI, aligned stems and a provenance manifest. Offline, no audio device.', tools: ['render']},
  {verb: 'Analyze', body: 'Peak, RMS, integrated LUFS, loudness range, true peak, clipping. Hashes on request.', tools: ['analyze', 'render_info']},
];

const TOOLS = ['project_create', 'project_read', 'project_validate', 'project_patch', 'instruments_list', 'drumkits_list', 'render', 'analyze', 'render_info'];

const How = () => (
  <section className="section how" id="how" aria-labelledby="how-title">
    <div className="wrap">
      <SectionHead index="05" label="How it works" />
      <h2 className="sr-only" id="how-title">
        How it works
      </h2>
      <ol className="flow">
        {STEPS.map((s, i) => (
          <li key={s.verb} className="flow__step">
            <span className="flow__n" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="flow__verb">{s.verb}</h3>
            <p className="flow__body">{s.body}</p>
            <p className="flow__tools">
              {s.tools.map(t => (
                <code key={t}>{t}</code>
              ))}
            </p>
          </li>
        ))}
      </ol>
      <div className="tools">
        <p className="tools__title">
          <b>9 MCP tools</b> · stdio · one operator, one workspace
        </p>
        <ul className="tools__list">
          {TOOLS.map(t => (
            <li key={t}>
              <code>daemonv12_{t}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— agent example

const PROJECT_JSON = `{
  "title": "Foundry Cue",
  "bpm": 100, "bars": 16,
  "key": "D minor",
  "tracks": [{
    "id": "rhythm",
    "instrument": {
      "type": "drumkit",
      "kit": "assets/orbital-foundry/kit.json"
    }
  }, {
    "id": "drone",
    "instrument": {
      "type": "sampler",
      "sample": "assets/orbital-foundry/10-dark-drone.wav"
    }
  }, …]
}`;

const RENDER_FILES = ['foundry-cue.wav', 'foundry-cue.mp3', 'foundry-cue.mid', 'foundry-cue.render.json', 'foundry-cue.stems/'];

const STEM_LANES: {id: string; sound: SoundId; at: number; len: number}[] = [
  {id: 'rhythm', sound: 'mechanical-kick', at: 0.25, len: 0.75},
  {id: 'drone', sound: 'dark-drone', at: 0, len: 1},
  {id: 'riser', sound: 'tension-riser', at: 0.5, len: 0.25},
  {id: 'impact', sound: 'cinematic-impact', at: 0.75, len: 0.25},
];

const Example = () => (
  <section className="section example" aria-labelledby="example-title">
    <div className="wrap">
      <SectionHead index="06" label="One prompt" />
      <h2 className="sr-only" id="example-title">
        An agent example
      </h2>
      <blockquote className="prompt">
        <p>
          Create a 16-bar industrial cue at 100 BPM using Orbital Foundry. Render WAV, MP3 and stems, then analyze it.
        </p>
      </blockquote>
      <ol className="pipeline">
        <li className="pipe">
          <p className="pipe__label">
            <span>01</span> Project
          </p>
          <pre className="pipe__code" tabIndex={0} aria-label="Excerpt of the project JSON the agent builds">
            <code>{PROJECT_JSON}</code>
          </pre>
        </li>
        <li className="pipe">
          <p className="pipe__label">
            <span>02</span> Render
          </p>
          <ul className="pipe__files">
            <li className="pipe__dir">.daemonv12-renders/render-…/</li>
            {RENDER_FILES.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="pipe__note">Paths come back to the agent; audio bytes never go through MCP.</p>
        </li>
        <li className="pipe">
          <p className="pipe__label">
            <span>03</span> Stems
          </p>
          <ul className="pipe__stems">
            {STEM_LANES.map(l => (
              <li key={l.id}>
                <span className="pipe__stem-id">{l.id}.wav</span>
                <span className="pipe__lane">
                  <span className="pipe__clip" style={{left: `${l.at * 100}%`, width: `${l.len * 100}%`}}>
                    <Wave sound={l.sound} tone="ink" width={200} height={28} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="pipe__note">Sample-aligned with the master. Then: duration, integrated LUFS and true peak.</p>
        </li>
      </ol>
      <p className="example__foot">
        From the README: a scripted run of the six tool calls behind a prompt like this produced a 38.4-second cue with WAV, MP3, four stems
        and analysis in 12 seconds. The JSON is an excerpt; the lanes show real Orbital Foundry outlines.
      </p>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— try it

const INSTALL = `git clone https://github.com/mataindustries/daemonv12.git
cd daemonv12
npm ci
npm run demo:share     # renders the best demo your machine supports

node bin/daemonv12.js init ~/daemonv12-music
claude mcp add --transport stdio daemonv12 -- \\
  "$(command -v node)" "$PWD/bin/daemonv12-mcp.js" \\
  --root ~/daemonv12-music`;

const Try = () => (
  <section className="section try" id="try" aria-labelledby="try-title">
    <div className="wrap try__grid">
      <div>
        <SectionHead index="07" label="Try it" />
        <h2 className="statement statement--sm" id="try-title">
          <span>Clone it.</span>
          <span className="statement__dim">Hand it to your agent.</span>
        </h2>
        <p className="section__lede">
          {status}. Runs from a GitHub clone today; it is not published to npm yet. Needs Node 22.18 or newer.
        </p>
        <ul className="try__notes">
          <li>Sample and drum-kit projects need only Node.</li>
          <li>General MIDI voices need FluidSynth and a GM SoundFont.</li>
          <li>MP3, effects and analysis need FFmpeg.</li>
          <li>
            Codex CLI and other MCP clients: <Ext href={repo('docs/MCP_CLIENTS.md')}>MCP client guide</Ext>.
          </li>
        </ul>
        <a className="btn btn--primary" href={github.href} target={github.target} rel={github.rel} data-outbound="github">
          View GitHub
          <Arrow />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <div className="terminal">
        <p className="terminal__bar">
          <span>shell</span>
          <span>from README.md</span>
        </p>
        <pre tabIndex={0} aria-label="Install and connect commands">
          <code>{INSTALL}</code>
        </pre>
      </div>
    </div>
  </section>
);

const Contact = () => (
  <section className="section contact" id="contact" aria-labelledby="contact-title">
    <div className="wrap contact__grid">
      <div>
        <SectionHead index="10" label="Paid creative work" />
        <h2 className="fund__title" id="contact-title">Build something with Sergio.</h2>
        <p className="contact__body">
          Creative coding, audio tooling and interactive prototypes. Send Sergio the idea, constraints and intended use to discuss a paid
          project. Scope and pricing are agreed together.
        </p>
        <div className="ignition__actions">
          <ConfigButton link={contact} label="Contact Sergio" pending="Contact coming soon" track="contact" />
        </div>
      </div>
      <div className="contact__portfolio">
        <h3 className="case__kind">ENM Ventures portfolio</h3>
        <p>Explore Sergio’s work across creative tools, games and interactive products.</p>
        <ConfigButton link={portfolio} label="Explore the portfolio" pending="Portfolio coming soon" track="portfolio" />
      </div>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— support + request

const Fund = () => (
  <section className="section fund" aria-label="Support and custom sound packs">
    <div className="wrap fund__grid">
      <div className="fund__col" id="support">
        <SectionHead index="08" label="Support DaemonV12" />
        <h2 className="fund__title">Fund the next instrument.</h2>
        <p>
          DaemonV12 is being built independently. If the project is useful to you, you can help fund new instruments, sound packs and agent
          workflows.
        </p>
        <ConfigButton link={support} label="Support development" pending="Opening soon" track="support" />
      </div>
      <div className="fund__col" id="request">
        <SectionHead index="09" label="Request a sound pack" />
        <h2 className="fund__title">Need a sound DaemonV12 doesn’t have?</h2>
        <p>
          Game, film, product, weird machine, brand identity: send the target sound and constraints. Strong ideas may become custom or public
          DaemonV12 packs. Scope first; pricing follows once it’s understood.
        </p>
        <ConfigButton link={requestPack} label="Request a pack" pending="Requests open soon" track="request-pack" />
      </div>
    </div>
  </section>
);

// ——————————————————————————————————————————————————————————————— footer

const Footer = () => (
  <footer className="foot" role="contentinfo">
    <div className="wrap foot__inner">
      <p className="foot__mark">DAEMONV12</p>
      <p className="foot__line">Give agents instruments.</p>
      <ul className="foot__links">
        <li>
          <Ext href={config.repoUrl} track="github">GitHub</Ext>
        </li>
        <li>
          <Ext href={repo('README.md')}>README</Ext>
        </li>
        <li>
          <Ext href={repo('CHANGELOG.md')}>Changelog</Ext>
        </li>
        <li>
          <Ext href={repo('docs/ROADMAP.md')}>Roadmap</Ext>
        </li>
      </ul>
      <p className="foot__fine">
        {status}. Code license not yet chosen; Orbital Foundry and GLASSHOUSE are CC0-1.0. Headless and local: there is no hosted service.
      </p>
    </div>
  </footer>
);

export const Page = ({promoAvailable}: PageProps) => (
  <>
    <a className="skip" href="#main">
      Skip to content
    </a>
    <IrisDefs />
    <Header />
    <main id="main" tabIndex={-1}>
      <Hero promoAvailable={promoAvailable} />
      <Ignition />
      <WhatItIs />
      <Capabilities />
      <Proof />
      <SamplePerformance />
      <Packs />
      <How />
      <Example />
      <Try />
      <Fund />
      <Contact />
    </main>
    <Footer />
  </>
);

# ANGELES//2099 design bible

One universe, one evening, one car. Every rule below is enforced in code: the colours, the car,
the road, the city and the shots are read from [`specs/`](specs), and the motion is driven by the
music's own event map ([`sync/`](sync)). Change a spec and every frame changes with it.

## The thesis

**California evolved, not replaced.** The San Gabriel Mountains and the LA basin as they are, with
a civilisation that grew into them gracefully. Warm, desirable, lived-in. The audience should wish
it existed. We never show generic neon overload, random spiky towers, rain-soaked dystopia, text
screens, or distorted vehicles.

## Palette ([`specs/palette.json`](specs/palette.json))

| Role | Colour | Where |
|---|---|---|
| Candy burgundy | `#5A0F1F`, flash `#A3203C` | the car's body, under a clear coat |
| Candy chrome | `#E4E2EA` (slight violet bias) | bumpers, spears, wheels, struts |
| Warm gold | `#E2A84B` | pinstripe, hover-ring cores, tower crowns, guardrail reflectors |
| Sodium grid | `#FFB35A` | the LA street grid at night |
| Atmospheric violet | `#6B4AA8` haze, `#9C6BFF` hover field | distance, the hover glow |
| Sunset → night | `#FF8A4C` horizon → `#7A3458` afterglow → `#1B1532` zenith | the sky, keyframed through the piece |
| San Gabriel granite | `#8A7A6A`, shadow `#2E2630` | rock (violet-biased shadows, never grey) |

Rules: light is warm, shadow is violet. Emission colours are only hover violet, warm gold and
sodium; the one exception is the tail bar. No cyan, no green.

## The car: CRESTLINE ([`specs/vehicle.json`](specs/vehicle.json))

An original long, low 1960s hardtop silhouette (no real make or model) rebuilt in 2099 around an
electromagnetic hover conversion.

- **Proportions:** 5.55 m long, 2.0 m wide, beltline 0.86 m, roof 1.22 m, long hood and deck, a
  pillarless greenhouse set back on the body, subtle rear fins, the 60s side crease with a chrome
  spear and a gold pinstripe on the beltline.
- **Tiny wheels:** 0.22 m chrome wire wheels (24 spokes, gold hub, three-bar spinner). They spin but
  carry no weight: lowrider jewellery kept after the conversion.
- **Hover engineering, visible:** four rings (violet field, gold core) under the wheel positions,
  on chrome A-arm struts. A violet underglow keel lights the asphalt.
- **Expressive suspension:** the chassis bounces on every kick, rolls on every snare and clap,
  drops 0.13 m on the slam, and lifts its nose on the hydraulic hop. The rings pulse with every
  808 note. All of this comes from the cue sheet, never from hand-placed keys.

## The world ([`specs/world.json`](specs/world.json))

- **The road:** Angeles Crest character. Two 3.7 m lanes with a double yellow, cut into granite,
  a steel guardrail with gold reflectors on the drop side. It runs north-west along the flank,
  then a long left sweeper points it down a spur ridge straight at the basin (that is where the
  drop happens), then it turns back for the hero slide.
- **The basin:** the LA grid as a carpet of sodium light, breathing by district. Downtown is a
  cluster of slender octagonal megatowers with setbacks and gold crown halos, plus satellite
  clusters (Westside, Hollywood, Harbor), pearl blimps with gold bands, and flying traffic in lanes
  that follow the grid.
- **Declared exaggerations:** downtown sits 9 km from the road (really ~25 km) with towers of
  1.2–3.0 km. At true scale a 9:16 frame shows the skyline as a 3° sliver. Bearing, the sunset
  behind the city (azimuth 247°) and mountains-above-basin stay true.
- **Time:** one continuous evening. The sun moves from 4° (hook) through 0.5° (build) to −6°
  (outro), so the piece travels from golden hour to night. City lights rise with it.

## Camera language ([`specs/shots.json`](specs/shots.json))

High-end automotive commercial meets science-fiction scale. Cuts land on bar lines, from the
engine's event map; accents land on beats.

| Shot | Section | Move |
|---|---|---|
| S1 Ground-scraping reveal | hook (bars 1–2) | 24 mm at 18 cm off the asphalt on the front wheel and hover ring, dollying back along the flank |
| S2 Low tracking | pocket (3–4) | 20 mm front three-quarter from the opposite lane; 12° drift into the sweeper |
| S3 Orbit | build (5) | 150° orbit, rising, as the light goes |
| S4c Into the mouth (CREST) | transition (6) | push into the front intake as the beat is swallowed; black from the silence to the slam |
| S4h Spin-up (HOVER) | transition (5–6) | static low three-quarter; the car rises 0.6 m on its rings |
| S5 Crane reveal | drop (7–8) | on the slam, from bumper height behind the car up and back, zooming 24 → 70 mm; the road leads the eye to the skyline |
| S6 Hero slide | out (9–10) | 85 mm from up the slope: the car slides sideways, the city behind it |

Rules: the car is in frame at every shot's start, middle and end (validated). Cameras never
enter terrain and never look through a ridge (validated by a line-of-sight solver). One lens move
per shot.

## Beat sync ([`sync/`](sync))

`daemonv12 sync <project> --project --fps 24/1` exports every note's exact sample frame and 24 fps
picture frame. At 96 BPM a beat is exactly 15 frames and a bar exactly 60. `build_cues.py` turns
that into animation drivers, and confirms against the mastered audio that every kick's transient
sits on its engine frame: CREST 34/34 within 0.52 ms, HOVER 32/33 within 2 ms, the outlier 7.8 ms
under the slam's blast. A picture frame is 41.7 ms.

## Styleframes (GATE 02): honest review

Rendered by [`blender/angeles2099.py`](../blender/angeles2099.py) on CPU, 720×1280, 96 samples,
denoised. Each is a real frame of the planned animation, not a separate beauty setup.

| | What works | What does not yet |
|---|---|---|
| **SF1 Hero vehicle** (S2, frame 150) | The silhouette, greenhouse, chrome spear, tiny wire wheels inside gold-cored rings, violet pools on the double yellow | The backdrop: a front-lit granite cut that reads as a flat hazy wall with hard triangular shadows. The paint reads candy red under the orange key, not deep burgundy. Needs a rim-lit angle toward the sunset |
| **SF2 Angeles Crest** (S3, frame 285) | The strongest frame: rear three-quarter, tail bar, hover pads, the road sweeping along the guardrail to a distant skyline at sunset, a granite cliff | The skyline is small; the near terrain is plain; no flying traffic or blimps reads at this scale |
| **SF3 The megacity** (S5, frame 470) | The composition: the car on the spur road, the road leading to the megatowers with gold crown halos, the burgundy-violet afterglow behind them | The procedural 4 m window texture aliases into a pixelated pattern at 9 km, so the towers look blocky and pale. The grid and blimps don't read at this angle; the sky is a flat gradient |

What would most improve them, in order: rim-lit hero angles, modelled tower crowns and window
banding, a proper volumetric haze layer (cheap on a T4), and car-scale props (lamp posts,
reflector posts, road texture) for scale. None of it requires a new approach; it is all work in the
same generator.

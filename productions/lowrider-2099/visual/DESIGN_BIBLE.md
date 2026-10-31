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
| Candy burgundy | flake `#5A0F1F`→`#A3203C` under a `#4A0A18` tinted coat | the car's body |
| Candy chrome | `#E4E2EA` (slight violet bias) | bumpers, spears, wheels, struts |
| Warm gold | `#E2A84B` | pinstripe, hover-ring cores, tower crowns, guardrail reflectors |
| Sodium grid | `#FFB35A` | the LA street grid at night |
| Atmospheric violet | `#6B4AA8` haze, `#9C6BFF` hover field | distance, the hover glow |
| Sunset → night | `#FF8A4C` horizon → `#7A3458` afterglow → `#1B1532` zenith | the sky, keyframed through the piece |
| San Gabriel granite | `#8A7A6A`, shadow `#2E2630` | rock (violet-biased shadows, never grey) |

Rules: light is warm, shadow is violet. Emission colours are only hover violet, warm gold and
sodium; the one exception is the tail bar. No cyan, no green.

## The car: CRESTLINE ([`specs/vehicle.json`](specs/vehicle.json))

An original formal luxury hardtop in the 1960s–70s West Coast lowrider tradition (no real make or
model), rebuilt in 2099 around an electromagnetic hover conversion. **Revised in v2 after owner
review:** the first CRESTLINE was a rounded 60s coupe; this one is boxy, expensive and intimidating.

- **Silhouette:** 5.7 m long, 2.02 m wide, a flat hood at 0.82 m with a power dome, beltline 0.84 m,
  a squared trunk, long straight body lines with a sharp crease and chrome spear. A formal
  greenhouse set well back: upright windshield, flat roof at 1.29 m, a small backlight and a
  padded oxblood landau top with chrome S-bars.
- **Face and tail:** a wide rectangular egg-crate grille, quad lamps in chrome bezels, a gold hood
  crest, a massive bumper with guards. At the back: vertical red lamp bars at the corners and a
  centre bar.
- **Paint:** candy burgundy: a metallic flake base under a tinted clear coat, so highlights stay
  clean and the colour stays deep.
- **Tiny wheels, real lowrider wheels (v3):** a shrunken custom 13-inch wire wheel at 0.22 m overall
  radius: a chunky tyre with two tread grooves and a thin whitewall, a deep-dish polished rim with
  a proud lip, 100 cross-laced chrome spokes in four lacing groups converging on a recessed chrome
  hub with gold flanges, and a three-wing chrome knock-off with a gold centre. (The v2 wheel had no
  tyre and 24 thick spokes: it read as a bicycle wheel.) Jewellery, not support.
- **Hover conversion as engineering (v3):** each corner is a stacked maglev module 0.227 m in
  radius, from the road up: a black anodised emitter plate, an exposed gold toroidal coil pack, a
  chrome band, a brushed titanium dome with ten radial fins, and a chrome boss with a gold ring and
  six bolts. It hangs on chrome parallelogram trailing arms with gold pivot eyes, from a titanium
  bracket on a chrome cross-member. A gold-sprung hydraulic strut runs inboard to a titanium
  manifold on the centreline: the lowrider pump-and-coil look, rebuilt as maglev. A titanium
  outrigger and a chrome bearing carry the wheel, 11 cm clear of the module. With the lights off,
  it is still metal worth looking at.
- **Energy, kept subtle:** only a slim violet emitter ring under each plate (pulsing with the
  808), a small pool of light on the asphalt, and faint ripples running outward on the road that
  fade as the car lifts. No glowing rings in the air.
- **Lighting:** an automotive light rig travels with the car (a long overhead strip for the body-line
  highlight, a warm rim toward the sun, a violet kicker). Light linking keeps it on the car: it
  never floods the road.
- **Expressive suspension:** the body bounces on every kick, rolls on every snare and clap and
  leans out of the drifts, drops onto the modules on the slam, and lifts its nose on the hydraulic
  hop (pivoting on the rear axle). Each module holds 80 % of its ride height against its own
  corner's travel and stays level with the road, so the arms and struts visibly work. Travel is
  clamped by a bump stop under the floor and a 1 cm field gap above the road; the scene check
  verifies both on every frame. All of it comes from the cue sheet, never from hand-placed keys.

## The world ([`specs/world.json`](specs/world.json))

- **The road:** Angeles Crest character. Two 3.7 m lanes with a double yellow, cut into granite,
  a steel guardrail with gold reflectors on the drop side. It runs north-west along the flank,
  then a long left sweeper points it down a spur ridge straight at the basin (that is where the
  drop happens), then it turns back for the hero slide.
- **The basin:** the LA grid as a carpet of sodium light, breathing by district. Downtown is a
  cluster of octagonal megatowers (about 1:11) with three setbacks, a warm lantern, stacked gold
  crown halos, a spire and a beacon, plus satellite clusters (Westside, Hollywood, Harbor). Window
  bands are shaded for their size on screen, so at 9 km they average out instead of aliasing.
  Pearl blimps with gold bands sit at chosen positions in the frame, and two-way flying-traffic
  lanes at three altitudes slide with the music's tempo.
- **Depth:** far ridges, the Pacific, and an evening marine layer lit from below by the city.
- **Sky:** a three-stop California gradient with glow lobes around the real sun, a warm horizon band,
  and cirrus that is lit toward the sun and shaded away from it, keyframed from golden hour to night.
- **Terrain:** the near field is continuous by construction (see the v2 notes below); granite has
  jointed blocks, medium-scale relief, speckle and desert varnish.
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
| S1 Ground-scraping reveal | hook (bars 1–2) | 24 mm at 20 cm off the asphalt on the rear wheel and hover module, dollying out and tilting up to a backlit rear three-quarter under the sunset |
| S2 Low tracking | pocket (3–4) | 20 mm front three-quarter from the opposite lane; 12° drift into the sweeper |
| S3 Orbit | build (5) | 150° orbit, rising, as the light goes (CREST only: in HOVER, bar 5 belongs to S4h) |
| S4c Into the mouth (CREST) | transition (6) | push into the front intake as the beat is swallowed; black from the silence to the slam |
| S4h Spin-up (HOVER) | transition (5–6) | static low three-quarter; the car rises 0.6 m on its rings |
| S5 Crane reveal | drop (7–8) | on the slam, from bumper height behind the car up and back, zooming 24 → 70 mm; the road leads the eye to the skyline |
| S6 Hero slide | out (9–10) | 85 mm from up the slope: the car slides sideways, the city behind it |

Rules: the car is in frame at every shot's start, middle and end (validated). Cameras never
enter terrain and never look through a ridge (validated by a line-of-sight solver). One lens move
per shot.

## Motion: making the machine come alive

GATE 02 is approved and locked: CRESTLINE v3 at `0b8af67` and the CREST master. The scene check
enforces the lock ([`specs/locks.json`](specs/locks.json): the vehicle spec, every car-building
function and the master are hashed). Motion, light and cameras are what change now. Everything
below is driven by CREST's cue sheet; nothing is hand-keyed.

**The suspension.**
- *Body:* bounces on every kick, rolls on every snare and clap, drops on the slam with a damped
  overshoot.
- *Hop:* the hydraulic hop has anticipation (the nose dips for 8 frames first), snaps up about
  the rear axle, and lands nose-down with a bounce.
- *Drifts:* each one starts with a counter-flick the other way (4 deg in the pocket, 5 deg before
  the hero slide). The body lean follows late and overshoots.
- *Modules:* each module is its own damped spring (3.4 Hz, damping 0.3). It holds 80 % of its ride
  height against its own corner's travel, lags the body and overshoots, and stops dead on three
  limits: a bump stop 3 mm under the floor, a 1 cm field gap above the road, and the strut's
  12 cm stroke. On the hop the front hardware visibly hangs.

**The ground.**
- *Contact shadow:* a soft shadow under the body tightens and darkens when the body is low and
  spreads and fades as it rises.
- *Field footprints:* under each module, a pressure patch, thin violet ripples running outward,
  and a mirage-like shimmer (the road reflects the sky through the rippling field at grazing
  angles). All three grow as that module is pushed down.
- *Slam:* fires a shock ring that races outward. No particles, no fluids.

**Three tricks over expensive effects.**
1. *Blimp-shadow foreshadowing (bar 4, f180).* A patrol blimp we never see hangs 420 m out over
   the valley, on the line to the setting sun. Only its shadow exists for the camera: a long soft
   band the car drives through, which slides up the granite. The car's rim light dims as it
   passes. The blimps are revealed on the drop.
2. *Multiplane city depth.* Four flat haze cards stand across the view to the basin, at 2.6, 5.6,
   8.4 and 12.5 km. Each depth layer of the city sits behind one more step of haze, so the crane
   gives layered parallax. At night the cards take the city's rose glow.
3. *The Mouth Drop transition (bar 6, f300-383).* The camera is swallowed in a barrel roll, timed
   to the vocal tract:

   | Frames | Mouth | Camera | Light |
   |---|---|---|---|
   | 300-308 | "ah" (open, brightest) | snap push, roll begins | grille glow peaks |
   | 308-334 | "oh" -> "oo" (the mouth grows) | slower push, roll to 70 deg, lens 35 -> 30 mm | glow closes |
   | 334-345 | "mm" (lips seal) | fast push to 0.6 m, roll to 150 deg | the frame seals to black |
   | 345-359 | silence, then the reversed breath | drifting at 175 deg | a faint violet inhale |
   | 360-383 | the slam | S5 keeps rolling the same way, 175 -> 368 -> 360 deg | grille flash, shock rings |

**The loop.** Frame 599 is frame 0's camera:
- *Fly-in:* from f584 the 85 mm hero shot flies back over the shoulder into S1's first frame,
  car-relative, widening to 24 mm. The scene check measures the seam at 0.0 m and 0.0 deg.
- *Flash:* the hop lands into a warm flash (f592-599) that frame 0 comes out of (f0-6), on the
  lead's whoop. The flash covers the night -> golden-hour change.
- *Audio:* the master is locked and loops without a click, but its last 100 ms decays to
  -22 dBFS before the -9 dBFS downbeat: a breath, not a gap.

**Light.** The sun lamp now shines from the visible sunset (247 deg). Since v1 it had come from
203 deg, 44 deg off the glow in the sky. The low sun is stronger, so shadows read. Motion blur
(half-frame shutter) turns the spokes, the roll and the whip into blur instead of strobing.

## Beat sync ([`sync/`](sync))

`daemonv12 sync <project> --project --fps 24/1` exports every note's exact sample frame and 24 fps
picture frame. At 96 BPM a beat is exactly 15 frames and a bar exactly 60. `build_cues.py` turns
that into animation drivers, and confirms against the mastered audio that every kick's transient
sits on its engine frame: CREST 34/34 within 0.52 ms, HOVER 32/33 within 2 ms, the outlier 7.8 ms
under the slam's blast. A picture frame is 41.7 ms.

## Styleframes (GATE 02): honest review

Rendered by [`blender/angeles2099.py`](../blender/angeles2099.py) on CPU, 720×1280, 96 samples,
denoised. Each is a real frame of the planned animation (CREST timing, so v1 and v2 compare like
for like), not a separate beauty setup. Before/after:
[`review/styleframes/before-after.jpg`](../review/styleframes/before-after.jpg). The car on its own:
[`review/car/`](../review/car).

### v2

The v2 styleframes were rendered before the v3 wheels and hover modules (see
[`review/car/v3/`](../review/car/v3)). Re-rendering them with the v3 car takes about 15 CPU minutes
here and is the first step after GATE 02 is locked.

| | What changed | What still does not work |
|---|---|---|
| **SF1 Hero vehicle** (S1, frame 100) | The new boxy CRESTLINE, backlit rear three-quarter in the lower third under the sunset gradient, a granite ridge behind instead of the flat cut wall, red tail bar, violet field pools | The paint reads copper-red under the low warm sun, not deep burgundy; the car is small in the frame; the sky above is clean but empty |
| **SF2 Angeles Crest** (S3, frame 285) | The road winds past the guardrail to a skyline with crowned towers, blimps and traffic lanes; dark formal roof; the city glows below the ridge | Glass in the C-pillar mirrors the sky as a white vertical stripe; towers are stylised stacked drums, not architecture |
| **SF3 The megacity** (S5, frame 470) | Lit and shaded cirrus across the afterglow, gold crowns (no longer clipped to white), towers with mass, recognisable blimps, the road leading to the city | The basin grid is hidden from this low angle; the towers stand on a flat haze band; still clearly procedural |

**Found and fixed while rendering v2:**

- **Vertical fluted cliffs.** The terrain chose mountain side, valley side and the spur blend from the
  single nearest road segment, so heights jumped 15–60 m wherever that segment changed. They are
  now softmin-weighted fields over the whole road, continued past its ends. The steepest slope
  on a 5 m grid went from 138:1 to 6.8:1; the cut and fall profiles beside the road are unchanged.
- **Clipped emission.** Crown halos (7.0), blimp bands (6.0) and tail lamps (14.0) clipped to white
  under the +1.2-stop night exposure. They are now 1.6, 1.3 and 4.5, so they stay gold and red.
- **A floating rocker trim** that ran through the wheel arches like a side pipe now sits flush,
  between the arches.
- **A white roof.** A 700 W overhead strip mirrored in the flat roof; it is now 380 W and narrower,
  and the landau vinyl is matte.
- **A buried camera.** S4c ended 0.3 m from a grille bar; the validator now ray-casts every shot.

**Next, if approved:** close-up granite still reads as large cracked plates (the joint network is
too regular at car scale); the paint needs a cooler key in SF1; the towers would gain most from
modelled facade fins and a lit podium city at their feet. None of it needs a new approach.

### v1 (first GATE 02 submission)

| | What works | What does not yet |
|---|---|---|
| **SF1 Hero vehicle** (S2, frame 150) | The silhouette, greenhouse, chrome spear, tiny wire wheels inside gold-cored rings, violet pools on the double yellow | The backdrop: a front-lit granite cut that reads as a flat hazy wall with hard triangular shadows. The paint reads candy red under the orange key, not deep burgundy. Needs a rim-lit angle toward the sunset |
| **SF2 Angeles Crest** (S3, frame 285) | The strongest frame: rear three-quarter, tail bar, hover pads, the road sweeping along the guardrail to a distant skyline at sunset, a granite cliff | The skyline is small; the near terrain is plain; no flying traffic or blimps reads at this scale |
| **SF3 The megacity** (S5, frame 470) | The composition: the car on the spur road, the road leading to the megatowers with gold crown halos, the burgundy-violet afterglow behind them | The procedural 4 m window texture aliases into a pixelated pattern at 9 km, so the towers look blocky and pale. The grid and blimps don't read at this angle; the sky is a flat gradient |

What would most improve them, in order: rim-lit hero angles, modelled tower crowns and window
banding, a proper volumetric haze layer (cheap on a T4), and car-scale props (lamp posts,
reflector posts, road texture) for scale. None of it requires a new approach; it is all work in the
same generator.

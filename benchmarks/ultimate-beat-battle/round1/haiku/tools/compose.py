#!/usr/bin/env python3
"""Compose IDLE HYMN as a DaemonV12 project.

Deterministic: no randomness, no timestamps. Writes ../project.json.
Every pitch is written as a MIDI number and converted to a playbackRate from
that sample's native pitch, so the melodic intent stays readable here.

Native pitches used (estimated from the WAV files and documented in NOTES.md):
  tine-hook.wav  A4 = MIDI 69   (benchmark-local, generated)
  tine-bass.wav  A2 = MIDI 45   (benchmark-local, generated)
  07-sub-cs.wav  C#2 = MIDI 37  (GLASSHOUSE, shipped)
  10-dark-drone  A2 = MIDI 45   (Orbital Foundry 10-dark-drone.wav, shipped; energy at 110/165/220 Hz,
                                 the A1 autocorrelation estimate was a subharmonic)

Usage: python3 compose.py [--version vN]
"""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.normpath(os.path.join(HERE, '..'))

HOOK_BASE = 69
BASS_BASE = 45
SUB_BASE = 37
DRONE_BASE = 45


def rate(midi, base):
    return round(2 ** ((midi - base) / 12), 6)


def sampler_note(start, midi, vel, base, glide=None):
    note = {'start': start, 'velocity': vel}
    r = rate(midi, base)
    if r != 1:
        note['playbackRate'] = r
    if glide is not None:
        note['glide'] = glide
    return note


def drum_note(start, name, vel):
    return {'start': start, 'pitch': name, 'velocity': vel}


def pitched_pattern(pid, bars, notes, base, description=None):
    out = {'id': pid, 'bars': bars, 'notes': []}
    if description:
        out['description'] = description
    for n in notes:
        start, midi, vel = n[0], n[1], n[2]
        glide = n[3] if len(n) > 3 else None
        out['notes'].append(sampler_note(start, midi, vel, base, glide))
    return out


def grid16(i):
    """Sixteenth index 0..15 within a bar -> 'bar:beat(+frac)' local position."""
    beat = i // 4 + 1
    sub = i % 4
    frac = {0: '', 1: '+1/16', 2: '+1/8', 3: '+3/16'}[sub]
    return f'1:{beat}{frac}'


def hat_notes(velocity_for, name='machine-tick'):
    out = []
    for i in range(16):
        v = velocity_for(i)
        if v > 0:
            out.append(drum_note(grid16(i), name, v))
    return out


def groove_hats(i):
    return 0.65 if i % 2 == 0 else (0.32 if i % 4 == 3 else 0.18)


def fill_hats(i):
    # Bar 6 rolls the ticks up into the break: quiet at first, then a clear 16th ramp.
    if i < 12:
        return groove_hats(i)
    return {12: 0.30, 13: 0.40, 14: 0.55, 15: 0.72}[i]


def groove_notes(hats=groove_hats):
    notes = []
    for start, v in [('1:1', 0.95), ('1:2+3/16', 0.60), ('1:3', 0.80), ('1:4+1/8', 0.55)]:
        notes.append(drum_note(start, 'mechanical-kick', v))
    notes.append(drum_note('1:2', 'industrial-snare', 0.85))
    notes.append(drum_note('1:3+3/16', 'industrial-snare', 0.22))
    notes.append(drum_note('1:4', 'industrial-snare', 0.90))
    notes += hat_notes(hats)
    return notes


def build(version):
    # ---- hook: tine-hook.wav (A4 native). Melody written as MIDI numbers. ----
    hook_a = [
        ('1:1', 69, 0.95), ('1:2+3/16', 70, 0.50), ('1:3', 76, 0.90), ('1:4', 74, 0.70), ('1:4+3/16', 72, 0.65),
        ('2:1', 69, 0.90), ('2:1+3/16', 70, 0.50), ('2:2+1/8', 67, 0.70), ('2:3', 69, 0.85), ('2:4', 64, 0.80),
    ]
    hook_f = [
        ('1:1', 69, 0.95), ('1:2+3/16', 70, 0.50), ('1:3', 77, 0.90), ('1:4', 74, 0.70), ('1:4+3/16', 72, 0.65),
        ('2:1', 69, 0.90), ('2:1+3/16', 70, 0.50), ('2:2+1/8', 67, 0.70), ('2:3', 65, 0.85), ('2:4', 64, 0.80),
    ]
    hook_g = [
        ('1:1', 74, 0.90), ('1:2', 71, 0.60), ('1:2+3/16', 72, 0.55), ('1:3', 79, 0.90), ('1:4', 76, 0.70),
        ('2:1', 74, 0.85), ('2:1+1/8', 71, 0.60), ('2:2+1/8', 69, 0.70), ('2:3', 67, 0.85), ('2:3+3/16', 66, 0.60),
        ('2:4', 64, 0.80),
    ]
    payoff = [(s, m + 12, v) for s, m, v in hook_a if s.startswith('1:')] + \
             [(s, m + 12, v) for s, m, v in hook_f if s.startswith('2:')]
    tape = [('1:1', 69, 0.90, {'to': 0.25, 'duration': '1/2'})]

    hook_patterns = [
        pitched_pattern('hook-am', 2, hook_a, HOOK_BASE, 'Machine call over A minor: A4, Bb4 grace, E5 leap, falling answer.'),
        pitched_pattern('hook-f', 2, hook_f, HOOK_BASE, 'Same call over F: the leap lands on F5.'),
        pitched_pattern('hook-g', 2, hook_g, HOOK_BASE, 'Answer over G: the call rises to G5 and falls back to E4.'),
        pitched_pattern('hook-payoff', 2, payoff, HOOK_BASE, 'Octave-up payoff: bar 9 is the call, bar 10 the F answer.'),
        pitched_pattern('tape-stop', 1, tape, HOOK_BASE, 'The last tine tape-stops from A4 to a quarter speed.'),
    ]
    hook_track = {
        'id': 'tine-hook',
        'description': 'Metal tine hook from a benchmark-local generated sample (A4 native). Call, answer, octave payoff, tape stop.',
        'instrument': {'type': 'sampler', 'sample': 'assets/tine/tine-hook.wav'},
        'mix': {'gainDb': -1, 'pan': 0},
        'effects': [
            {'type': 'highpass', 'frequencyHz': 140},
            {'type': 'saturation', 'driveDb': 4, 'mix': 0.15},
            {'type': 'reverb', 'roomSize': 0.45, 'decaySeconds': 1.1, 'wet': 0.20},
        ],
        'automation': {
            # Dynamic arc: restrained intro, steady groove, louder octave payoff, then back down for the tape stop.
            'gainDb': [
                {'at': {'musical': '1:1'}, 'value': -2, 'transition': 'linear'},
                {'at': {'musical': '3:1'}, 'value': -1, 'transition': 'linear'},
                # +3.5 dB compensates for the octave-up copy: a 2x playback rate halves each note's length and average level.
                {'at': {'musical': '9:1'}, 'value': 3.5, 'transition': 'linear'},
                {'at': {'musical': '11:1'}, 'value': -1},
            ],
            'pan': [
                {'at': {'musical': '9:1'}, 'value': -0.45, 'transition': 'linear'},
                {'at': {'musical': '10:4'}, 'value': 0.45},
            ],
        },
        'clips': [
            {'bar': 1, 'pattern': 'hook-am'},
            {'bar': 3, 'pattern': 'hook-f'},
            {'bar': 5, 'pattern': 'hook-g'},
            {'bar': 9, 'pattern': 'hook-payoff'},
            {'bar': 11, 'pattern': 'tape-stop'},
        ],
        'patterns': hook_patterns,
    }

    # ---- bass: tine-bass.wav (A2 native), syncopated 1-bar cells ----
    bass_a = [('1:1', 45, 0.90), ('1:2+3/16', 45, 0.50), ('1:3', 48, 0.75), ('1:4+1/8', 40, 0.70)]
    bass_f = [('1:1', 41, 0.90), ('1:2+3/16', 41, 0.50), ('1:3', 45, 0.75), ('1:4+1/8', 36, 0.70)]
    bass_g = [('1:1', 43, 0.90), ('1:2+3/16', 43, 0.50), ('1:3', 47, 0.75), ('1:4+1/8', 38, 0.70)]
    # Bar 6 drops the last note so its ring does not muddy the break at bar 7.
    bass_g_end = [('1:1', 43, 0.90), ('1:2+3/16', 43, 0.50), ('1:3', 47, 0.75)]
    # Two-bar outro: the last sound is the tonic A2 on bar 12 beat 1.
    bass_out = [('1:1', 45, 0.80), ('1:3', 48, 0.50), ('2:1', 45, 0.85)]
    bass_track = {
        'id': 'tine-bass',
        'description': 'Low tine cell in the same metal family as the hook (A2 native). Roots A, F, G with syncopated return notes.',
        'instrument': {'type': 'sampler', 'sample': 'assets/tine/tine-bass.wav'},
        'mix': {'gainDb': -3, 'pan': 0},
        'effects': [
            {'type': 'highpass', 'frequencyHz': 35},
            {'type': 'compressor', 'thresholdDb': -18, 'ratio': 3, 'attackMs': 6, 'releaseMs': 90, 'makeupGainDb': 1},
        ],
        'clips': [
            {'bar': 2, 'pattern': 'bass-am'},
            {'bar': 3, 'pattern': 'bass-f'},
            {'bar': 4, 'pattern': 'bass-f'},
            {'bar': 5, 'pattern': 'bass-g'},
            {'bar': 6, 'pattern': 'bass-g-end'},
            {'bar': 9, 'pattern': 'bass-am'},
            {'bar': 10, 'pattern': 'bass-f'},
            {'bar': 11, 'pattern': 'bass-out'},
        ],
        'patterns': [
            pitched_pattern('bass-am', 1, bass_a, BASS_BASE),
            pitched_pattern('bass-f', 1, bass_f, BASS_BASE),
            pitched_pattern('bass-g', 1, bass_g, BASS_BASE),
            pitched_pattern('bass-g-end', 1, bass_g_end, BASS_BASE),
            pitched_pattern('bass-out', 2, bass_out, BASS_BASE),
        ],
    }

    # ---- drums: benchmark-local kit copied from Orbital Foundry ----
    tick_only = hat_notes(lambda i: 0.34 if i % 2 == 0 else 0.12)
    outro = [drum_note('1:1', 'mechanical-kick', 0.60)] + \
            hat_notes(lambda i: 0.26 if i % 4 == 0 else 0)
    payoff_drums = groove_notes() + [
        drum_note('1:1', 'cinematic-impact', 0.80),
        drum_note('1:2+1/8', 'metallic-strike', 0.55),
    ]
    drums_track = {
        'id': 'drums',
        'description': 'Orbital Foundry machine kit: mechanical kick, industrial snare, ratcheted machine ticks. Silent in the break.',
        'instrument': {'type': 'drumkit', 'kit': 'assets/orbital-foundry/kit.json'},
        'mix': {'gainDb': -2, 'pan': 0},
        'effects': [
            {'type': 'highpass', 'frequencyHz': 40},
            {'type': 'compressor', 'thresholdDb': -12, 'ratio': 4, 'attackMs': 4, 'releaseMs': 70, 'makeupGainDb': 2},
            {'type': 'saturation', 'driveDb': 6, 'mix': 0.2},
        ],
        'clips': [
            {'bar': 2, 'pattern': 'tick-only'},
            {'bar': 3, 'pattern': 'groove'},
            {'bar': 4, 'pattern': 'groove'},
            {'bar': 5, 'pattern': 'groove'},
            {'bar': 6, 'pattern': 'fill'},
            {'bar': 9, 'pattern': 'payoff'},
            {'bar': 10, 'pattern': 'groove'},
            {'bar': 11, 'pattern': 'outro'},
        ],
        'patterns': [
            {'id': 'tick-only', 'bars': 1, 'notes': tick_only},
            {'id': 'groove', 'bars': 1, 'notes': groove_notes()},
            {'id': 'fill', 'bars': 1, 'notes': groove_notes(fill_hats)},
            {'id': 'payoff', 'bars': 1, 'notes': payoff_drums},
            {'id': 'outro', 'bars': 1, 'notes': outro},
        ],
        'automation': {
            'gainDb': [
                {'at': {'musical': '11:1'}, 'value': -2, 'transition': 'linear'},
                {'at': {'musical': '12:4'}, 'value': -40},
            ],
        },
    }

    # ---- sub: GLASSHOUSE 07-sub-cs.wav (C#2 native), one hit per payoff bar ----
    sub_track = {
        'id': 'sub',
        'description': 'GLASSHOUSE sub-cs under the payoff only, so the low end opens late.',
        'instrument': {'type': 'sampler', 'sample': 'assets/glasshouse/07-sub-cs.wav'},
        'mix': {'gainDb': -5, 'pan': 0},
        'effects': [{'type': 'highpass', 'frequencyHz': 30}],
        'clips': [
            {'bar': 9, 'pattern': 'sub-am'},
            {'bar': 10, 'pattern': 'sub-f'},
        ],
        'patterns': [
            pitched_pattern('sub-am', 1, [('1:1', 45, 0.90)], SUB_BASE),
            pitched_pattern('sub-f', 1, [('1:1', 41, 0.90)], SUB_BASE),
        ],
    }

    # ---- fx: Orbital tension-riser, pitch-rising across the break ----
    rise_pattern = {
        'id': 'rise',
        'bars': 2,
        'notes': [{'start': '1:1', 'velocity': 0.75, 'playbackRate': 0.8,
                   'glide': {'to': 1.2, 'duration': '2/1'}}],
    }
    fx_track = {
        'id': 'fx',
        'description': 'Tension riser from Orbital Foundry, rising in pitch through the E break and stopping before the drop.',
        'instrument': {'type': 'sampler', 'sample': 'assets/orbital-foundry/08-tension-riser.wav'},
        'mix': {'gainDb': -6, 'pan': 0},
        'effects': [{'type': 'reverb', 'roomSize': 0.6, 'decaySeconds': 2.0, 'wet': 0.30}],
        'automation': {
            'gainDb': [
                {'at': {'musical': '7:1'}, 'value': -14, 'transition': 'linear'},
                {'at': {'musical': '9:1'}, 'value': -2},
            ],
        },
        'clips': [{'bar': 7, 'pattern': 'rise'}],
        'patterns': [rise_pattern],
    }

    # ---- drone: Orbital dark-drone (A1 native) tape-stops through the final bars ----
    drone_track = {
        'id': 'drone',
        'description': 'Orbital Foundry dark drone (A1 native) that tape-stops to half speed under the last two bars and fades out.',
        'instrument': {'type': 'sampler', 'sample': 'assets/orbital-foundry/10-dark-drone.wav'},
        'mix': {'gainDb': -14, 'pan': 0},
        'effects': [{'type': 'lowpass', 'frequencyHz': 260}],
        'automation': {
            # Holds near -8 dB through bar 11, then fades to the -60 dB floor over beats 1-3 of bar 12
            # so the closing A2 is the last audible tonic. A dB-linear fade is steep: 53 dB over 3.6 s
            # is about 15 dB per second, so the fade must be split across two segments.
            'gainDb': [
                {'at': {'musical': '11:1'}, 'value': -8, 'transition': 'linear'},
                {'at': {'musical': '12:1'}, 'value': -12, 'transition': 'linear'},
                {'at': {'musical': '12:3'}, 'value': -60},
            ],
        },
        'clips': [{'bar': 11, 'pattern': 'drone'}],
        'patterns': [{
            'id': 'drone',
            'bars': 1,
            'notes': [{'start': '1:1', 'velocity': 0.90, 'glide': {'to': 0.5, 'duration': '2/1'}}],
        }],
    }

    project = {
        'formatVersion': 1,
        'title': 'Idle Hymn',
        'description': (
            'Round 1 open-class entry for the DaemonV12 Ultimate Beat Battle. '
            '28.8 seconds, 12 bars at 100 BPM in A minor. A metal-tine call opens cold, a machine '
            'groove wakes under it, a tension riser falls silent before an octave-up payoff, and '
            'the final tine and drone tape-stop into A. Custom tine sounds are generated by '
            'tools/make_assets.py; the Orbital Foundry and GLASSHOUSE one-shots are copied unchanged.'
        ),
        'bpm': 100,
        'timeSignature': '4/4',
        'key': 'A minor',
        'bars': 12,
        'seed': 7,
        'render': {'duration': {'bars': 12}, 'tail': 'auto'},
        'master': {
            # Headroom for the summed payoff transients: the bar-9 impact stacks on hook, bass and sub.
            'gainDb': -3,
            'effects': [
                {'type': 'highpass', 'frequencyHz': 28},
                {'type': 'compressor', 'thresholdDb': -16, 'ratio': 4, 'attackMs': 3,
                 'releaseMs': 100, 'makeupGainDb': 2},
                {'type': 'saturation', 'driveDb': 2, 'mix': 0.10},
            ],
        },
        'tracks': [hook_track, bass_track, drums_track, sub_track, fx_track, drone_track],
    }
    return project


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default='v1', help='label only; the project is the same file')
    parser.add_argument('--out', default=os.path.join(BASE, 'project.json'))
    args = parser.parse_args()
    project = build(args.version)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(project, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', args.out)


if __name__ == '__main__':
    main()

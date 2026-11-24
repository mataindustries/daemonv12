"""Sample genealogy of FERRYMAN TAKES FAKES V2 (v2/genealogy.json), computed from the committed files.

Every sound in the V2 master descends from two rack scores. This walks the chain: scores -> prints -> second-generation
prints -> chops -> the V2 project's 1,187 sampler events, with SHA-256 for every file and how often each chop is played.

    python3 counterfeit-gold-opus/v2/genealogy.py
"""
import hashlib, json, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sha = lambda rel: hashlib.sha256(open(os.path.join(ROOT, rel), 'rb').read()).hexdigest()
prints = json.load(open(os.path.join(HERE, 'prints.json')))
chops = json.load(open(os.path.join(HERE, 'chops.json')))
project = json.load(open(os.path.join(ROOT, 'ferryman-takes-fakes-v2.json')))

nodes = [
    {'id': 'lp-score', 'generation': 0, 'file': 'source/two-coins-for-the-ferryman.score.json', 'made': 'composed: source/compose.ts (rack score, 13 parts, 1,260 notes)'},
    {'id': 'street-score', 'generation': 0, 'file': 'v2/procession/two-coins-procession-take.score.json', 'made': 'composed: v2/procession/compose.ts (rack score, 11 parts, 579 notes)'},
    {'id': 'lp', 'generation': 1, 'file': 'assets/record/the-velvet-hearse--two-coins-for-the-ferryman.wav', 'parents': ['lp-score'],
     'made': 'performed and printed once by the Signature Rack + Timbre Lab (context mix, normalized to -16 LUFS); reproduced byte for byte by a second render'},
    {'id': 'street', 'generation': 1, 'file': 'assets/record/the-velvet-hearse--two-coins-procession-take.wav', 'parents': ['street-score'],
     'made': 'performed and printed once by the Signature Rack + Timbre Lab (context mix, normalized to -16 LUFS)'},
    {'id': 'v1-swell', 'generation': 2, 'file': 'assets/derived/swell-reversed.wav', 'parents': ['lp'], 'made': 'V1: one LP slice, frames reversed, bit-exact'},
    {'id': 'v1', 'generation': 2, 'file': 'assets/v1/ferryman-takes-fakes-v1.wav', 'parents': ['lp', 'v1-swell'],
     'made': 'V1 master (ferryman-takes-fakes.json, unchanged engine): 29 LP chops; byte-identical to beat/ferryman-takes-fakes.wav'},
    {'id': 'eternal', 'generation': 2, 'file': prints['eternal']['file'], 'parents': ['lp'],
     'made': f"engine print ({prints['eternal']['project']}): the Deacon's pluck, then 8 periods of its sustain spliced every 4 periods, {prints['eternal']['splice']['voices']} phase-locked voices"},
    {'id': 'reversed', 'generation': 2, 'file': prints['reversed']['file'], 'parents': ['lp'],
     'made': 'two LP slices, frames reversed bit-exact, laid end to end; the second is byte-identical to V1\'s swell'},
]
for n in nodes: n['sha256'] = sha(n['file'])

# what V2 plays: match each sampler note to its chop by source file and slice
by_slice = {}
for name, c in chops['chops'].items():
    by_slice[(chops['sources'][c['src']]['file'], c['offsetSeconds'], c['endSeconds'])] = name
use = collections.defaultdict(lambda: {'events': 0, 'tracks': collections.Counter(), 'rates': set()})
for t in project['tracks']:
    for n in t['patterns'][0]['notes']:
        name = by_slice.get((t['instrument']['sample'], n.get('offsetSeconds', 0.0), n['endSeconds']), '?')
        u = use[name]; u['events'] += 1; u['tracks'][t['id']] += 1; u['rates'].add(round(n.get('playbackRate', 1), 6))
played = []
for name, u in sorted(use.items(), key=lambda kv: -kv[1]['events']):
    c = chops['chops'].get(name, {})
    played.append({'chop': name, 'source': c.get('src'), 'generation': c.get('generation'), 'role': c.get('role'), 'events': u['events'],
                   'tracks': dict(u['tracks']), 'rates': sorted(u['rates'])})
gen_count = collections.Counter()
for p in played: gen_count[f"generation {p['generation']} ({p['source']})"] += p['events']
out = {'title': 'FERRYMAN TAKES FAKES (V2): sample genealogy', 'nodes': nodes,
       'v2': {'project': 'ferryman-takes-fakes-v2.json', 'projectSha256': sha('ferryman-takes-fakes-v2.json'), 'events': sum(p['events'] for p in played),
              'chopsPlayed': len(played), 'eventsBySource': dict(gen_count), 'unmatched': use['?']['events'] if '?' in use else 0},
       'played': played}
json.dump(out, open(os.path.join(HERE, 'genealogy.json'), 'w'), indent=1)
print(json.dumps(out['v2'], indent=1))

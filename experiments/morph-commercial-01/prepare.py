#!/usr/bin/env python3
"""Extract the approved B master without DSP and remap its authoritative event map.

Run from any directory: python3 experiments/morph-commercial-01/prepare.py
Only Python's standard library is required. Source files are read, never changed.
"""
from __future__ import annotations

import collections
import hashlib
import json
from pathlib import Path
import wave

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "morph-06"
MASTER = SOURCE / "audio/b/cable-beast-b.wav"
EVENTS = SOURCE / "audio/b/cable-beast-b.events.json"
MASTER_SHA256 = "1474f0d22e0e939acad1824a01b92d8264cb5b4e758623034e6c92c597c6c890"
EVENTS_SHA256 = "de93e3cddf7d7267010da1553e0d295243efeec43f00d4888805ad8aa65e00d4"
COMMIT = "2b6e533a021218d6940a8da5a7032c2abe58a3d9"
SR, FPS = 44100, 60
START, STOP = 882000, 1234800
CUT = 1217160 - START
FRAME_SAMPLES = SR // FPS  # 735 exactly: no fractional sample/frame boundary.


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def route_event(e: dict, t: float) -> tuple[str, bool, str, float]:
    """Return system, initial selection, reason, response duration in seconds.

    Durations deliberately overlap: signal density rises without full-frame flashes.
    Source events that do not become distinct accents remain in the output for audit.
    """
    part, name = e["part"], e["event"]
    vel = e.get("velocity", 1.0)
    if part == "all" and "silence" in name.lower():
        return "blackout", True, "Authoritative sample-accurate all-source cutoff.", 0.4
    if part == "section":
        return "metadata", False, "Story marker retained as metadata; no added flash.", 0.0
    if part == "cable bass":
        return "cable", name != "ghost", (
            "Major cable attack launches a routed surge." if name != "ghost" else
            "Ghost articulation remains in the music; major attacks carry the visual phrase."
        ), 0.42 if name == "slap" else 0.30
    if part == "cable":
        if name in ("silent", "grab (hand stops the cable)"):
            return "metadata", False, "Redundant with the authoritative all-source blackout.", 0.0
        if name in ("WIND-UP", "OVERWIND"):
            return "cable", True, "Cable winding-state marker launches a routed surge; the compositor's overload timeline increases travel speed after 5.5 seconds.", (0.60 if name == "OVERWIND" else 0.375)
        return "cable", True, "Cable strike launches a local surge; rapid strikes are coalesced below.", 0.20 if name == "wind strike" else 0.42
    if part == "cable partner":
        return "cable", name == "crack", (
            "Partner cable crack launches an alternate connected route." if name == "crack" else
            "Simultaneous quiet partner pluck is represented by the main cable attack."
        ), 0.30
    if part == "kick":
        return "kick", vel >= 0.65, (
            "Power-rail / package structural compression and release." if vel >= 0.65 else
            "Quiet ghost kick omitted from large structural motion."
        ), 0.28
    if part == "snare":
        chosen = name != "toaster spring" and (name != "ghost snare" or (t >= 5.5 and vel >= 0.35))
        return "snare", chosen, (
            "Localized contact-array bridge response, spatially separate from kick." if chosen else
            "Spring layer or quiet ghost shares the stronger snare response."
        ), 0.20
    if part == "beast":
        duration = max(0.10, e.get("lengthSteps", 0.8) * 0.125)
        return "beast", True, "Processor tiles / amber channels follow this exact syllable and phrase length.", duration
    if part == "ratchet":
        return "branch", name == "repeat", (
            "Ratchet repeat advances connected fine-route branches; close repeats coalesce below." if name == "repeat" else
            "Ratchet section header is represented by its measured repeat events."
        ), 0.22
    if part == "toms":
        return "branch", True, "Pitch-walking tom activates a different peripheral route group.", 0.26
    if part == "perc":
        chosen = name != "cable tick" or vel >= (0.20 if t >= 5.5 else 0.50)
        return "branch", chosen, (
            "Percussion accent splits a local connected branch; tails overlap." if chosen else
            "Quiet tick omitted to preserve hierarchy and avoid indiscriminate twinkling."
        ), 0.20
    return "metadata", False, "Source metadata retained without a separate visual response.", 0.0


def main() -> None:
    master_bytes, events_bytes = MASTER.read_bytes(), EVENTS.read_bytes()
    assert sha256(master_bytes) == MASTER_SHA256, "Approved B master hash mismatch"
    assert sha256(events_bytes) == EVENTS_SHA256, "Authoritative B event-map hash mismatch"
    with wave.open(str(MASTER), "rb") as src:
        assert (src.getframerate(), src.getnchannels(), src.getsampwidth(), src.getnframes()) == (SR, 2, 3, STOP)
        params = src.getparams()
        all_pcm = src.readframes(src.getnframes())
    stride = params.nchannels * params.sampwidth
    cropped_pcm = all_pcm[START * stride:STOP * stride]
    assert len(cropped_pcm) == (STOP - START) * stride
    assert all(v == 0 for v in cropped_pcm[CUT * stride:]), "Source cutoff no longer exact digital silence"
    assert any(cropped_pcm[(CUT - 735) * stride:CUT * stride]), "Expected audio immediately before cutoff"
    audio_dir = HERE / "audio"
    audio_dir.mkdir(exist_ok=True)
    clip = audio_dir / "circuit-reference.wav"
    with wave.open(str(clip), "wb") as dst:
        dst.setparams(params._replace(nframes=STOP - START))
        dst.writeframes(cropped_pcm)
    with wave.open(str(clip), "rb") as check:
        assert check.getnframes() == 352800
        assert check.readframes(check.getnframes()) == cropped_pcm

    source_map = json.loads(events_bytes)
    result = []
    ordinal = collections.Counter()
    for source_index, original in enumerate(source_map["events"]):
        if not START <= original["sampleFrame"] < STOP:
            continue
        relative = original["sampleFrame"] - START
        system, selected, reason, duration = route_event(original, relative / SR)
        event = dict(original)
        event.update({
            "sourceIndex": source_index,
            "sourceSampleFrame": original["sampleFrame"],
            "sourceTime": original["time"],
            "sourceFrame60": original["frame60"],
            "sampleFrame": relative,
            "time": relative / SR,
            "frame60": relative // FRAME_SAMPLES,
            "system": system,
            "selected": selected,
            "selectionReason": reason,
            "route": ordinal[system] % 16,
            "ordinal": ordinal[system],
            "duration": min(duration, max(0.0, (CUT - relative) / SR)) if system != "blackout" else 0.4,
            "velocity": original.get("velocity", 1.0),
            "coalescedSourceIndices": [],
        })
        if "end" in original:
            event["sourceEnd"] = original["end"]
            event["end"] = original["end"] - START / SR
        ordinal[system] += 1
        result.append(event)

    # At most one NEW response per system per two 60-fps frames. This is not a
    # brightness gate: existing routed trails continue through these windows.
    # Major cable bass attacks and state changes remain individually represented;
    # wind strikes and partner cracks can join an already active cable response.
    recent: dict[str, dict] = {}
    for e in result:
        if not e["selected"] or e["system"] in ("metadata", "blackout", "beast"):
            continue
        prior = recent.get(e["system"])
        close = prior is not None and e["frame60"] - prior["frame60"] < 2
        major_cable = e["system"] == "cable" and (e["part"] == "cable bass" or e["event"] in ("WIND-UP", "OVERWIND"))
        if close and not major_cable:
            e["selected"] = False
            e["coalescedIntoSourceIndex"] = prior["sourceIndex"]
            e["selectionReason"] = "Coalesced into an active same-system response within two picture frames; no extra flash."
            prior["coalescedSourceIndices"].append(e["sourceIndex"])
            # Useful to a compositor: count and maximum strength can alter branch
            # fan-out while retaining the representative's exact start sample.
            prior["coalescedCount"] = len(prior["coalescedSourceIndices"]) + 1
            prior["coalescedPeakVelocity"] = max(prior.get("coalescedPeakVelocity", prior["velocity"]), e["velocity"])
        else:
            recent[e["system"]] = e

    assert all(e["frame60"] == e["sourceFrame60"] - 1200 for e in result)
    assert result[0]["sampleFrame"] == 0
    cut_events = [e for e in result if e["system"] == "blackout"]
    assert len(cut_events) == 1 and cut_events[0]["sampleFrame"] == CUT and cut_events[0]["frame60"] == 456
    data = {
        "title": "MORPH//COMMERCIAL 01 — THE CIRCUIT",
        "source": {
            "repository": "mataindustries/daemonv12",
            "branch": "feat/morph-06-overload",
            "commit": COMMIT,
            "master": str(MASTER.relative_to(HERE.parents[1])),
            "masterSha256": MASTER_SHA256,
            "eventMap": str(EVENTS.relative_to(HERE.parents[1])),
            "eventMapSha256": EVENTS_SHA256,
        },
        "audio": {
            "reference": "audio/circuit-reference.wav",
            "sha256": sha256(clip.read_bytes()),
            "pcmSha256": sha256(cropped_pcm),
            "sampleRate": SR,
            "channels": 2,
            "bitsPerSample": 24,
            "frames": STOP - START,
            "sourceStartSample": START,
            "sourceStopSampleExclusive": STOP,
            "seconds": 8,
            "processing": "Exact PCM-byte slice only; no gain, normalization, limiting, fades, resampling, recomposition or time stretching.",
        },
        "picture": {
            "fps": FPS, "frames": 480, "width": 1080, "height": 1920,
            "samplesPerFrame": FRAME_SAMPLES,
            "indexing": "Zero based; frame f represents audio samples [f*735,(f+1)*735).",
            "eventRule": "relativeSample=sourceSampleFrame-882000; frame60=relativeSample//735; time=relativeSample/44100. Authoritative samples override rounded source time.",
            "blackoutStartSample": CUT,
            "blackoutStartFrame": 456,
            "blackoutSeconds": 7.6,
            "blackoutFrames": 24,
        },
        "systems": {
            "cable": "Cyan-white signal head and dim trail travel major copper routes; travel speed rises on the overload timeline after 5.5 seconds.",
            "kick": "Broad power rail / processor package compression-release; no global brightness pumping.",
            "snare": "Pale-white localized contact-array bridge response.",
            "beast": "Amber central processor aperture patterns follow syllable identity, duration and phrase interaction.",
            "branch": "Ratchet and percussion launch connected fine-route fan-out; activity, speed and complexity increase without full-frame strobes.",
            "blackout": "All image layers become exact black at frame456, held through frame479.",
            "metadata": "Audited source context with no independent rendered accent.",
        },
        "visualImplementation": {
            "renderer": "render.py; original scene geometry and calibrated projections are produced by scene.py.",
            "geometry": "work/scene.json contains all 56 physical main routes, their connected branches, 48 die tiles, core outline and camera calibration. No external geometry or imagery is used.",
            "routeField": "Each event route is a deterministic route-group index in [0,15], derived from that system's source-event ordinal modulo 16. It is not the physical route ID.",
            "physicalRoutes": {
                "count": 56,
                "cable": "For j in range(count), physicalRoute=((route%4)*14+(route//4)*3+j)%56. count=3 before 5.5 seconds and 4 from 5.5 seconds onward.",
                "openingCableException": "For the event at relative sample 0, count=16 and physicalRoute=((j%4)*14+(j//4)*3)%56, j=0..15.",
                "branch": "physicalRoute=(route*3+j*14)%56; j=0..1 before 5.5 seconds, j=0..2 from 5.5 to 7.0 seconds, j=0..3 from 7.0 seconds onward. The main route's first four points share a junction with branchScreen; the two outgoing arms split at that physical junction.",
            },
            "timing": {
                "activation": "selected event enters the containing picture frame frame60; compositor age=max(1/600,(frame+1)/60-time), preventing a one-frame ceil delay.",
                "cableSpeed": "1+max(0,t-5.5)*0.55; pulse position=age/(duration*0.94)*speed.",
                "branchTravelDuration": "0.52/(1+max(0,t-5.5)*1.3) seconds; branch tails remain eligible for duration+0.35 seconds.",
                "blackout": "render.py returns an exact RGB-black image before compositing any layers when zero-based frame>=456.",
            },
            "plateFinishing": {
                "grade": "Static RGB multipliers: board=0.58, core=0.54, foreground=0.58. Alpha channels are preserved.",
                "boardMatte": "A planar projective transform is fitted from physical route XY points and calibrated screen coordinates. It projects the board boundary corners (-11.5,-15.5), (11.5,-15.5), (11.5,15.5), (-11.5,15.5) into an alpha mask, removing the lighting World's visible backdrop. The board composites over exact black.",
                "localizedEmission": "addlight strength=2.4 for board-level routed signals, 2.5 for processor-level aperture/contact signals. Optical bloom uses local Gaussian spill and an exponential shoulder; it is not a global audio-level brightness gate.",
                "lineScale": "Projected screen-space widths scale by s=outputWidth/sceneMetadata.width. Cable trail=4.5*s; branch signal=2.6*s; snare contact=2.6*s. Integer minimum widths preserve visibility in the low-resolution proof.",
            },
            "systems": {
                "kick": "Envelope adds kick*0.006 to the central processor plane's camera scale and energizes its perimeter, with the same calm camera trajectory.",
                "snare": "Nine localized pale-white die-contact lines; tile index=((j+route)*5)%48 for j=0..8.",
                "beast": "Amber paired aperture lines on the 48 die tiles. The scored phoneme selects discrete patterns: ka alternates column banks, WOM opens a broad row pattern, glitch advances a three-bank tile pattern, and other syllables scan across columns. Source syllable ordinal also selects banks and phase; lengthSteps determines response duration. Aperture length and spacing modulate within the scored syllable. Dark slots (width=max(2,round(7*s))) appear beneath the amber gates (width=max(1,round(4*s))). Original score pitch labels remain audit metadata, not a separate pitch-to-geometry control.",
            },
            "coalescing": "Unselected coalesced rows do not create independent visual accents or add energy in this compositor. Their representative's existing routed trail continues. coalescedCount and coalescedPeakVelocity are audit metadata; render.py does not use them to increase brightness or fan-out.",
            "proof": {
                "width": 360, "height": 640, "fps": 30, "frames": 108, "seconds": 3.6,
                "sourceFrameWindowsHalfOpen": [[0, 72], [180, 240], [396, 480]],
                "sourceSecondWindowsHalfOpen": [[0, 1.2], [3, 4], [6.6, 8]],
                "sourceSampleWindowsHalfOpen": [[0, 52920], [132300, 176400], [291060, 352800]],
                "method": "Three continuous windows sampled at every second 60-fps source frame; matching exact PCM audio windows concatenate without gain changes. This is a 3.6-second review montage, not the eight-second delivery master.",
            },
        },
        "selection": {
            "sourceExcerptEvents": len(result),
            "selectedEvents": sum(e["selected"] for e in result),
            "selectedBySystem": dict(collections.Counter(e["system"] for e in result if e["selected"])),
            "policy": "Major cable attacks, all Beast syllables and strong structural drums retained. Quiet ghosts/ticks omitted. Closely spaced events coalesce into active trails within two frames; no randomized flashing.",
            "note": "All 361 excerpt source rows remain in events with explicit selectionReason; coalesced rows retain their authoritative timing and representative source index.",
        },
        "events": result,
    }
    (HERE / "mapping.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"audio": data["audio"], "selection": data["selection"], "picture": data["picture"]}, indent=2))


if __name__ == "__main__":
    main()

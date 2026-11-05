"""Synthesize the film's score and sound design from timeline.json (designed 120 BPM grid).

Everything is generated here, so the audio is owned outright. Output: out/score.wav (48 kHz stereo).
Structure follows the treatment: light hook, groove, a thinner 'turn', a build with an accelerating
roll, 0.5 s of silence, then the drop and the loudest hit on the stamp (the payoff).
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
HERE = Path(__file__).resolve().parent
TL = json.loads((HERE / "timeline.json").read_text())
DUR = TL["meta"]["dur"]
BEAT = 60 / TL["meta"]["bpm"]
N = int(DUR * SR)
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def beat_t(scene, beat):
    s = next(x for x in TL["scenes"] if x["id"] == scene)
    return s["beats"][beat]


def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def add(sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i + len(sig) <= 0:
        return
    sig = sig[: N - i]
    l, r = gain * np.sqrt((1 - pan) / 2) * 1.414, gain * np.sqrt((1 + pan) / 2) * 1.414
    mix[i:i + len(sig), 0] += sig * l
    mix[i:i + len(sig), 1] += sig * r


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


# ---------- instruments ----------
def kick(power=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.25
    return (np.sin(ph) * np.exp(-t / (0.22 * power)) + click) * 0.9


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    x = rng.standard_normal(n)
    x = x - onepole_lp(x, 6000)              # crude high-pass
    return x * env(n, 0.001, 0.06 if open_ else 0.012) * 0.35


def snare():
    n = int(0.22 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    noise = rng.standard_normal(n); noise = noise - onepole_lp(noise, 1200)
    return body + noise * np.exp(-t / 0.08) * 0.45


def bass(freq, length):
    n = int(length * SR); t = np.arange(n) / SR
    saw = 2 * ((freq * t) % 1) - 1
    x = 0.6 * np.sin(2 * np.pi * freq * t) + 0.25 * onepole_lp(saw, 500)
    return x * env(n, 0.005, length * 0.6)


def pad(freqs, length):
    n = int(length * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * (1 + d) * t) for f in freqs for d in (-0.003, 0, 0.004))
    x = x / (len(freqs) * 3)
    fade = np.minimum(1, t / 0.6) * np.minimum(1, (length - t) / 0.4)
    return x * fade * 0.5


def noise_burst(length, cutoff, decay):
    n = int(length * SR); x = onepole_lp(rng.standard_normal(n), cutoff)
    return x / (np.abs(x).max() + 1e-9) * env(n, 0.002, decay)


def tick():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t / 0.006) * 0.4


def blip(f):
    n = int(0.06 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) * 0.3


def whoosh(length=0.4):
    n = int(length * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n); x = x - onepole_lp(x, 800); x = onepole_lp(x, 5000)
    shape = np.sin(np.pi * t / length) ** 2
    return x / (np.abs(x).max() + 1e-9) * shape * 0.5


def riser(length):
    n = int(length * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n); seg = SR // 20
    for s in range(0, n, seg):                # sweep the filter upward
        c = 300 + 7000 * (s / n) ** 2
        out[s:s + seg] = onepole_lp(x[s:s + seg], c)
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / length) ** 2) / SR) * 0.15
    return (out / (np.abs(out).max() + 1e-9) * 0.6 + tone) * (t / length) ** 1.5


# ---------- arrangement on the grid ----------
A, C, E, G, F = 55.0, 65.41, 82.41, 98.0, 87.31
bars = [(A, [220, 261.6, 329.6]), (F, [174.6, 220, 261.6]), (C, [261.6, 329.6, 392]), (G, [196, 246.9, 293.7])]

def groove(t0, t1, kick_on=True, hats=True, bass_on=True, pad_on=True, light=False):
    t = t0
    while t < t1 - 1e-6:
        beat_in_bar = int(round((t / BEAT))) % 4
        bar_idx = int(t // (4 * BEAT)) % 4
        root, chord = bars[bar_idx]
        if kick_on and (not light or beat_in_bar in (0, 2)):
            add(kick(), t, 0.95)
        if hats:
            add(hat(), t + BEAT / 2, 0.55, pan=0.25)
            if beat_in_bar == 3 and not light:
                add(hat(True), t + BEAT / 2, 0.4, pan=-0.2)
        if not light and beat_in_bar in (1, 3):
            add(snare(), t, 0.45)
        if bass_on:
            add(bass(root, BEAT * 0.45), t + BEAT / 2, 0.55)
        if pad_on and beat_in_bar == 0:
            add(pad(chord, 4 * BEAT), t, 0.3)
        t += BEAT

groove(0.0, 4.0, light=True, bass_on=False, kick_on=False)                       # hook: sparse
groove(4.0, 12.0)                                                 # list: full groove
groove(12.0, 16.0, kick_on=False, light=True)                     # turn: thinner
groove(16.0, 21.5, light=True)                                    # build base
# accelerating roll into the silence: intervals halve 0.5 → 0.25 → 0.125
t = 19.0
for step, until in ((0.5, 20.0), (0.25, 21.0), (0.125, 21.5)):
    while t < until - 1e-6:
        add(snare(), t, 0.25 + 0.25 * (t - 19) / 2.5); t += step
add(riser(4.5), 17.0, 0.55)
# 21.5–22.0 silence (nothing scheduled)
groove(22.0, 30.5)                                                # payoff and CTA: full
add(pad([220, 261.6, 329.6, 440], 1.6), 30.5, 0.35)                # tail

# ---------- sound design from the timeline's sfx list ----------
def layer(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n)
    for p in parts: out[:len(p)] += p
    return out

def sfx(name):
    if name == "slam":
        return layer(kick(1.3) * 0.8, noise_burst(0.25, 3000, 0.05) * 0.4)
    if name == "thunk":
        n = int(0.3 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.06) + noise_burst(0.3, 1500, 0.03) * 0.5
    if name == "hero":
        n = int(1.4 * SR); t = np.arange(n) / SR
        sub = np.sin(2 * np.pi * (40 + 60 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.5)
        k = np.zeros(n); kk = kick(1.6); k[:len(kk)] = kk
        return sub * 1.2 + noise_burst(1.4, 4000, 0.18) * 0.6 + k * 0.8
    if name == "whoosh":
        return whoosh()
    if name == "tear":
        n = int(0.35 * SR); x = rng.standard_normal(n); x = x - onepole_lp(x, 1500)
        grain = (rng.random(n) > 0.7).astype(float)
        return x * grain * env(n, 0.01, 0.12) * 0.6
    if name == "riser":
        return np.zeros(1)                     # scheduled with the build above
    return np.zeros(1)

for s in TL["sfx"]:
    scene, beat = s["at"].split(".")
    t = beat_t(scene, beat) + s["offset"]
    g = 10 ** (s["gain"] / 20)
    if s["src"] == "ticks":                    # one tick per flag pop
        for i in range(0, 42, 3):
            add(tick(), t + i * 0.01, g * 2, pan=rng.uniform(-.5, .5))
    elif s["src"] == "keys":                   # typing /api/latest.json
        for i in range(16):
            add(tick() * 0.7, t + i * 0.025, g * 2.5, pan=-0.1)
    elif s["src"] == "blips":
        for i in range(11):
            add(blip(900 + 90 * i), t + i * 0.05, g * 2.5, pan=0.15)
    elif s["src"] == "printer":
        for i in range(24):
            add(noise_burst(0.025, 2500, 0.01), t + i * 0.033, g * 1.5)
    else:
        add(sfx(s["src"]), t, g)

# keep the silence truly silent and fade the tail
mix[int(21.5 * SR):int(22.0 * SR)] = 0
tail = np.arange(N) / SR
mix *= np.clip((DUR - tail) / 0.8, 0, 1)[:, None]

peak = np.abs(mix).max()
mix = mix / peak * 0.89
out = HERE / "out"; out.mkdir(exist_ok=True)
with wave.open(str(out / "score.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("score.wav", DUR, "s")

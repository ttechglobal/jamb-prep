"""Original synthesized music bed + sound effects (no third-party audio, so no licensing). python scripts/sfx.py"""
import numpy as np, wave
SR = 44100
rng = np.random.default_rng(7)
def save(name, x, vol=0.9):
    x = np.clip(x / max(1e-9, np.abs(x).max()) * vol, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    with wave.open(f"assets/{name}.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.1):
    e = np.ones(n); a_n = max(1, int(a*SR)); r_n = max(1, int(r*SR))
    e[:a_n] = np.linspace(0, 1, a_n); e[-r_n:] = np.minimum(e[-r_n:], np.linspace(1, 0, r_n)); return e
def lp(x, k):  # one-pole low-pass
    y = np.zeros_like(x); a = k
    for i in range(1, len(x)): y[i] = y[i-1] + a * (x[i] - y[i-1])
    return y
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def whoosh(d=0.6, up=True):
    n = int(SR*d); noise = rng.standard_normal(n)
    sweep = np.linspace(0.02, 0.5, n) if up else np.linspace(0.5, 0.02, n)
    y = np.zeros(n); s = 0
    for i in range(n): s += sweep[i] * (noise[i] - s); y[i] = s
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return y * e
def pop(f=520, d=0.18):
    x = t(d); fr = f * (1 + 1.2*np.exp(-x*40)); return np.sin(2*np.pi*np.cumsum(fr)/SR) * np.exp(-x*24)
def tick(d=0.05):
    x = t(d); return np.sin(2*np.pi*1800*x) * np.exp(-x*140) * 0.8 + rng.standard_normal(len(x))*np.exp(-x*200)*0.2
def chime(notes, gap=0.09, d=0.6):
    out = np.zeros(int(SR*(d+gap*len(notes))))
    for i, m in enumerate(notes):
        x = t(d); y = (np.sin(2*np.pi*hz(m)*x) + 0.35*np.sin(2*np.pi*hz(m)*2*x)) * np.exp(-x*6)
        o = int(i*gap*SR); out[o:o+len(y)] += y
    return out
def impact(d=1.0):
    x = t(d); f = 70 * np.exp(-x*3) + 38
    boom = np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-x*4.5)
    return boom + lp(rng.standard_normal(len(x)), 0.15) * np.exp(-x*12) * 0.6
def buzz(d=0.28):
    x = t(d); return np.sign(np.sin(2*np.pi*110*x)) * 0.4 * env(len(x), 0.005, 0.1)

save("sfx_whoosh", whoosh(0.55)); save("sfx_whoosh_down", whoosh(0.5, False))
save("sfx_pop", pop()); save("sfx_tick", tick())
save("sfx_correct", chime([72, 76, 79], 0.08, 0.7))
save("sfx_xp", chime([79, 84, 88], 0.06, 0.5))
save("sfx_impact", impact()); save("sfx_wrong", buzz())
save("sfx_reveal", chime([67, 72, 76, 79, 84], 0.07, 1.1))

# --- music bed: 118 BPM, C - Am - F - G, 34 s ---
BPM = 118; beat = 60/BPM; dur = 34.0; N = int(SR*dur); L = np.zeros(N); R = np.zeros(N)
def add(buf, x, at, g=1.0):
    i = int(at*SR); j = min(N, i+len(x))
    if i < N: buf[i:j] += x[:j-i]*g
chords = [[60,64,67],[57,60,64],[53,57,60],[55,59,62]]
bass_root = [36,33,29,31]
def kick():
    x = t(0.3); f = 120*np.exp(-x*22)+45; return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x*9)
def hat():
    x = t(0.05); n = rng.standard_normal(len(x)); n = n - np.concatenate([[0], n[:-1]]); return n*np.exp(-x*90)*0.35
def clap():
    x = t(0.18); return lp(rng.standard_normal(len(x)), 0.5)*np.exp(-x*28)*0.5
def pluck(m, d=0.35):
    x = t(d); return (np.sin(2*np.pi*hz(m)*x)+0.4*np.sin(2*np.pi*hz(m)*2*x)+0.2*np.sin(2*np.pi*hz(m)*3*x))*np.exp(-x*9)
def bass(m, d=0.4):
    x = t(d); return np.sin(2*np.pi*hz(m)*x)*np.exp(-x*3.5)*env(len(x), 0.004, 0.08)
def pad(ms, d):
    x = t(d); y = sum(np.sin(2*np.pi*hz(m)*x)+0.5*np.sin(2*np.pi*hz(m)*1.004*x) for m in ms); return y*env(len(x), 0.4, 0.5)
bars = int(dur/(beat*4))
for b in range(bars):
    ch = b % 4; at0 = b*beat*4
    add(L, pad(chords[ch], beat*4), at0, 0.05); add(R, pad(chords[ch], beat*4), at0, 0.05)
    for s in range(8):  # eighth notes
        at = at0 + s*beat/2
        if s % 2 == 0: add(L, kick(), at, 0.55); add(R, kick(), at, 0.55)
        if s in (2, 6): add(L, clap(), at, 0.35); add(R, clap(), at, 0.35)
        add(L, hat(), at, 0.35 if s % 2 else 0.2); add(R, hat(), at, 0.35 if s % 2 else 0.2)
        add(L, bass(bass_root[ch]+(12 if s in (3, 7) else 0), beat*0.45), at, 0.4); add(R, bass(bass_root[ch], beat*0.45), at, 0.4)
        note = chords[ch][[0,1,2,1,2,1,0,2][s]] + 12
        p = pluck(note); add(L, p, at, 0.16 if s % 2 == 0 else 0.1); add(R, p, at+0.012, 0.1)
m = np.stack([L, R], 1); fade = np.ones(N); k = int(SR*1.5); fade[-k:] = np.linspace(1, 0, k)
m = m*fade[:, None]; save("music", m, 0.85)
print("ok")


let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}
export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}
export function isMuted() {
  return muted;
}

function env(g: GainNode, t: number, a: number, d: number, peak = 1) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function noiseBuffer(c: AudioContext, dur: number) {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const c = ac();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  env(g, t, 0.008, dur, vol);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass') {
  const c = ac();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.02);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  env(g, t, 0.004, dur, vol);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Dirty body thud — fist into coat / gut */
function thud(vol: number, low = 70) {
  tone(low, 0.16, 'sine', vol * 0.55, 35);
  noise(0.14, vol * 0.45, 180, 0.7, 'lowpass');
}

export const SFX = {
  whiff: () => {
    noise(0.1, 0.11, 1100, 0.7);
    tone(420, 0.08, 'triangle', 0.05, 180);
  },
  hitLight: () => {
    thud(0.35, 140);
    noise(0.08, 0.28, 520, 0.9);
    tone(210, 0.07, 'square', 0.1, 100);
  },
  hitHeavy: () => {
    thud(0.7, 55);
    noise(0.28, 0.55, 160, 0.45, 'lowpass');
    tone(85, 0.28, 'sawtooth', 0.22, 32);
    noise(0.12, 0.2, 900, 0.6);
  },
  block: () => {
    // forearm / bottle block clack
    noise(0.08, 0.28, 2800, 4);
    tone(380, 0.06, 'square', 0.1, 240);
    tone(190, 0.05, 'triangle', 0.08);
  },
  jump: () => {
    tone(240, 0.11, 'sine', 0.09, 560);
    noise(0.06, 0.08, 800, 0.5);
  },
  land: () => {
    noise(0.1, 0.28, 120, 0.8, 'lowpass');
    tone(90, 0.08, 'sine', 0.12, 50);
  },
  bottle: () => {
    // empty glass bottle whoosh + clink
    tone(920, 0.1, 'sine', 0.1, 480);
    tone(1380, 0.12, 'triangle', 0.08, 900);
    noise(0.08, 0.1, 2400, 2);
  },
  glass: () => {
    noise(0.35, 0.4, 3800, 1.4);
    noise(0.22, 0.32, 7200, 2.2);
    tone(2100, 0.15, 'triangle', 0.1, 900);
    [1600, 2400, 3100].forEach((f, i) =>
      setTimeout(() => tone(f, 0.08, 'sine', 0.06, f * 0.6), i * 40),
    );
  },
  ko: () => {
    tone(100, 0.85, 'sawtooth', 0.28, 28);
    noise(0.7, 0.4, 140, 0.5, 'lowpass');
    setTimeout(() => tone(60, 0.4, 'sine', 0.18, 30), 120);
  },
  super: () => {
    // rage / special wind-up
    tone(55, 0.7, 'sawtooth', 0.3, 280);
    noise(0.55, 0.28, 700, 0.35);
    tone(110, 0.35, 'square', 0.12, 40);
  },
  ui: () => tone(480, 0.05, 'square', 0.07, 700),
  bell: () => {
    // round start — rusty yard bell
    tone(740, 0.55, 'triangle', 0.15, 520);
    tone(1110, 0.45, 'sine', 0.1);
    noise(0.15, 0.08, 2000, 1.2);
  },
  win: () => {
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => {
        tone(f, 0.22, 'square', 0.12);
        tone(f * 1.5, 0.18, 'triangle', 0.05);
      }, i * 100),
    );
  },
  lose: () => {
    [330, 262, 220, 165].forEach((f, i) =>
      setTimeout(() => tone(f, 0.3, 'sawtooth', 0.13), i * 140),
    );
  },
};

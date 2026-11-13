// New-order ringtone, synthesised with the Web Audio API — no audio file to
// host, and it plays the same everywhere. Browsers only allow sound after
// the admin has interacted with the page, so unlockAudio() is called from a
// click; until then play() is a silent no-op.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isAudioUnlocked() {
  return !!ctx && ctx.state === 'running';
}

function tone(at: number, freq: number, duration: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

// A bright three-note "ding-ding-dong", played twice (~2.4s total).
export function playOrderChime() {
  if (!ctx || ctx.state !== 'running') return false;
  const notes = [1318.5, 1568, 2093]; // E6, G6, C7
  for (let round = 0; round < 2; round++) {
    const start = ctx.currentTime + round * 1.2;
    notes.forEach((freq, i) => tone(start + i * 0.18, freq, i === notes.length - 1 ? 0.7 : 0.3));
  }
  return true;
}

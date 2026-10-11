/**
 * Procedural audio. Every sound is synthesised at runtime with WebAudio, so the
 * game ships no audio files and needs no audio licences.
 */
export type SfxName =
  | 'coin'
  | 'stack'
  | 'jump'
  | 'land'
  | 'trick'
  | 'grindStart'
  | 'hit'
  | 'smash'
  | 'crash'
  | 'whistle'
  | 'bagCue'
  | 'bagCollect'
  | 'lane'
  | 'duck'
  | 'ui'
  | 'uiBack'
  | 'purchase'
  | 'sell'
  | 'error'
  | 'combo'
  | 'mission'
  | 'door'
  | 'countdown'
  | 'go';

export interface AudioSettings {
  sound: boolean;
  music: boolean;
  soundVolume: number;
  musicVolume: number;
}

type Ctx = AudioContext;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private grind: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private settings: AudioSettings = { sound: true, music: true, soundVolume: 0.8, musicVolume: 0.5 };
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private musicMode: 'menu' | 'run' = 'menu';
  private intensity = 0;
  private lastPlayed = new Map<SfxName, number>();

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.sfx = this.ctx.createGain();
        this.sfx.connect(this.master);
        this.music = this.ctx.createGain();
        this.music.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applySettings();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.settings.music) this.startMusic();
    } catch {
      // Audio is optional.
    }
  }

  setSettings(s: AudioSettings): void {
    this.settings = { ...s };
    this.applySettings();
    if (this.ctx) {
      if (s.music) this.startMusic();
      else this.stopMusic();
    }
  }

  private applySettings(): void {
    if (!this.ctx || !this.sfx || !this.music) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.settings.sound ? this.settings.soundVolume * 0.6 : 0, t, 0.02);
    this.music.gain.setTargetAtTime(this.settings.music ? this.settings.musicVolume * 0.32 : 0, t, 0.05);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
    this.setGrinding(false);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusicMode(mode: 'menu' | 'run'): void {
    this.musicMode = mode;
  }

  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ---------------------------------------------------------------- helpers
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfx!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, filter: BiquadFilterType, freq: number, when = 0, q = 1, sweepTo?: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfx!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.sfx || !this.settings.sound || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (name === 'coin' && now - last < 0.03) return;
    this.lastPlayed.set(name, now);
    switch (name) {
      case 'coin':
        this.tone(NOTE(88), 0.06, 'square', 0.12);
        this.tone(NOTE(95), 0.1, 'square', 0.1, 0.05);
        break;
      case 'stack':
        [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.08, 'square', 0.1, i * 0.04));
        break;
      case 'jump':
        this.tone(280, 0.14, 'sine', 0.25, 0, 620);
        this.noiseBurst(0.16, 0.12, 'bandpass', 900, 0, 1, 3000);
        break;
      case 'land':
        this.tone(130, 0.12, 'sine', 0.35, 0, 55);
        this.noiseBurst(0.06, 0.2, 'highpass', 2500);
        break;
      case 'trick':
        this.noiseBurst(0.22, 0.18, 'bandpass', 600, 0, 3, 4200);
        this.tone(NOTE(79), 0.08, 'triangle', 0.08, 0.05);
        break;
      case 'grindStart':
        this.noiseBurst(0.08, 0.25, 'highpass', 3000);
        this.tone(1800, 0.05, 'square', 0.05);
        break;
      case 'hit':
        this.tone(180, 0.2, 'square', 0.22, 0, 70);
        this.noiseBurst(0.12, 0.25, 'lowpass', 1200);
        break;
      case 'smash':
        this.noiseBurst(0.3, 0.3, 'bandpass', 2400, 0, 0.7, 600);
        for (let i = 0; i < 5; i++) this.tone(900 + Math.random() * 1600, 0.05, 'triangle', 0.07, i * 0.03);
        break;
      case 'crash':
        this.noiseBurst(0.6, 0.45, 'lowpass', 2500, 0, 0.7, 200);
        this.tone(110, 0.5, 'sawtooth', 0.25, 0, 40);
        break;
      case 'whistle': {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 2900;
        lfo.frequency.value = 28;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.setValueAtTime(0.18, t + 0.22);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.36);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
        osc.connect(g);
        g.connect(this.sfx);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.8);
        lfo.stop(t + 0.8);
        break;
      }
      case 'bagCue':
        // Distinctive rising bell arpeggio: a rare bag has appeared ahead.
        [72, 79, 84, 88, 91].forEach((n, i) => {
          this.tone(NOTE(n), 0.9, 'triangle', 0.12, i * 0.09);
          this.tone(NOTE(n + 12), 0.5, 'sine', 0.05, i * 0.09);
        });
        break;
      case 'bagCollect':
        [84, 88, 91, 96, 100].forEach((n, i) => this.tone(NOTE(n), 0.6, 'triangle', 0.13, i * 0.06));
        this.noiseBurst(0.5, 0.08, 'highpass', 6000, 0.05);
        break;
      case 'lane':
        this.noiseBurst(0.07, 0.07, 'bandpass', 1400, 0, 2, 2200);
        break;
      case 'duck':
        this.tone(320, 0.1, 'sine', 0.12, 0, 160);
        break;
      case 'ui':
        this.tone(NOTE(81), 0.05, 'triangle', 0.12);
        break;
      case 'uiBack':
        this.tone(NOTE(76), 0.06, 'triangle', 0.1, 0, NOTE(72));
        break;
      case 'purchase':
        this.tone(NOTE(84), 0.08, 'square', 0.1);
        this.tone(NOTE(91), 0.25, 'square', 0.1, 0.08);
        this.noiseBurst(0.3, 0.08, 'highpass', 7000, 0.08);
        break;
      case 'sell':
        [79, 84, 88].forEach((n, i) => this.tone(NOTE(n), 0.12, 'square', 0.09, i * 0.06));
        break;
      case 'error':
        this.tone(220, 0.12, 'square', 0.12);
        this.tone(180, 0.18, 'square', 0.12, 0.12);
        break;
      case 'combo':
        this.tone(NOTE(84), 0.08, 'triangle', 0.08);
        break;
      case 'mission':
        [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.22, 'square', 0.09, i * 0.09));
        break;
      case 'door':
        this.noiseBurst(0.25, 0.15, 'lowpass', 800, 0, 1, 300);
        break;
      case 'countdown':
        this.tone(NOTE(76), 0.12, 'square', 0.12);
        break;
      case 'go':
        this.tone(NOTE(88), 0.25, 'square', 0.12);
        break;
    }
  }

  setGrinding(on: boolean): void {
    if (!this.ctx || !this.sfx || !this.noise) return;
    if (on && !this.grind && this.settings.sound && this.ctx.state === 'running') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 3200;
      f.Q.value = 2.5;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.09, this.ctx.currentTime + 0.05);
      src.connect(f);
      f.connect(gain);
      gain.connect(this.sfx);
      src.start();
      this.grind = { src, gain };
    } else if (!on && this.grind) {
      const g = this.grind;
      this.grind = null;
      try {
        g.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
        g.src.stop(this.ctx.currentTime + 0.15);
      } catch {
        // already stopped
      }
    }
  }

  // ---------------------------------------------------------------- music
  startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 50);
  }

  stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music || ctx.state !== 'running') return;
    const bpm = this.musicMode === 'run' ? 116 : 96;
    const stepDur = 60 / bpm / 4;
    const prog = [57, 53, 48, 55]; // A, F, C, G roots
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      const when = this.nextNoteTime - ctx.currentTime;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const root = prog[bar]!;
      const run = this.musicMode === 'run';
      if (run) {
        if (s % 8 === 0) this.tone(150, 0.18, 'sine', 0.5, when, 45, this.music);
        if (s % 8 === 4) this.noiseBurst(0.12, 0.22, 'bandpass', 1800, when, 0.8, undefined, this.music);
        if (s % 2 === 0 || this.intensity > 0.6) this.noiseBurst(0.03, 0.06 + this.intensity * 0.04, 'highpass', 8000, when, 1, undefined, this.music);
      } else if (s % 8 === 0) {
        this.tone(110, 0.25, 'sine', 0.22, when, 50, this.music);
      }
      if ([0, 3, 6, 10, 12].includes(s)) this.tone(NOTE(root - 24 + (s === 10 ? 7 : 0)), stepDur * 1.8, 'sawtooth', 0.09, when, undefined, this.music);
      if (s % 4 === 2) {
        const arp = [0, 4, 7, 12][(this.step / 4) % 4 | 0]!;
        this.tone(NOTE(root + arp), stepDur * 1.5, 'triangle', run ? 0.05 : 0.07, when, undefined, this.music);
      }
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();

export function haptic(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}

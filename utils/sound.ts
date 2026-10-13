// NES-style Sound Engine using Web Audio API

const STORAGE_KEY_MUTED = 'medi_knockout_muted';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;
  private muted: boolean = false;

  // Active theme / music tracking
  private activeMusicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicTimeout: any = null;
  private currentTheme: 'none' | 'title' | 'fight' = 'none';

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        this.muted = window.localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
      }
    } catch {
      this.muted = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_MUTED, this.muted ? 'true' : 'false');
      }
    } catch {
      // ignore localStorage quota/sandbox error
    }

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime);
    }
    if (this.muted) {
      this.stopMusic();
    }
    return this.muted;
  }

  setMuted(muted: boolean) {
    if (this.muted !== muted) {
      this.toggleMute();
    }
  }

  init() {
    if (this.initialized) return;

    const AudioContextClass =
      (typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null) ||
      (typeof globalThis !== 'undefined' ? (globalThis as any).AudioContext : null);

    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.8;
      this.masterGain.connect(this.ctx.destination);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    this.initialized = true;
  }

  async resume() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' || (this.ctx.state as string) === 'interrupted') {
        try {
          await this.ctx.resume();
        } catch {
          // ignore
        }
      }

      // Unlock on mobile / Safari
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 440;
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(0);
        osc.stop(this.ctx.currentTime + 0.001);
      } catch {
        // ignore
      }
    }
  }

  // Helper tone player
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startTime: number = 0,
    volume: number = 0.1
  ) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime + startTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  private createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoise(
    duration: number,
    filterFreq: number = 1000,
    volume: number = 0.1,
    startTime: number = 0
  ) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const t = this.ctx.currentTime + startTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(t);
    source.stop(t + duration);
  }

  // --- MUSIC ENGINE (Requirement 7) ---

  stopMusic() {
    if (this.musicTimeout) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }
    for (const node of this.activeMusicNodes) {
      try {
        node.osc.stop();
        node.osc.disconnect();
        node.gain.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeMusicNodes = [];
    this.currentTheme = 'none';
  }

  // Title theme: upbeat 8-bar Punch-Out style theme
  playTitleTheme() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    if (this.currentTheme === 'title') return;
    this.stopMusic();
    this.currentTheme = 'title';
    this.scheduleTitleTheme();
  }

  private scheduleTitleTheme() {
    if (!this.ctx || !this.masterGain || this.currentTheme !== 'title' || this.muted) return;

    // 8 bars at 140 BPM: 4 beats per bar, 32 beats total.
    // Beat duration = 60 / 140 = ~0.4285s. 8 bars = 13.71s
    const beat = 60 / 140;
    const start = this.ctx.currentTime + 0.05;

    // Lead melody (square wave, 8 bars: 32 beats)
    // Notes: C5(523), E5(659), G5(784), C6(1046), B5(988), A5(880), G5(784), F5(698), E5(659), D5(587), C5(523)
    const melody: { freq: number; beatOffset: number; duration: number }[] = [
      // Bar 1 (0..4)
      { freq: 523.25, beatOffset: 0, duration: beat * 0.8 },
      { freq: 659.25, beatOffset: 1, duration: beat * 0.8 },
      { freq: 783.99, beatOffset: 2, duration: beat * 1.8 },
      // Bar 2 (4..8)
      { freq: 1046.50, beatOffset: 4, duration: beat * 0.8 },
      { freq: 987.77, beatOffset: 5, duration: beat * 0.8 },
      { freq: 880.00, beatOffset: 6, duration: beat * 1.8 },
      // Bar 3 (8..12)
      { freq: 783.99, beatOffset: 8, duration: beat * 0.8 },
      { freq: 698.46, beatOffset: 9, duration: beat * 0.8 },
      { freq: 659.25, beatOffset: 10, duration: beat * 1.8 },
      // Bar 4 (12..16)
      { freq: 587.33, beatOffset: 12, duration: beat * 0.8 },
      { freq: 659.25, beatOffset: 13, duration: beat * 0.8 },
      { freq: 783.99, beatOffset: 14, duration: beat * 1.8 },
      // Bar 5 (16..20)
      { freq: 1046.50, beatOffset: 16, duration: beat * 0.8 },
      { freq: 1046.50, beatOffset: 17, duration: beat * 0.8 },
      { freq: 1174.66, beatOffset: 18, duration: beat * 1.8 },
      // Bar 6 (20..24)
      { freq: 1318.51, beatOffset: 20, duration: beat * 0.8 },
      { freq: 1174.66, beatOffset: 21, duration: beat * 0.8 },
      { freq: 1046.50, beatOffset: 22, duration: beat * 1.8 },
      // Bar 7 (24..28)
      { freq: 880.00, beatOffset: 24, duration: beat * 0.8 },
      { freq: 987.77, beatOffset: 25, duration: beat * 0.8 },
      { freq: 1046.50, beatOffset: 26, duration: beat * 1.8 },
      // Bar 8 (28..32)
      { freq: 783.99, beatOffset: 28, duration: beat * 1.0 },
      { freq: 659.25, beatOffset: 29.5, duration: beat * 1.0 },
      { freq: 523.25, beatOffset: 31, duration: beat * 0.9 },
    ];

    // Bass line (triangle wave, 8 bars driving bass)
    const bass: { freq: number; beatOffset: number; duration: number }[] = [];
    const rootNotes = [130.81, 130.81, 174.61, 196.00, 130.81, 174.61, 196.00, 130.81]; // C3, C3, F3, G3, C3, F3, G3, C3
    for (let bar = 0; bar < 8; bar++) {
      const root = rootNotes[bar];
      for (let b = 0; b < 4; b++) {
        bass.push({
          freq: b % 2 === 0 ? root : root * 1.5,
          beatOffset: bar * 4 + b,
          duration: beat * 0.6,
        });
      }
    }

    // Schedule oscillators
    for (const note of melody) {
      const noteTime = start + note.beatOffset * beat;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, noteTime);
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + note.duration);
      this.activeMusicNodes.push({ osc, gain });
    }

    for (const note of bass) {
      const noteTime = start + note.beatOffset * beat;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, noteTime);
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + note.duration);
      this.activeMusicNodes.push({ osc, gain });
    }

    const totalSeconds = 32 * beat;
    this.musicTimeout = setTimeout(() => {
      if (this.currentTheme === 'title') {
        this.activeMusicNodes = [];
        this.scheduleTitleTheme();
      }
    }, totalSeconds * 1000);
  }

  // Fight theme: driving 8-bar fight rhythm with square lead and triangle bass
  playFightTheme() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    if (this.currentTheme === 'fight') return;
    this.stopMusic();
    this.currentTheme = 'fight';
    this.scheduleFightTheme();
  }

  private scheduleFightTheme() {
    if (!this.ctx || !this.masterGain || this.currentTheme !== 'fight' || this.muted) return;

    // 8 bars at 150 BPM: 32 beats total. Beat duration = 60 / 150 = 0.4s
    const beat = 60 / 150;
    const start = this.ctx.currentTime + 0.05;

    // Driving fight melody (square wave, 8 bars: 32 beats)
    const melody: { freq: number; beatOffset: number; duration: number }[] = [
      // Bar 1 (0..4)
      { freq: 440.00, beatOffset: 0, duration: beat * 0.4 },
      { freq: 440.00, beatOffset: 0.5, duration: beat * 0.4 },
      { freq: 523.25, beatOffset: 1.0, duration: beat * 0.8 },
      { freq: 440.00, beatOffset: 2.0, duration: beat * 0.8 },
      { freq: 587.33, beatOffset: 3.0, duration: beat * 0.8 },
      // Bar 2 (4..8)
      { freq: 659.25, beatOffset: 4.0, duration: beat * 1.2 },
      { freq: 587.33, beatOffset: 5.5, duration: beat * 0.8 },
      { freq: 523.25, beatOffset: 6.5, duration: beat * 1.2 },
      // Bar 3 (8..12)
      { freq: 440.00, beatOffset: 8.0, duration: beat * 0.4 },
      { freq: 440.00, beatOffset: 8.5, duration: beat * 0.4 },
      { freq: 523.25, beatOffset: 9.0, duration: beat * 0.8 },
      { freq: 440.00, beatOffset: 10.0, duration: beat * 0.8 },
      { freq: 659.25, beatOffset: 11.0, duration: beat * 0.8 },
      // Bar 4 (12..16)
      { freq: 783.99, beatOffset: 12.0, duration: beat * 1.2 },
      { freq: 659.25, beatOffset: 13.5, duration: beat * 0.8 },
      { freq: 587.33, beatOffset: 14.5, duration: beat * 1.2 },
      // Bar 5 (16..20)
      { freq: 587.33, beatOffset: 16.0, duration: beat * 0.8 },
      { freq: 659.25, beatOffset: 17.0, duration: beat * 0.8 },
      { freq: 698.46, beatOffset: 18.0, duration: beat * 1.6 },
      // Bar 6 (20..24)
      { freq: 659.25, beatOffset: 20.0, duration: beat * 0.8 },
      { freq: 587.33, beatOffset: 21.0, duration: beat * 0.8 },
      { freq: 523.25, beatOffset: 22.0, duration: beat * 1.6 },
      // Bar 7 (24..28)
      { freq: 440.00, beatOffset: 24.0, duration: beat * 0.8 },
      { freq: 493.88, beatOffset: 25.0, duration: beat * 0.8 },
      { freq: 523.25, beatOffset: 26.0, duration: beat * 1.6 },
      // Bar 8 (28..32)
      { freq: 587.33, beatOffset: 28.0, duration: beat * 1.0 },
      { freq: 523.25, beatOffset: 29.5, duration: beat * 1.0 },
      { freq: 440.00, beatOffset: 31.0, duration: beat * 0.9 },
    ];

    // Bass line (triangle wave, driving 8-bar root bass)
    const bass: { freq: number; beatOffset: number; duration: number }[] = [];
    const roots = [110.00, 110.00, 130.81, 146.83, 110.00, 110.00, 146.83, 164.81]; // A2, A2, C3, D3, A2, A2, D3, E3
    for (let bar = 0; bar < 8; bar++) {
      const root = roots[bar];
      for (let b = 0; b < 4; b++) {
        bass.push({
          freq: b % 2 === 0 ? root : root * 1.5,
          beatOffset: bar * 4 + b,
          duration: beat * 0.5,
        });
      }
    }

    for (const note of melody) {
      const noteTime = start + note.beatOffset * beat;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, noteTime);
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + note.duration);
      this.activeMusicNodes.push({ osc, gain });
    }

    for (const note of bass) {
      const noteTime = start + note.beatOffset * beat;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, noteTime);
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + note.duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + note.duration);
      this.activeMusicNodes.push({ osc, gain });
    }

    const totalSeconds = 32 * beat;
    this.musicTimeout = setTimeout(() => {
      if (this.currentTheme === 'fight') {
        this.activeMusicNodes = [];
        this.scheduleFightTheme();
      }
    }, totalSeconds * 1000);
  }

  // --- STINGS AND JINGLES ---

  playBell() {
    this.playTone(1200, 'sine', 0.6, 0, 0.3);
    this.playTone(1205, 'sine', 0.6, 0, 0.2);
  }

  playCountTick() {
    this.playTone(320, 'square', 0.12, 0, 0.2);
    this.playTone(480, 'square', 0.08, 0.06, 0.15);
  }

  playVictoryJingle() {
    this.stopMusic();
    const notes = [
      { freq: 523.25, time: 0 },
      { freq: 659.25, time: 0.1 },
      { freq: 783.99, time: 0.2 },
      { freq: 1046.50, time: 0.35 },
      { freq: 783.99, time: 0.5 },
      { freq: 1046.50, time: 0.65 },
    ];
    for (const n of notes) {
      this.playTone(n.freq, 'square', 0.18, n.time, 0.15);
    }
    this.playTone(523.25, 'triangle', 1.2, 0.8, 0.2);
    this.playTone(659.25, 'triangle', 1.2, 0.8, 0.2);
    this.playTone(1046.50, 'triangle', 1.2, 0.8, 0.25);
  }

  playDefeatJingle() {
    this.stopMusic();
    const notes = [
      { freq: 440.00, time: 0 },
      { freq: 415.30, time: 0.2 },
      { freq: 392.00, time: 0.4 },
      { freq: 329.63, time: 0.65 },
    ];
    for (const n of notes) {
      this.playTone(n.freq, 'sawtooth', 0.25, n.time, 0.12);
    }
  }

  // --- SFX ---

  playSwing() {
    this.playNoise(0.15, 1200, 0.1);
  }

  playDodge() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playHit(type: 'HEAD' | 'BODY' | 'BLOCK') {
    if (type === 'BLOCK') {
      this.playTone(150, 'square', 0.05, 0, 0.1);
      this.playNoise(0.05, 800, 0.05);
      return;
    }
    if (type === 'HEAD') {
      this.playTone(200, 'sawtooth', 0.1, 0, 0.15);
      this.playNoise(0.15, 3000, 0.2);
    } else {
      this.playTone(60, 'square', 0.2, 0, 0.2);
      this.playNoise(0.2, 500, 0.25);
    }
  }

  playGrunt(isOpponent: boolean) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const pitch = isOpponent ? 80 : 150;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.linearRampToValueAtTime(pitch - 20, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCrowd(intensity: 'LOW' | 'HIGH') {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const duration = intensity === 'HIGH' ? 1.5 : 0.8;
    const vol = intensity === 'HIGH' ? 0.15 : 0.08;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.start(t);
    source.stop(t + duration);
  }

  playStarPunch() {
    this.playTone(587.33, 'triangle', 0.1, 0, 0.2);
    this.playTone(880.0, 'sawtooth', 0.3, 0.08, 0.3);
    this.playNoise(0.3, 2500, 0.25);
  }

  playStarEarned() {
    this.playTone(987.77, 'square', 0.08, 0, 0.15);
    this.playTone(1318.51, 'square', 0.2, 0.08, 0.2);
  }

  playExhausted() {
    this.playTone(180, 'sawtooth', 0.2, 0, 0.1);
    this.playTone(120, 'sawtooth', 0.3, 0.15, 0.1);
  }

  // Backward compatibility aliases if any hook calls them
  playMenuTheme() {
    this.playTitleTheme();
  }

  stopMenuTheme() {
    this.stopMusic();
  }

  playReady() {
    this.playTone(300, 'square', 0.1, 0);
    this.playTone(400, 'square', 0.3, 0.2);
  }

  playFight() {
    this.playTone(600, 'sawtooth', 0.1, 0);
    this.playTone(800, 'square', 0.4, 0);
    this.playNoise(0.5, 2000, 0.2);
  }

  playStart() {
    this.playTone(440, 'square', 0.1, 0);
    this.playTone(554, 'square', 0.1, 0.1);
    this.playTone(659, 'square', 0.1, 0.2);
    this.playTone(880, 'square', 0.4, 0.3);
  }

  playCount(count: number) {
    this.playCountTick();
  }

  playKO() {
    this.playVictoryJingle();
  }

  playEntrance(characterId: string) {
    switch (characterId) {
      case 'aint_man':
        this.playTone(65.41, 'square', 0.4, 0.5);
        this.playTone(65.41, 'square', 0.4, 1.0);
        this.playTone(98.0, 'sawtooth', 0.4, 1.5);
        this.playTone(65.41, 'square', 0.8, 2.0);
        break;
      case 'medi_jinx':
        for (let i = 0; i < 8; i++) {
          this.playTone(1046.5 + i * 100, 'triangle', 0.1, 0.5 + i * 0.15);
        }
        break;
      case 'dj_tito':
        for (let i = 0; i < 4; i++) {
          this.playTone(60, 'sine', 0.1, 0.5 + i * 0.5, 0.3);
          this.playNoise(0.05, 4000, 0.05, 0.5 + i * 0.5 + 0.25);
        }
        break;
      case 'mr_yankee':
        this.playTone(392.0, 'sawtooth', 0.2, 0.5);
        this.playTone(523.25, 'sawtooth', 0.2, 0.8);
        this.playTone(659.25, 'sawtooth', 0.2, 1.1);
        this.playTone(783.99, 'sawtooth', 0.6, 1.4);
        break;
      case 'maga_man':
        this.playTone(110.0, 'sawtooth', 0.6, 0.5);
        this.playTone(110.0, 'sawtooth', 0.6, 1.2);
        this.playTone(130.81, 'sawtooth', 0.6, 1.9);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();

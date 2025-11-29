
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  init() {
    if (this.initialized) return;
    
    // Initialize Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.2; // Master Volume
    this.masterGain.connect(this.ctx.destination);
    
    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- SYNTHESIS HELPERS ---

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, volume: number = 0.1) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + startTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    // Envelope (ADSR-ish)
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration); // Decay
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(t);
    osc.stop(t + duration);
  }

  private createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoise(duration: number, filterFreq: number = 1000, volume: number = 0.1) {
      if (!this.ctx || !this.masterGain) return;
      const buffer = this.createNoiseBuffer();
      if (!buffer) return;

      const t = this.ctx.currentTime;
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

  // --- GAME SFX ---

  playSwing() {
      // White noise sweep (Whoosh)
      this.playNoise(0.15, 1200, 0.1);
  }

  playDodge() {
      // Quick pitch bend
      if (!this.ctx || !this.masterGain) return;
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
          // Short metallic click
          this.playTone(150, 'square', 0.05, 0, 0.1);
          this.playNoise(0.05, 800, 0.05);
          return;
      }

      if (type === 'HEAD') {
          // High pitch smack + noise
          this.playTone(200, 'sawtooth', 0.1, 0, 0.15);
          this.playNoise(0.15, 3000, 0.2); // Snap noise
      } else {
          // Low pitch thud + noise
          this.playTone(60, 'square', 0.2, 0, 0.2);
          this.playNoise(0.2, 500, 0.25); // Thud noise
      }
  }

  playGrunt(isOpponent: boolean) {
      // Synthesis of a voice-like sound using filtered sawtooth
      if (!this.ctx || !this.masterGain) return;
      
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
      // Long noise burst with bandpass
      if (!this.ctx || !this.masterGain) return;
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

  playStart() {
      // 8-bit "Round Start" Jingle
      const t = 0;
      this.playTone(440, 'square', 0.1, t);       // A4
      this.playTone(554, 'square', 0.1, t + 0.1); // C#5
      this.playTone(659, 'square', 0.1, t + 0.2); // E5
      this.playTone(880, 'square', 0.4, t + 0.3); // A5
  }

  playKO() {
      // 8-bit "Victory" Jingle (Arpeggio)
      const now = 0;
      const notes = [
          523.25, 659.25, 783.99, // C E G
          1046.50, 783.99, 659.25, // C G E
          523.25, 392.00, 261.63 // C G C
      ];
      
      notes.forEach((freq, i) => {
          this.playTone(freq, 'square', 0.1, now + (i * 0.08));
      });
      // Final Chord
      setTimeout(() => {
          this.playTone(523.25, 'triangle', 1.5, 0, 0.2);
          this.playTone(659.25, 'triangle', 1.5, 0, 0.2);
          this.playTone(783.99, 'triangle', 1.5, 0, 0.2);
      }, notes.length * 80);
  }
}

export const soundEngine = new SoundEngine();

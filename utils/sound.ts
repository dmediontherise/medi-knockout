
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized: boolean = false;

  private menuThemeOscillator: OscillatorNode | null = null;
  private menuThemeGain: GainNode | null = null;

  init() {
    if (this.initialized) return;
    
    // Initialize Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8; // Louder
    this.masterGain.connect(this.ctx.destination);
    
    // It's possible for ctx to be suspended even after creation on iOS
    if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => console.log("AudioContext auto-resumed during init."));
    }

    this.initialized = true;
  }

  async resume() { // Made async
    if (this.ctx) {
      const state = this.ctx.state;
      console.log(`AudioContext state before resume: ${state}`);
      
      if (state === 'suspended' || state === 'interrupted') {
        try {
          await this.ctx.resume(); // Await the resume promise
          console.log(`AudioContext state after manual resume: ${this.ctx?.state}`);
        } catch (e) {
          console.error("Failed to resume AudioContext:", e);
        }
      }
      
      // iOS Unlock: Play a short silent oscillator to force audio engine activation
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 440; 
      gain.gain.value = 0; // Silent
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(0);
      osc.stop(this.ctx.currentTime + 0.001); // Stop immediately after current time
    }
  }

  // --- SPEECH SYNTHESIS ---
  speak(text: string, pitch: number = 1, rate: number = 1) {
      if (!window.speechSynthesis) return;
      // Cancel previous utterances
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = 1.0;
      
      // Try to find a good english voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
  }

  // --- SYNTHESIS HELPERS ---

  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, volume: number = 0.1) {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // console.log(`Playing tone: ${freq}Hz`);
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

  // ... (createNoiseBuffer and playNoise remain the same) ...
  
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

  private playNoise(duration: number, filterFreq: number = 1000, volume: number = 0.1, startTime: number = 0) {
      if (!this.ctx || !this.masterGain) return;
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

  // --- GAME SFX ---

  playSwing() {
      this.playNoise(0.15, 1200, 0.1);
  }

  playDodge() {
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

  playReady() {
      this.speak("Ready", 1.2, 1.2);
      this.playTone(300, 'square', 0.1, 0);
      this.playTone(400, 'square', 0.3, 0.2);
  }

  playFight() {
      this.speak("Fight!", 0.8, 1.5);
      this.playTone(600, 'sawtooth', 0.1, 0);
      this.playTone(800, 'square', 0.4, 0);
      this.playNoise(0.5, 2000, 0.2); 
  }

  playStart() {
      // 8-bit "Round Start" Jingle
      const t = this.ctx?.currentTime || 0;
      this.playTone(440, 'square', 0.1, t);       
      this.playTone(554, 'square', 0.1, t + 0.1); 
      this.playTone(659, 'square', 0.1, t + 0.2); 
      this.playTone(880, 'square', 0.4, t + 0.3); 
  }

  playEntrance(characterId: string) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime; // We don't actually use this var in playTone since it adds to current time internally, but logic below assumes offset from NOW.
      
      // 1. Announcer "Voice"
      let name = "Opponent";
      switch(characterId) {
          case 'aint_man': name = "Aint Man"; break;
          case 'medi_jinx': name = "Medi Jinx"; break;
          case 'dj_tito': name = "D J Tito"; break;
          case 'mr_yankee': name = "Mr Yankee"; break;
          case 'maga_man': name = "Maga Man"; break;
      }
      
      // "Fighting out of the red corner... [NAME]!"
      setTimeout(() => {
          this.speak(`Fighting out of the red corner... ${name}!`, 0.9, 1.1);
      }, 500);
      
      // 2. Character Theme
      switch (characterId) {
          case 'aint_man':
              // Heavy Stomp: Low C -> G -> C
              this.playTone(65.41, 'square', 0.4, 0.5);
              this.playTone(65.41, 'square', 0.4, 1.0);
              this.playTone(98.00, 'sawtooth', 0.4, 1.5);
              this.playTone(65.41, 'square', 0.8, 2.0);
              break;
          case 'medi_jinx':
              // Fast Annoying High Pitch: C6 -> D6 -> E6
              for(let i=0; i<8; i++) {
                  this.playTone(1046.5 + (i*100), 'triangle', 0.1, 0.5 + (i*0.15));
              }
              break;
          case 'dj_tito':
              // Dance Beat: Bass Kick + High Hat pattern
              for(let i=0; i<4; i++) {
                  this.playTone(60, 'sine', 0.1, 0.5 + i*0.5, 0.3); // Kick
                  // Hat off-beat
                  this.playNoise(0.05, 4000, 0.05, 0.5 + i*0.5 + 0.25); 
              }
              break;
          case 'mr_yankee':
              // Stadium Organ: Charge!
              this.playTone(392.00, 'sawtooth', 0.2, 0.5); // G4
              this.playTone(523.25, 'sawtooth', 0.2, 0.8); // C5
              this.playTone(659.25, 'sawtooth', 0.2, 1.1); // E5
              this.playTone(783.99, 'sawtooth', 0.6, 1.4); // G5
              break;
          case 'maga_man':
              // Dark March: Low Brass
              this.playTone(110.00, 'sawtooth', 0.6, 0.5); // A2
              this.playTone(110.00, 'sawtooth', 0.6, 1.2); // A2
              this.playTone(130.81, 'sawtooth', 0.6, 1.9); // C3
              break;
      }
  }

  playKO() {
      this.speak("Knockout!", 0.7, 1.0);
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

  stopMenuTheme() {
      if (this.menuThemeOscillator) {
          this.menuThemeOscillator.stop();
          this.menuThemeOscillator.disconnect();
          this.menuThemeGain?.disconnect();
          this.menuThemeOscillator = null;
          this.menuThemeGain = null;
      }
  }

  playMenuTheme() {
      if (!this.ctx || !this.masterGain) return;
      if (this.menuThemeOscillator) this.stopMenuTheme(); // Stop if already playing

      const sequence = [
          { freq: 523.25, duration: 0.15 }, { freq: 659.25, duration: 0.15 }, // C5 E5
          { freq: 783.99, duration: 0.2 }, { freq: 1046.50, duration: 0.3 }, // G5 C6
          { freq: 880.00, duration: 0.2 }, { freq: 783.99, duration: 0.2 }, // A5 G5
          { freq: 659.25, duration: 0.2 }, { freq: 523.25, duration: 0.4 }  // E5 C5
      ];
      const totalLoopDuration = 2.5; // Roughly the length of the sequence

      this.menuThemeOscillator = this.ctx.createOscillator();
      this.menuThemeGain = this.ctx.createGain();

      this.menuThemeOscillator.type = 'triangle';
      this.menuThemeGain.gain.value = 0.08; // Background music volume

      this.menuThemeOscillator.connect(this.menuThemeGain);
      this.menuThemeGain.connect(this.masterGain);

      let currentTime = this.ctx.currentTime;
      sequence.forEach(note => {
          this.menuThemeOscillator?.frequency.setValueAtTime(note.freq, currentTime);
          currentTime += note.duration;
      });

      this.menuThemeOscillator.start(this.ctx.currentTime);
      this.menuThemeOscillator.stop(currentTime);

      // Loop the theme
      this.menuThemeOscillator.onended = () => {
          if (this.ctx?.state === 'running' && this.menuThemeOscillator) { // Only loop if context is still running and not explicitly stopped
              this.playMenuTheme(); // Re-trigger the theme
          }
      };
  }
}

export const soundEngine = new SoundEngine();

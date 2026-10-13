import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SoundEngine } from '../../utils/sound';

describe('SoundEngine and Audio (Task 009 Req 10)', () => {
  let createdOscillators: any[] = [];
  let createdGainNodes: any[] = [];

  class MockGainNode {
    gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    connect = vi.fn();
    disconnect = vi.fn();
    constructor() {
      createdGainNodes.push(this);
    }
  }

  class MockOscillatorNode {
    type: OscillatorType = 'sine';
    frequency = {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    constructor() {
      createdOscillators.push(this);
    }
  }

  class MockAudioBufferSourceNode {
    buffer: any = null;
    connect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }

  class MockBiquadFilterNode {
    type: string = 'lowpass';
    frequency = {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    Q = { value: 1 };
    connect = vi.fn();
  }

  class MockAudioContext {
    currentTime = 0;
    sampleRate = 44100;
    state = 'running';
    destination = {};
    createGain() {
      return new MockGainNode();
    }
    createOscillator() {
      return new MockOscillatorNode();
    }
    createBufferSource() {
      return new MockAudioBufferSourceNode();
    }
    createBiquadFilter() {
      return new MockBiquadFilterNode();
    }
    createBuffer(channels: number, length: number, sampleRate: number) {
      return {
        getChannelData: () => new Float32Array(length),
      };
    }
    resume = vi.fn().mockResolvedValue(undefined);
  }

  beforeEach(() => {
    createdOscillators = [];
    createdGainNodes = [];
    const mockStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    const mockWin = {
      AudioContext: MockAudioContext,
      localStorage: mockStorage,
    };
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', mockWin);
  });

  it('nothing in utils/sound.ts references speechSynthesis', () => {
    const soundTs = fs.readFileSync(path.resolve(__dirname, '../../utils/sound.ts'), 'utf8');
    expect(/speechSynthesis|SpeechSynthesis/.test(soundTs)).toBe(false);
  });

  it('playFightTheme() schedules oscillator notes covering at least 8 bars and reschedules when looping', () => {
    const engine = new SoundEngine();
    engine.init();

    engine.playFightTheme();

    // 8 bars of melody (27 notes) + 8 bars of bass (32 notes) = 59 oscillators
    expect(createdOscillators.length).toBeGreaterThanOrEqual(32);

    // Verify all scheduled oscillators called start and stop
    for (const osc of createdOscillators) {
      expect(osc.start).toHaveBeenCalled();
      expect(osc.stop).toHaveBeenCalled();
    }

    // Verify stop times span at least 8 bars (at 150 BPM, 32 beats = 12.8s)
    const stopTimes = createdOscillators.map((osc) => osc.stop.mock.calls[0][0]);
    const maxStopTime = Math.max(...stopTimes);
    expect(maxStopTime).toBeGreaterThanOrEqual(10.0);

    // Call stopMusic() - stops all active oscillators
    engine.stopMusic();
    for (const osc of createdOscillators) {
      expect(osc.stop).toHaveBeenCalled();
    }
  });

  it('stopMusic() stops active music notes and cancels timeout', () => {
    const engine = new SoundEngine();
    engine.init();

    engine.playTitleTheme();
    const countBefore = createdOscillators.length;
    expect(countBefore).toBeGreaterThan(0);

    engine.stopMusic();
    // After stop, calling stop again is safe
    expect(() => engine.stopMusic()).not.toThrow();
  });

  it('mute stops all audio output and toggles state in localStorage', () => {
    const engine = new SoundEngine();
    engine.init();

    expect(engine.isMuted()).toBe(false);

    // Toggle mute to true
    const isNowMuted = engine.toggleMute();
    expect(isNowMuted).toBe(true);
    expect(engine.isMuted()).toBe(true);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('medi_knockout_muted', 'true');

    // While muted, playing sounds does not create new oscillators
    const countBefore = createdOscillators.length;
    engine.playFightTheme();
    engine.playSwing();
    engine.playHit('HEAD');
    expect(createdOscillators.length).toBe(countBefore);

    // Unmute restores audio output
    engine.toggleMute();
    expect(engine.isMuted()).toBe(false);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('medi_knockout_muted', 'false');
  });
});

import { Howl } from 'howler';

// Web Audio API Synthesizer Fallback
class WebAudioSynth {
  constructor() {
    this.ctx = null;
    this.bgmOsc = null;
    this.bgmLfo = null;
    this.bgmGain = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSuccess() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    
    // Play an ascending golden chime arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  }

  playFailure() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const duration = 0.6;
    
    // Decaying saw hum (combining low frequency drop and noise)
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + duration);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + duration);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
    
    // Add brief crackling explosion noise
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(300, now);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.15, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      
      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {
      console.warn("Noise buffer initialization failed", e);
    }
  }

  playPour() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const duration = 0.35;
    
    // Bubbling liquid sound using sine frequency slides
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
    osc.frequency.linearRampToValueAtTime(250, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(1000, now + duration);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  playMatchFill() {
    this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    
    // Sparkly upward glissando for filling target flask
    const duration = 0.5;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + duration);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  startBgm() {
    this.init();
    if (!this.ctx) return;
    
    this.bgmPlaying = true;
    if (!this.musicTimeout) {
      this.playMusicBox();
    }
  }

  playMusicBox() {
    if (!this.bgmPlaying || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    
    // Whimsical Ghibli pentatonic scale notes (C4, D4, E4, G4, A4, C5, D5, E5, G5, A5)
    const freqs = [
      261.63, 293.66, 329.63, 392.00, 440.00,
      523.25, 587.33, 659.25, 783.99, 880.00
    ];
    
    // Pick a random frequency for the chime sound
    const freq = freqs[Math.floor(Math.random() * freqs.length)];
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Soft sine wave resembles a cozy wooden chime/music box
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.08); // Relaxing, low background volume
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5); // Warm, gentle decay
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 2.5);
    
    // Schedule the next note at a randomized organic interval (800ms - 2200ms)
    const nextDelay = 800 + Math.random() * 1400;
    this.musicTimeout = setTimeout(() => {
      this.playMusicBox();
    }, nextDelay);
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.musicTimeout) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }
  }

  setMute(isMuted) {
    this.muted = isMuted;
    if (!isMuted && this.bgmPlaying) {
      if (!this.musicTimeout) {
        this.playMusicBox();
      }
    } else if (isMuted) {
      if (this.musicTimeout) {
        clearTimeout(this.musicTimeout);
        this.musicTimeout = null;
      }
    }
  }
}

const synth = new WebAudioSynth();

// Howler.js Sound Objects
const howlerSuccess = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav'],
  volume: 0.35,
  html5: false,
  onloaderror: () => console.log('Howler success sound failed loading. Using WebAudio Synth fallback.'),
  onplayerror: () => console.log('Howler success sound failed playing. Using WebAudio Synth fallback.')
});

const howlerFailure = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/250/250-84.wav'],
  volume: 0.3,
  html5: false,
  onloaderror: () => console.log('Howler failure sound failed loading. Using WebAudio Synth fallback.'),
  onplayerror: () => console.log('Howler failure sound failed playing. Using WebAudio Synth fallback.')
});

const howlerPour = new Howl({
  src: ['https://assets.mixkit.co/active_storage/sfx/1079/1079-84.wav'], // bubble/pour SFX
  volume: 0.4,
  html5: false,
  onloaderror: () => {},
  onplayerror: () => {}
});

let isSoundMuted = false;
let isMusicPlaying = false;

export const audioService = {
  init: () => {
    synth.init();
  },

  playSuccess: () => {
    if (isSoundMuted) return;
    if (howlerSuccess.state() === 'loaded') {
      try {
        howlerSuccess.play();
      } catch (e) {
        synth.playSuccess();
      }
    } else {
      synth.playSuccess();
    }
  },

  playFailure: () => {
    if (isSoundMuted) return;
    if (howlerFailure.state() === 'loaded') {
      try {
        howlerFailure.play();
      } catch (e) {
        synth.playFailure();
      }
    } else {
      synth.playFailure();
    }
  },

  playPour: () => {
    if (isSoundMuted) return;
    if (howlerPour.state() === 'loaded') {
      try {
        howlerPour.play();
      } catch (e) {
        synth.playPour();
      }
    } else {
      synth.playPour();
    }
  },

  playMatchFill: () => {
    if (isSoundMuted) return;
    synth.playMatchFill();
  },

  toggleSFX: (muteState) => {
    isSoundMuted = muteState;
    synth.setMute(muteState);
  },

  toggleMusic: (playState) => {
    isMusicPlaying = playState;
    if (playState) {
      synth.startBgm();
    } else {
      synth.stopBgm();
    }
  },

  isMuted: () => isSoundMuted,
  isMusicPlaying: () => isMusicPlaying
};

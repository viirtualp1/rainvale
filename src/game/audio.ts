export type SoundId = 'chop' | 'stone' | 'pick' | 'step' | 'place' | 'remove' | 'craft' | 'tool' | 'visitor' | 'event' | 'plant' | 'harvest' | 'select';
export type DayPart = 'morning' | 'day' | 'evening' | 'night';

export interface Volumes {
  master: number;
  ambience: number;
  music: number;
  sfx: number;
}

const SCALES: Record<DayPart, number[]> = {
  morning: [523.25, 587.33, 659.25, 783.99, 880, 1046.5],
  day: [392, 440, 523.25, 587.33, 659.25, 783.99],
  evening: [329.63, 392, 440, 493.88, 587.33, 659.25],
  night: [220, 261.63, 293.66, 329.63, 392, 440]
};

const NOTE_GAP: Record<DayPart, number> = { morning: 1.4, day: 1.9, evening: 2.4, night: 3.4 };

interface DropSpec {
  density: number;
  bigChance: number;
  smallFreq: [number, number];
  bigFreq: [number, number];
  smallAmp: number;
  bigAmp: number;
}

// Rain is thousands of tiny decaying taps, not filtered noise: filtered noise reads as a fan.
function rainBuffer (ac: AudioContext, seconds: number, spec: DropSpec) {
  const sr = ac.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ac.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    const count = Math.floor(seconds * spec.density);

    for (let k = 0; k < count; k++) {
      const big = Math.random() < spec.bigChance;
      const start = Math.floor(Math.random() * len);
      const dur = big ? .015 + Math.random() * .03 : .002 + Math.random() * .006;
      const [f0, f1] = big ? spec.bigFreq : spec.smallFreq;
      const freq = f0 + Math.random() * (f1 - f0);
      const amp = big ? spec.bigAmp * (.4 + Math.random() * .6) : spec.smallAmp * (.15 + Math.random() ** 3 * .85);
      const n = Math.floor(dur * sr);
      const tau = n / 4;
      const glide = big ? 1.6 : 1;

      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = freq * (1 + (glide - 1) * (i / n));
        const tone = Math.sin(2 * Math.PI * f * t) * .65 + (Math.random() * 2 - 1) * .35;
        data[(start + i) % len] += tone * amp * Math.exp(-i / tau);
      }
    }
  }

  return buf;
}

export class Sound {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private volumes: Volumes = { master: .8, ambience: .8, music: .6, sfx: .8 };
  private volumeKey = '';
  private patterGain: GainNode | null = null;
  private plopGain: GainNode | null = null;
  private hissGain: GainNode | null = null;
  private patterFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer = 2;
  private critterTimer = 4;
  muted = false;

  init () {
    if (this.ac) {
      if (this.ac.state === 'suspended') {
        void this.ac.resume();
      }

      return;
    }

    try {
      const ac = new AudioContext();
      const master = ac.createGain();
      const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const nd = noise.getChannelData(0);

      for (let i = 0; i < nd.length; i++) {
        nd[i] = Math.random() * 2 - 1;
      }

      master.gain.value = this.muted ? 0 : this.volumes.master;
      master.connect(ac.destination);

      this.ac = ac;
      this.master = master;
      this.noise = noise;
      this.ambienceBus = this.bus(this.volumes.ambience);
      this.musicBus = this.bus(this.volumes.music);
      this.sfxBus = this.bus(this.volumes.sfx);

      const patter = rainBuffer(ac, 6, { density: 1500, bigChance: 0, smallFreq: [2400, 7500], bigFreq: [0, 0], smallAmp: .22, bigAmp: 0 });
      const plops = rainBuffer(ac, 7.3, { density: 70, bigChance: .7, smallFreq: [1800, 4000], bigFreq: [500, 1300], smallAmp: .2, bigAmp: .32 });

      this.patterFilter = ac.createBiquadFilter();
      this.patterFilter.type = 'lowpass';
      this.patterFilter.frequency.value = 6000;
      this.patterGain = this.loop(patter, [this.patterFilter]);
      this.plopGain = this.loop(plops, []);

      const hp = ac.createBiquadFilter();
      const lp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      lp.type = 'lowpass';
      lp.frequency.value = 9000;
      this.hissGain = this.loop(noise, [hp, lp]);
      this.hissGain.gain.value = .015;
    } catch (error) {
      console.warn('Audio is not available', error);
    }
  }

  private bus (level: number) {
    const ac = this.ac as AudioContext;
    const gain = ac.createGain();

    gain.gain.value = level;
    gain.connect(this.master as GainNode);

    return gain;
  }

  setVolumes (v: Volumes) {
    const key = `${v.master}|${v.ambience}|${v.music}|${v.sfx}`;

    if (key === this.volumeKey) {
      return;
    }

    this.volumeKey = key;
    this.volumes = { master: v.master, ambience: v.ambience, music: v.music, sfx: v.sfx };

    if (!this.ac || !this.master || !this.ambienceBus || !this.musicBus || !this.sfxBus) {
      return;
    }

    const now = this.ac.currentTime;

    this.master.gain.setTargetAtTime(this.muted ? 0 : v.master, now, .05);
    this.ambienceBus.gain.setTargetAtTime(v.ambience, now, .05);
    this.musicBus.gain.setTargetAtTime(v.music, now, .05);
    this.sfxBus.gain.setTargetAtTime(v.sfx, now, .05);
  }

  private loop (buffer: AudioBuffer, chain: AudioNode[]) {
    const ac = this.ac as AudioContext;
    const src = ac.createBufferSource();
    const gain = ac.createGain();
    let node: AudioNode = src;

    src.buffer = buffer;
    src.loop = true;

    for (const next of chain) {
      node.connect(next);
      node = next;
    }

    node.connect(gain).connect(this.ambienceBus as GainNode);
    src.start(0, Math.random() * buffer.duration);

    return gain;
  }

  setMuted (muted: boolean) {
    this.muted = muted;

    if (this.master && this.ac) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volumes.master, this.ac.currentTime, .1);
    }
  }

  update (dt: number, rain: number, part: DayPart) {
    if (!this.ac || !this.patterGain || !this.plopGain || !this.hissGain || !this.patterFilter) {
      return;
    }

    const now = this.ac.currentTime;

    this.patterGain.gain.setTargetAtTime(.25 + rain * .55, now, 1);
    this.plopGain.gain.setTargetAtTime(.35 + rain * .3, now, 1);
    this.hissGain.gain.setTargetAtTime(.006 + rain * .02, now, 1);
    this.patterFilter.frequency.setTargetAtTime(3500 + rain * 4000, now, 1);

    this.critterTimer -= dt;

    if (this.critterTimer <= 0) {
      this.critterTimer = 3 + Math.random() * 6;
      this.critter(part);
    }

    this.musicTimer -= dt;

    if (this.musicTimer > 0) {
      return;
    }

    const scale = SCALES[part];
    const note = scale[Math.floor(Math.random() * scale.length)];

    this.musicTimer = NOTE_GAP[part] + Math.random() * 1.6;
    this.pluck(note, part === 'night' ? .035 : .045, 0, part === 'night' ? 2.6 : 1.6, this.musicBus);

    if (Math.random() < .3) {
      this.pluck(note * (part === 'evening' || part === 'night' ? 1.2 : 1.5), .022, .2, 1.4, this.musicBus);
    }
  }

  private critter (part: DayPart) {
    if (part === 'morning' || (part === 'day' && Math.random() < .35)) {
      const base = 2400 + Math.random() * 1600;
      const notes = 2 + Math.floor(Math.random() * 4);

      for (let i = 0; i < notes; i++) {
        this.tone(base * (1 + (i % 2) * .18), base * 1.25, .07, 'sine', .03, i * .11, this.ambienceBus);
      }

      return;
    }

    if (part === 'evening' || part === 'night') {
      for (let i = 0; i < 6; i++) {
        this.tone(4300, 4300, .025, 'sine', .012, i * .06 + (i > 2 ? .15 : 0), this.ambienceBus);
      }

      if (part === 'night' && Math.random() < .5) {
        for (let i = 0; i < 3; i++) {
          this.tone(150, 110, .06, 'sawtooth', .03, .6 + i * .09, this.ambienceBus);
        }
      }
    }
  }

  play (id: SoundId) {
    if (!this.ac || this.muted) {
      return;
    }

    switch (id) {
      case 'chop':
        this.burst(.08, 650, 3, .4);
        this.tone(240, 130, .09, 'triangle', .2);
        break;
      case 'stone':
        this.burst(.05, 2600, 6, .3);
        this.tone(1250, 1050, .06, 'sine', .07);
        break;
      case 'pick':
        this.tone(520, 900, .07, 'sine', .09);
        break;
      case 'step':
        this.burst(.05, 900, 1.2, .08);
        break;
      case 'place':
        this.burst(.08, 500, 2, .25);
        this.tone(200, 150, .08, 'triangle', .14);
        break;
      case 'remove':
        this.tone(300, 500, .1, 'triangle', .1);
        break;
      case 'select':
        this.tone(880, 880, .05, 'triangle', .05);
        break;
      case 'craft':
        [523, 659, 784].forEach((f, i) => this.pluck(f, .07, i * .07, 1.2));
        break;
      case 'tool':
        [523, 659, 784, 1047].forEach((f, i) => this.pluck(f, .08, i * .08, 1.4));
        break;
      case 'visitor':
        [659, 784, 1047].forEach((f, i) => this.pluck(f, .08, i * .11, 1.4));
        break;
      case 'event':
        this.pluck(880, .05, 0, 1.4);
        break;
      case 'plant':
        this.burst(.12, 400, 1, .2);
        this.tone(330, 440, .1, 'sine', .07);
        break;
      case 'harvest':
        [440, 587].forEach((f, i) => this.pluck(f, .07, i * .08, 1.2));
        break;
    }
  }

  private pluck (freq: number, vol: number, delay: number, dur: number, dest: AudioNode | null = this.sfxBus) {
    this.tone(freq, freq, dur, 'triangle', vol, delay, dest);
    this.tone(freq * 2, freq * 2, dur * .4, 'sine', vol * .25, delay, dest);
  }

  private tone (f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0, dest: AudioNode | null = this.sfxBus) {
    if (!this.ac || !dest || this.muted) {
      return;
    }

    const t = this.ac.currentTime + delay;
    const osc = this.ac.createOscillator();
    const gain = this.ac.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + .005);
    gain.gain.exponentialRampToValueAtTime(.0005, t + dur);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + dur + .02);
  }

  private burst (dur: number, freq: number, q: number, vol: number) {
    if (!this.ac || !this.sfxBus || !this.noise) {
      return;
    }

    const t = this.ac.currentTime;
    const src = this.ac.createBufferSource();
    const filter = this.ac.createBiquadFilter();
    const gain = this.ac.createGain();

    src.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t, Math.random() * .5);
    src.stop(t + dur + .02);
  }
}

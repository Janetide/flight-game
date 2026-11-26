// Synthesized sound: no audio files, everything is an oscillator or a noise
// buffer built in code. The engine hum follows the throttle, the wind rises
// with speed, and events get their own short tones. Audio only starts after
// the player first presses a key or clicks, as browsers require.

export function createAudio() {
  const audio = {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,
  };

  function ensure() {
    if (audio.started) return;
    try {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audio.ctx = ctx;
      // Engine: two detuned sawtooth oscillators through a low-pass filter.
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 70;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 71.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      audio.engineOsc = osc1;
      audio.engineOsc2 = osc2;
      audio.engineGain = gain;
      // Wind: looped white noise through a band-pass filter.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 600;
      band.Q.value = 0.6;
      const windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(band);
      band.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
      audio.windGain = windGain;
      audio.started = true;
    } catch {
      // No audio in this browser: the game plays silent, never crashes.
      audio.started = false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!audio.ctx || audio.muted) return;
    try {
      const t = audio.ctx.currentTime + when;
      const osc = audio.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(audio.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      // Ignore audio errors entirely.
    }
  }

  return {
    /** Call from any user gesture; safe to call often. */
    unlock() {
      ensure();
      if (audio.ctx && audio.ctx.state === 'suspended') {
        audio.ctx.resume().catch(() => {});
      }
    },
    /** Continuous engine and wind, called every frame with the plane. */
    update(plane) {
      if (!audio.started || audio.muted || !audio.ctx) return;
      const on = plane.onGround ? plane.speed > 2 : true;
      const target = on ? 0.02 + plane.throttle * 0.05 : 0;
      audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
      const freq = 55 + plane.throttle * 85 + plane.speed * 0.35;
      audio.engineOsc.frequency.setTargetAtTime(freq, audio.ctx.currentTime, 0.1);
      audio.engineOsc2.frequency.setTargetAtTime(freq * 1.015, audio.ctx.currentTime, 0.1);
      const wind = plane.onGround ? 0 : Math.min(0.09, plane.speed * 0.0009);
      audio.windGain.gain.setTargetAtTime(wind, audio.ctx.currentTime, 0.15);
    },
    ring() {
      tone(880, 0.18, 'sine', 0.16);
      tone(1318, 0.28, 'sine', 0.14, 0.09);
    },
    touchdown() {
      tone(220, 0.2, 'triangle', 0.18);
      tone(330, 0.3, 'triangle', 0.12, 0.08);
    },
    takeoff() {
      tone(523, 0.15, 'sine', 0.12);
      tone(784, 0.22, 'sine', 0.12, 0.1);
    },
    crash() {
      tone(110, 0.5, 'sawtooth', 0.2);
      tone(55, 0.8, 'sawtooth', 0.2, 0.1);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.14, i * 0.13));
    },
    warning() {
      tone(440, 0.12, 'square', 0.07);
      tone(440, 0.12, 'square', 0.07, 0.18);
    },
    click() {
      tone(660, 0.06, 'sine', 0.08);
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.engineGain) audio.engineGain.gain.value = 0;
      if (audio.windGain) audio.windGain.gain.value = 0;
      return audio.muted;
    },
  };
}

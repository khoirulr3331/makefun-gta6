// Synthesised sound effects with plain WebAudio: no audio files at all.
// Everything is guarded so a browser without audio never breaks the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineNodes = null;
  let sirenNodes = null;
  let muted = false;
  let unlocked = false; // only true after a real user gesture

  function ensure() {
    if (!unlocked) return false;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish; never let it break play.
    }
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (muted || !ensure()) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 900;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Ignore audio failures.
    }
  }

  return {
    unlock() {
      unlocked = true;
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopSiren();
      return muted;
    },
    // A low engine hum whose pitch follows the car's speed (0..1).
    engine(amount) {
      if (muted || !ensure()) return;
      try {
        if (!engineNodes) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(master);
          osc.start();
          engineNodes = { osc, gain };
        }
        const target = 0.05 + amount * 0.11;
        engineNodes.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineNodes.osc.frequency.setTargetAtTime(55 + amount * 165, ctx.currentTime, 0.08);
      } catch {
        // Ignore.
      }
    },
    engineOff() {
      if (engineNodes) {
        try {
          engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        } catch {
          // Ignore.
        }
      }
    },
    crash() {
      noiseBurst(0.22, 0.7, 500);
      tone(70, 0.25, 'sine', 0.5, 38);
    },
    gunshot() {
      noiseBurst(0.09, 0.8, 2600);
      tone(190, 0.08, 'square', 0.25, 60);
    },
    punch() {
      noiseBurst(0.08, 0.45, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      setTimeout(() => tone(990, 0.14, 'sine', 0.3), 90);
    },
    missionDone() {
      tone(523, 0.12, 'triangle', 0.35);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.35), 120);
      setTimeout(() => tone(784, 0.22, 'triangle', 0.35), 240);
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.3, 110);
    },
    startSiren() {
      if (muted || !ensure() || sirenNodes) return;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 720;
        const lfo = ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        const gain = ctx.createGain();
        gain.gain.value = 0.045;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, lfo, gain };
      } catch {
        // Ignore.
      }
    },
    stopSiren() {
      if (!sirenNodes) return;
      try {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
      } catch {
        // Ignore.
      }
      sirenNodes = null;
    },
  };
}

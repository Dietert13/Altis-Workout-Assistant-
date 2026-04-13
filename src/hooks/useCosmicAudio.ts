import { useCallback, useRef, useEffect } from 'react';

export const useCosmicAudio = () => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const isMutedRef = useRef(false);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterGainRef.current = audioCtxRef.current.createGain();
      masterGainRef.current.connect(audioCtxRef.current.destination);
      masterGainRef.current.gain.value = isMutedRef.current ? 0 : 0.5;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (masterGainRef.current) {
      const now = audioCtxRef.current?.currentTime || 0;
      masterGainRef.current.gain.setTargetAtTime(muted ? 0 : 0.5, now, 0.05);
    }
  }, []);

  const suspendAudio = useCallback(() => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      audioCtxRef.current.suspend();
    }
  }, []);

  const playCrystalPing = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 0.05);
  }, [initAudio]);

  const playDigitalPulse = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 0.01);
  }, [initAudio]);

  const playResonantBeep = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, now);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(660, now);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    filter.Q.setValueAtTime(10, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(filter);
    osc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current!);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.2);
    osc2.stop(now + 0.2);
  }, [initAudio]);

  const playStellarDrone = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.setValueAtTime(0.4, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 1.2);
  }, [initAudio]);

  const playNebulaRise = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);

    pan.pan.setValueAtTime((Math.random() * 0.4) - 0.2, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(pan);
    pan.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 0.3);
  }, [initAudio]);

  const playSupernovaChord = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const frequencies = [440, 587.33, 659.25]; // A4, D5 (4th), E5 (5th)
    const masterChordGain = ctx.createGain();
    masterChordGain.gain.setValueAtTime(0.3, now);
    masterChordGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    frequencies.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(masterChordGain);
      osc.start(now);
      osc.stop(now + 2.0);
    });

    // Shimmer effect (simple delay with feedback)
    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.1, now);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.4, now);

    masterChordGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(masterGainRef.current!);
    masterChordGain.connect(masterGainRef.current!);
  }, [initAudio]);

  const playAtmosphericSwell = useCallback(() => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.25);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);

    osc.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 0.5);
  }, [initAudio]);

  const silenceAll = useCallback(() => {
    if (!audioCtxRef.current || !masterGainRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    // Smoothly silence master gain
    masterGainRef.current.gain.setTargetAtTime(0, now, 0.05);
    
    // Restore gain after a short delay (for future sounds)
    setTimeout(() => {
      if (masterGainRef.current) {
        masterGainRef.current.gain.setValueAtTime(0.5, audioCtxRef.current!.currentTime);
      }
    }, 200);
  }, []);

  const playMetronomeClick = useCallback((time?: number) => {
    initAudio();
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2000, now);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current!);

    osc.start(now);
    osc.stop(now + 0.01);
  }, [initAudio]);

  return {
    initAudio,
    suspendAudio,
    playCrystalPing,
    playDigitalPulse,
    playResonantBeep,
    playStellarDrone,
    playNebulaRise,
    playSupernovaChord,
    playAtmosphericSwell,
    silenceAll,
    playMetronomeClick,
    setMuted
  };
};

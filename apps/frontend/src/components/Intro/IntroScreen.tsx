import React, { useEffect, useMemo } from 'react';
import Wordmark from '../Brand/Wordmark';

interface IntroScreenProps {
  durationMs: number;
  onComplete: () => void;
  soundEnabled?: boolean;
  soundUrl?: string;
  logo?: React.ReactNode;
}

const playTone = async () => {
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: any }).webkitAudioContext;
  if (!AudioCtx) {
    return;
  }
  const context = new AudioCtx();
  try {
    if (context.state === 'suspended') {
      await context.resume();
    }
  } catch {
    // Ignore resume errors
  }

  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);
  osc.frequency.exponentialRampToValueAtTime(330, now + 1.1);

  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 1.2);

  osc.onended = () => {
    gain.disconnect();
    osc.disconnect();
    context.close().catch(() => undefined);
  };
};

const IntroScreen: React.FC<IntroScreenProps> = ({
  durationMs,
  onComplete,
  soundEnabled = true,
  soundUrl,
  logo,
}) => {
  const style = useMemo(() => ({ ['--intro-duration' as string]: `${durationMs}ms` }), [durationMs]);

  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    let audioStarted = false;

    const startAudio = async () => {
      if (!soundEnabled) return;
      if (soundUrl) {
        try {
          audio = new Audio(soundUrl);
          audio.volume = 0.7;
          await audio.play();
          audioStarted = true;
          return;
        } catch {
          // Fall through to tone
        }
      }
      try {
        await playTone();
      } catch {
        // Autoplay blocked, ignore
      }
    };

    startAudio();
    const timer = window.setTimeout(onComplete, durationMs);

    return () => {
      window.clearTimeout(timer);
      if (audio && audioStarted) {
        audio.pause();
        audio = null;
      }
    };
  }, [durationMs, onComplete, soundEnabled, soundUrl]);

  return (
    <div className="intro-screen" style={style}>
      <div className="intro-screen__glow" />
      <div className="intro-screen__logo">{logo || <Wordmark size="lg" />}</div>
    </div>
  );
};

export default IntroScreen;

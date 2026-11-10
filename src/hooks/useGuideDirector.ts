/**
 * useGuideDirector — the "brain" that connects scrolling to the character.
 *
 * It runs one requestAnimationFrame loop that:
 *  1. Watches the Lenis scroll velocity stored in Zustand.
 *  2. FAST SCROLL: if |velocity| passes the threshold in config, it flips
 *     `isFastScrolling` on (the 3D loop then freezes the follow target, so
 *     he lags and swings). After a random 0.8–1.5 s delay he "catches up":
 *     if the scared cooldown allows it, he plays the scared animation and
 *     shouts a random scared line.
 *  3. CALM: after ~2 s of gentle scrolling he relaxes back to the current
 *     section's animation and says the "phew" line once.
 *
 * Section changes themselves are handled separately in App.tsx with GSAP
 * ScrollTrigger — this hook only deals with speed.
 */
import { useEffect } from 'react';
import { BUBBLE, FAST_SCROLL, SECTIONS } from '../config/character';
import { useStore, prefersReducedMotion } from '../store/useStore';

export function useGuideDirector() {
  useEffect(() => {
    if (prefersReducedMotion) return; // no scared shaking for reduced motion

    let raf = 0;
    let fastSince: number | null = null;
    let catchUpAt = 0;
    let caughtUp = false;
    let calmSince: number | null = null;
    let relaxed = true; // true = currently in the calm state
    let lastScaredAt = -Infinity;
    let scaredUntil = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const state = useStore.getState();
      const now = performance.now() / 1000;
      const v = Math.abs(state.scrollVelocity);
      const tooFast = v > FAST_SCROLL.velocityThreshold;

      if (tooFast) {
        calmSince = null;
        if (fastSince === null) {
          fastSince = now;
          caughtUp = false;
          relaxed = false;
          catchUpAt =
            now +
            FAST_SCROLL.catchUpDelayMin +
            Math.random() * (FAST_SCROLL.catchUpDelayMax - FAST_SCROLL.catchUpDelayMin);
          state.setFastScrolling(true);
          state.setMood('swing'); // flailing while being dragged
        } else if (!caughtUp && now >= catchUpAt) {
          // He arrives late — panic!
          caughtUp = true;
          state.setFastScrolling(false);
          if (now - lastScaredAt >= FAST_SCROLL.cooldownSeconds) {
            lastScaredAt = now;
            scaredUntil = now + FAST_SCROLL.scaredDurationSeconds;
            state.setMood('scared');
            const lines = FAST_SCROLL.scaredLines;
            state.say(
              lines[Math.floor(Math.random() * lines.length)],
              BUBBLE.reactionDurationMs,
            );
          }
        }
      } else {
        fastSince = null;
        if (state.isFastScrolling) state.setFastScrolling(false);

        if (!relaxed) {
          if (calmSince === null) calmSince = now;
          const scaredOver = now >= scaredUntil;
          if (scaredOver && now - calmSince >= FAST_SCROLL.calmSeconds) {
            relaxed = true;
            calmSince = null;
            // Back to whatever the current section wants him to do.
            const s = SECTIONS.find((x) => x.id === state.currentSection);
            state.setMood(s?.animation ?? 'idle');
            state.say(FAST_SCROLL.calmLine, BUBBLE.reactionDurationMs);
          }
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

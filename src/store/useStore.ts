/**
 * Global state for the guide system, powered by Zustand.
 *
 * Anything that several parts of the app need to agree on lives here:
 * which section is on screen, what mood the character is in, what the
 * speech bubble says, and whether the visitor is scrolling dangerously fast.
 *
 * The 3D loop reads this store with `useStore.getState()` (no re-render),
 * while React components subscribe to the pieces they display.
 */
import { create } from 'zustand';
import { BUBBLE } from '../config/character';
import type { Mood } from '../config/character';
import type { SectionConfig } from '../config/character';

let bubbleTimer: number | undefined;

/**
 * Pending lines for `saySequence`: each shows for its own duration,
 * then the next takes the same bubble. A plain `say()` (or
 * `hideBubble()`) empties the queue — direct lines always win.
 */
let bubbleQueue: Array<{ text: string; durationMs: number }> = [];

function showNextBubble(
  set: (partial: Partial<GuideState>) => void,
) {
  const next = bubbleQueue.shift();
  if (!next) {
    set({ bubbleVisible: false });
    return;
  }
  set({ bubbleText: next.text, bubbleVisible: true });
  bubbleTimer = window.setTimeout(() => {
    if (bubbleQueue.length > 0) showNextBubble(set);
    else set({ bubbleVisible: false });
  }, next.durationMs);
}

interface GuideState {
  /** Id of the section currently in view ('hero', 'about', ...). */
  currentSection: SectionConfig['id'];
  /** The character's current animation mood. */
  mood: Mood;
  /** Text inside the speech bubble ('' = nothing to say). */
  bubbleText: string;
  /** Whether the bubble is on screen right now. */
  bubbleVisible: boolean;
  /** True while |scroll velocity| is over the scared threshold. */
  isFastScrolling: boolean;
  /** False until the welcome sequence has finished (blocks section bubbles). */
  welcomed: boolean;
  /** Latest raw scroll velocity reported by Lenis (used by the 3D loop). */
  scrollVelocity: number;
  /**
   * True while the model3d guide is mounted and running its arrival
   * routine. In that mode the guide owns section speech (greeting →
   * section text, timed to his landing), so App.tsx must NOT also say
   * the section text directly. If the GLB fails and the guide unmounts
   * (medallion fallback), this flips back to false and App speaks.
   */
  arrivalGuideMounted: boolean;

  setSection: (id: SectionConfig['id']) => void;
  setMood: (mood: Mood) => void;
  /**
   * Show a bubble with new text and auto-hide it after `durationMs`
   * (section default from config). Re-calling restarts text + timer.
   * Clears any queued `saySequence` lines — a direct line always wins.
   */
  say: (text: string, durationMs?: number) => void;
  /**
   * Show several lines one after another in the same bubble, each for
   * its own duration (used for greeting → section explanation).
   */
  saySequence: (items: Array<{ text: string; durationMs: number }>) => void;
  hideBubble: () => void;
  setArrivalGuideMounted: (mounted: boolean) => void;
  setFastScrolling: (fast: boolean) => void;
  setWelcomed: () => void;
  setScrollVelocity: (v: number) => void;
}

export const useStore = create<GuideState>((set) => ({
  currentSection: 'hero',
  mood: 'idle',
  bubbleText: '',
  bubbleVisible: false,
  isFastScrolling: false,
  welcomed: false,
  scrollVelocity: 0,
  arrivalGuideMounted: false,

  setSection: (id) => set({ currentSection: id }),
  setMood: (mood) => set({ mood }),
  say: (text, durationMs = BUBBLE.sectionDurationMs) => {
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [];
    set({ bubbleText: text, bubbleVisible: true });
    bubbleTimer = window.setTimeout(
      () => set({ bubbleVisible: false }),
      durationMs,
    );
  },
  saySequence: (items) => {
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [...items];
    showNextBubble(set);
  },
  hideBubble: () => {
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [];
    set({ bubbleVisible: false });
  },
  setArrivalGuideMounted: (mounted) => set({ arrivalGuideMounted: mounted }),
  setFastScrolling: (fast) => set({ isFastScrolling: fast }),
  setWelcomed: () => set({ welcomed: true }),
  setScrollVelocity: (v) => set({ scrollVelocity: v }),
}));

/**
 * Shared mutable object holding the character's on-screen pixel position.
 * The 3D loop writes it every frame; the speech bubble reads it every frame
 * and moves a DOM node directly — no React re-renders at 60fps.
 */
export const characterScreenPos = {
  x: 0,
  y: 0,
  /** Character height in px, so the bubble can sit above his head. */
  heightPx: 180,
  ready: false,
};

/**
 * Shared mutable object holding the IMAGE GUIDE medallion's on-screen
 * geometry. Fix pass 5: the medallion is STUCK at a fixed CSS position,
 * so GuideMedallion.tsx now writes this once on mount and again on
 * resize (the only moments his position can change) — there is no
 * per-frame writer anymore. The speech bubble follows THIS when the
 * image guide is active, so it always sits beside the medallion.
 */
export const guideScreenPos = {
  /** Centre of the medallion circle, in px. */
  centerX: 0,
  centerY: 0,
  /** Medallion diameter in px (so followers can offset by his real size). */
  sizePx: 0,
  ready: false,
};

/**
 * Shared mutable object for the medallion's hook position in screen px.
 * In fix pass 4 the 3D rope read this every frame and drove its target
 * length from it. In fix pass 5 (fixed mode) the canvas isn't rendered
 * at all; GuideMedallion still publishes the (constant) values on
 * mount/resize so the store shape — and any future 3D-mode revival —
 * stays intact.
 */
export const guideBandPos = {
  /** Hook point (top-centre of the medallion), screen px. */
  hookX: 0,
  hookY: 0,
  /** The unclamped right-side anchor x (screen px) the rope hangs from. */
  anchorX: 0,
  ready: false,
};

/** True when the visitor asked their OS for reduced motion. */
export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Small helper: are we on a phone-sized screen right now? */
export const isMobileNow = () =>
  typeof window !== 'undefined' && window.innerWidth < 768;

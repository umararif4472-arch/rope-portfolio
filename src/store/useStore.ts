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

/** Fired once when a `saySequence` queue drains NATURALLY (not when
 *  it is interrupted by `say()`/`hideBubble()`, which drop it). */
let queueOnDone: (() => void) | undefined;

function drainQueue() {
  const cb = queueOnDone;
  queueOnDone = undefined;
  if (cb) cb();
}

function showNextBubble(
  set: (partial: Partial<GuideState>) => void,
) {
  const next = bubbleQueue.shift();
  if (!next) {
    set({ bubbleVisible: false });
    drainQueue();
    return;
  }
  set({ bubbleText: next.text, bubbleVisible: true });
  bubbleTimer = window.setTimeout(() => {
    if (bubbleQueue.length > 0) showNextBubble(set);
    else {
      set({ bubbleVisible: false });
      drainQueue();
    }
  }, next.durationMs);
}

/**
 * Arrival-speech lock bookkeeping. A duration ESTIMATE cannot do
 * this job (travel runs on the motion clock, speech on wall-clock
 * timeouts — the two drift apart under load), so the lock is a
 * state flag instead: `beginArrivalSpeech` raises it when a routine
 * starts travelling, and the routine's own `saySequence` lowers it
 * via its onDone the moment the greeting + explanation have fully
 * played. The token keeps a superseded routine's callback from
 * lowering a newer routine's lock; the 30 s failsafe guarantees the
 * lock can never stick if a queue is interrupted by a direct line.
 */
let arrivalSpeechToken = 0;
let arrivalSpeechFailsafe: number | undefined;

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
  /**
   * Speech lock: while true, an arrival routine is travelling or its
   * greeting → section explanation is playing, and NO direct `say()`
   * may clear the sequence queue (the fast-scroll director's
   * scared/calm lines are the usual suspects). Raised/lowered only
   * through `beginArrivalSpeech`/`endArrivalSpeech` below.
   */
  arrivalSpeaking: boolean;

  setSection: (id: SectionConfig['id']) => void;
  /** Raise the arrival speech lock; returns its token. */
  beginArrivalSpeech: () => number;
  /** Lower the arrival speech lock if `token` is still current. */
  endArrivalSpeech: (token: number) => void;
  setMood: (mood: Mood) => void;
  /**
   * Show a bubble with new text and auto-hide it after `durationMs`
   * (section default from config). Re-calling restarts text + timer.
   * Clears any queued `saySequence` lines — a direct line always wins,
   * EXCEPT while the arrival speech lock is raised: then the direct
   * line is dropped so it cannot eat an arrival's greeting/explanation.
   */
  say: (text: string, durationMs?: number) => void;
  /**
   * Show several lines one after another in the same bubble, each for
   * its own duration (used for greeting → section explanation).
   * `onDone` fires once when the queue drains naturally.
   */
  saySequence: (
    items: Array<{ text: string; durationMs: number }>,
    onDone?: () => void,
  ) => void;
  hideBubble: () => void;
  setArrivalGuideMounted: (mounted: boolean) => void;
  setFastScrolling: (fast: boolean) => void;
  setWelcomed: () => void;
  setScrollVelocity: (v: number) => void;
}

export const useStore = create<GuideState>((set, get) => ({
  currentSection: 'hero',
  mood: 'idle',
  bubbleText: '',
  bubbleVisible: false,
  isFastScrolling: false,
  welcomed: false,
  scrollVelocity: 0,
  arrivalGuideMounted: false,
  arrivalSpeaking: false,

  setSection: (id) => set({ currentSection: id }),
  beginArrivalSpeech: () => {
    arrivalSpeechToken += 1;
    const token = arrivalSpeechToken;
    window.clearTimeout(arrivalSpeechFailsafe);
    arrivalSpeechFailsafe = window.setTimeout(() => {
      if (arrivalSpeechToken === token) set({ arrivalSpeaking: false });
    }, 30000);
    set({ arrivalSpeaking: true });
    return token;
  },
  endArrivalSpeech: (token) => {
    if (arrivalSpeechToken !== token) return;
    window.clearTimeout(arrivalSpeechFailsafe);
    set({ arrivalSpeaking: false });
  },
  setMood: (mood) => set({ mood }),
  say: (text, durationMs = BUBBLE.sectionDurationMs) => {
    // The arrival speech lock outranks direct lines: while a routine
    // is travelling or speaking, a direct line would wipe the
    // greeting → explanation queue, so it is dropped instead.
    if (get().arrivalSpeaking) return;
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [];
    queueOnDone = undefined;
    set({ bubbleText: text, bubbleVisible: true });
    bubbleTimer = window.setTimeout(
      () => set({ bubbleVisible: false }),
      durationMs,
    );
  },
  saySequence: (items, onDone) => {
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [...items];
    queueOnDone = onDone;
    showNextBubble(set);
  },
  hideBubble: () => {
    window.clearTimeout(bubbleTimer);
    bubbleQueue = [];
    queueOnDone = undefined;
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

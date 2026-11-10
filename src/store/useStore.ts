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

  setSection: (id: SectionConfig['id']) => void;
  setMood: (mood: Mood) => void;
  /**
   * Show a bubble with new text and auto-hide it after `durationMs`
   * (section default from config). Re-calling restarts text + timer.
   */
  say: (text: string, durationMs?: number) => void;
  hideBubble: () => void;
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

  setSection: (id) => set({ currentSection: id }),
  setMood: (mood) => set({ mood }),
  say: (text, durationMs = BUBBLE.sectionDurationMs) => {
    window.clearTimeout(bubbleTimer);
    set({ bubbleText: text, bubbleVisible: true });
    bubbleTimer = window.setTimeout(
      () => set({ bubbleVisible: false }),
      durationMs,
    );
  },
  hideBubble: () => {
    window.clearTimeout(bubbleTimer);
    set({ bubbleVisible: false });
  },
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

/** True when the visitor asked their OS for reduced motion. */
export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Small helper: are we on a phone-sized screen right now? */
export const isMobileNow = () =>
  typeof window !== 'undefined' && window.innerWidth < 768;

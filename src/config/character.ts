/**
 * ============================================================================
 *  CHARACTER CONFIG — every knob for the 3D rope guide lives here.
 * ============================================================================
 *  Want him faster, calmer, more dramatic? Change numbers here, not in the
 *  components. Each value is explained in plain words.
 */

import { SITE } from './site';

// ---------------------------------------------------------------------------
// The 3D model
// ---------------------------------------------------------------------------
/**
 * Path of YOUR rigged model. Drop the file at `public/model.glb` and it is
 * used automatically. While the file is missing (or fails to load) a cute
 * procedural character built from Three.js shapes takes over, so the site
 * never breaks.
 */
export const MODEL_PATH = '/model.glb';

/** Draco decoder (lets compressed .glb files load). Hosted by Google. */
export const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

/**
 * Animation clip names inside model.glb, one per "mood".
 * If you export animations from Mixamo/Blender with different names, just
 * rename them HERE — no other file needs to change. If a clip is missing,
 * the character falls back to procedural bone animation for that mood.
 */
export const CLIPS = {
  idle: 'Idle',
  wave: 'Wave',
  point: 'Point',
  nod: 'Nod',
  thumbsUp: 'ThumbsUp',
  scared: 'Scared',
  swing: 'Swing',
} as const;

export type Mood = keyof typeof CLIPS;

// ---------------------------------------------------------------------------
// Rope + follow behaviour
// ---------------------------------------------------------------------------
export const ROPE = {
  /** How many verlet points the rope is made of. More = smoother, heavier. */
  segments: 14,
  /** Gravity strength pulling the rope down (world units / s²). */
  gravity: -9.8,
  /** Constraint solver passes per frame. 3 is a good balance. */
  iterations: 3,
  /** Rope thickness (world units). */
  radius: 0.035,
  /** Rope colour. */
  color: '#D99A2B',
};

export const FOLLOW = {
  /**
   * Spring that pulls the character toward the active section.
   * stiffness: higher = snappier. damping: higher = less bounce.
   */
  stiffness: 26,
  damping: 7.5,
  /**
   * Where the anchor sits: distance from the right edge of the screen,
   * as a fraction of the screen width (0.16 ≈ 16% in from the right).
   */
  anchorRightFractionDesktop: 0.14,
  anchorRightFractionMobile: 0.2,
  /** Character scale per device size. */
  scaleDesktop: 1,
  scaleMobile: 0.62,
  /** Idle pendulum sway strength (radians). */
  idleSway: 0.05,
};

// ---------------------------------------------------------------------------
// Fast scroll = scared reaction
// ---------------------------------------------------------------------------
export const FAST_SCROLL = {
  /**
   * Lenis reports scroll velocity roughly in px/frame-ish units.
   * If |velocity| goes above this, the visitor is scrolling "too fast".
   * Lower it (e.g. 30) if he should scare more easily, raise it to be chill.
   */
  velocityThreshold: 42,
  /** Random catch-up delay range, in seconds (he lags, then hurries after you). */
  catchUpDelayMin: 0.8,
  catchUpDelayMax: 1.5,
  /** Minimum seconds between two scared bubbles. */
  cooldownSeconds: 4,
  /** Seconds of calm scrolling before he relaxes and says the "phew" line. */
  calmSeconds: 2,
  /** How long the scared animation itself plays before settling. */
  scaredDurationSeconds: 1.6,
  /** Lines he can say when he catches up, frightened. One is picked at random. */
  scaredLines: [
    "Don't move so fast, it's dangerous! 😨",
    'Whoa whoa WHOA — slow down up there! 😱',
    'My rope was NOT built for this speed! 🫨',
  ],
  /** Line he says once he has calmed down again. */
  calmLine: "Phew... that's better 😮‍💨",
};

// ---------------------------------------------------------------------------
// Speech bubble timings (milliseconds)
// ---------------------------------------------------------------------------
export const BUBBLE = {
  /** Welcome bubble stays this long. */
  welcomeDurationMs: 5000,
  /** Section bubbles stay this long. */
  sectionDurationMs: 6000,
  /** Scared / calm bubbles stay this long. */
  reactionDurationMs: 3800,
  /** Typewriter speed — milliseconds per character. */
  typewriterMsPerChar: 18,
};

// ---------------------------------------------------------------------------
// Sections — order, guide animation, bubble text, and where he hangs
// ---------------------------------------------------------------------------
export interface SectionConfig {
  id: 'hero' | 'about' | 'skills' | 'projects' | 'experience' | 'contact';
  /** Nav label. */
  label: string;
  /** Mood/animation he plays when this section arrives. */
  animation: Mood;
  /** Bubble text on desktop. */
  bubbleText: string;
  /** Shorter bubble text on small screens. */
  mobileBubbleText: string;
  /**
   * How far down the screen he hangs while this section is active,
   * as a fraction of the viewport height (0 = very top, 1 = bottom).
   * This is what makes the rope visibly stretch and shorten per section.
   */
  hangDepth: number;
}

export const SECTIONS: SectionConfig[] = [
  {
    id: 'hero',
    label: 'Home',
    animation: 'wave',
    bubbleText: `Hi! I'm ${SITE.firstName} — well, his 3D guide. Keep scrolling and I'll show you around! 👋`,
    mobileBubbleText: `Hi! I'm ${SITE.firstName}'s 3D guide. Scroll and I'll show you around! 👋`,
    hangDepth: 0.34,
  },
  {
    id: 'about',
    label: 'About',
    animation: 'nod',
    bubbleText: `This is the About section. ${SITE.firstName} is a Software Engineering student at Riphah International University, Sahiwal — and he builds real products, not just assignments.`,
    mobileBubbleText: `About ${SITE.firstName} — SE student at Riphah, Sahiwal, and a real product builder.`,
    hangDepth: 0.46,
  },
  {
    id: 'skills',
    label: 'Skills',
    animation: 'point',
    bubbleText: 'Skills time! Flutter and Dart for mobile, React and Django for the web, Firebase behind it all. He learns by shipping. 🛠️',
    mobileBubbleText: 'His skills — Flutter, React, Django, Firebase and more. 🛠️',
    hangDepth: 0.4,
  },
  {
    id: 'projects',
    label: 'Projects',
    animation: 'point',
    bubbleText: "This is my Projects section. Here are things I've built. Click any card to see details!",
    mobileBubbleText: "Projects! Click any card to see details!",
    hangDepth: 0.52,
  },
  {
    id: 'experience',
    label: 'Experience',
    animation: 'thumbsUp',
    bubbleText: `His journey so far — an IT internship at Artistic Milliners, a live marketplace shipped solo, and a 5-hour hackathon build. Not bad, right? 👍`,
    mobileBubbleText: 'Internship, a live product, a hackathon — his journey so far. 👍',
    hangDepth: 0.44,
  },
  {
    id: 'contact',
    label: 'Contact',
    animation: 'wave',
    bubbleText: `Last stop — Contact! Internship, job or freelance project? Send ${SITE.firstName} a message, he replies fast. 📩`,
    mobileBubbleText: 'Contact time! Send him a message. 📩',
    hangDepth: 0.5,
  },
];

/** The exact welcome line from the spec, with his real name filled in. */
export const WELCOME_TEXT = `Hi! Welcome to my portfolio 👋 I'm ${SITE.name}. Scroll down and I'll show you around!`;

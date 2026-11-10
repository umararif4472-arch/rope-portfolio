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

/**
 * ---------------------------------------------------------------------------
 *  WHICH CHARACTER DOES THE VISITOR SEE?
 * ---------------------------------------------------------------------------
 *  `useImageGuide: true` (the current live behaviour, fix pass 3):
 *  the visible guide is Umar's ACTUAL 3D-avatar render
 *  (public/guide-fallback.webp) shown as a round medallion that hangs from
 *  the end of the 3D rope — exact likeness, because it IS his picture.
 *  The moods become small medallion dances (sway / wiggle / dip / shake)
 *  instead of 3D-model animations, and his position is hard-clamped so he
 *  can NEVER leave the screen (see GuideMedallion.tsx).
 *
 *  Set it to `false` to go back to the 3D character (the procedural
 *  shapes character, or your real rigged model when public/model.glb
 *  exists — that code path stays in the codebase, just dormant).
 */
export const CHARACTER = {
  useImageGuide: true,
  /** His avatar render, relative to the site base (public/ folder). */
  imageFile: 'guide-fallback.webp',
  /** Medallion diameter in px — desktop / mobile. */
  sizeDesktopPx: 160,
  sizeMobilePx: 104,
  /** Diameter of the little metal ring at the top the rope attaches to. */
  hookSizePx: 18,
  /**
   * ALWAYS-ON-SCREEN guarantee: the medallion (hook included) is clamped
   * every frame so it stays at least this many px inside the viewport on
   * every side — during section changes, fast scrolling and the scared
   * shake alike. While clamped he waits at the edge, fully visible.
   */
  edgeMarginPx: 8,
  /**
   * Where his face sits inside the square crop of the portrait
   * (CSS object-position). The render is a tall portrait with his face +
   * sunglasses + polo in the top-centre, so a small % keeps the crop
   * centred on his face instead of his chest.
   */
  imagePosition: '50% 6%',
};

// ---------------------------------------------------------------------------
// Rope + follow behaviour
// ---------------------------------------------------------------------------
export const ROPE = {
  /** How many verlet points the rope is made of. More = smoother, heavier. */
  segments: 14,
  /** Gravity strength pulling the rope down (world units / s²). */
  gravity: -9.8,
  /**
   * PHYSICS SPEED — the master "calm down" knob.
   * The rope simulation runs at this fraction of real time: 1 = real time,
   * 0.68 = everything swings about a third slower, like a heavier, longer
   * pendulum. LOWER = slower & calmer. RAISE toward 1 = snappier/frantic.
   */
  timeScale: 0.68,
  /**
   * How much speed each rope point KEEPS per step (0..1).
   * 0.985 (the old value) kept almost all speed, so swings whipped around
   * for ages. 0.95 bleeds speed off faster, so swinging settles quickly.
   * LOWER = settles faster/calmer. Too low (< 0.9) feels like underwater.
   */
  damping: 0.95,
  /**
   * Hard speed limit for any rope point, in world units per second.
   * Nothing on the rope may move faster than this, so the character can
   * never dart across the screen. LOWER = stricter calmer.
   */
  maxPointSpeed: 6,
  /**
   * How fast the rope's visible length eases toward a new length when he
   * travels between sections (per second). LOWER = slower, gentler stretch.
   */
  lengthEase: 2.0,
  /**
   * Constraint solver passes per frame. More passes = a steadier rope that
   * never jitters or over-stretches. 5 is calm and still cheap.
   */
  iterations: 5,
  /**
   * SIDEWAYS LOCK — how hard the rope is pulled back to hanging straight
   * down below its anchor, every physics step (0..1). The character must
   * NEVER wander left/right: scrolling only changes the rope's LENGTH,
   * never his sideways position. 0.6 corrects 60% of any sideways drift
   * per step, so drift dies almost instantly and only the deliberate
   * micro-sway (see FOLLOW.idleSway / ROPE.scaredSway) survives.
   * RAISE toward 1 = even more rigid. LOWER = looser, more pendulum.
   */
  xLock: 0.6,
  /**
   * Damping used WHILE he is travelling to a new depth (see RopeSim).
   * Lower than the idle ROPE.damping on purpose: while gliding up/down the
   * rope should behave like it is moving through honey — zero swinging
   * until he arrives, then the gentle idle damping takes over again.
   */
  motionDamping: 0.88,
  /**
   * Biggest sideways sway allowed during the scared reaction, in world
   * units at the character. Even panicking, he only shivers this far
   * sideways (≈ a few pixels) and stays on his anchor line.
   */
  scaredSway: 0.05,
  /** Absolute sideways cap for ANY sway (welcome wiggle included). */
  maxSway: 0.06,
  /** Rope thickness (world units). */
  radius: 0.035,
  /** Rope colour. */
  color: '#D99A2B',
};

export const FOLLOW = {
  /**
   * Spring that pulls the character toward the active section.
   * Tuned for a slow, heavy glide: stiffness 10 with damping 6.5 is almost
   * exactly "critically damped" (2 × √stiffness ≈ 6.3), which means he
   * arrives smoothly WITHOUT bouncing past the target and swinging back.
   * stiffness: LOWER = slower, lazier travel. damping: keep it near
   * 2 × √stiffness for no bounce; lower damping = more overshoot/bounce.
   */
  stiffness: 10,
  damping: 6.5,
  /**
   * Smoothing on the follow TARGET itself (per second): the destination
   * he is heading to is low-pass filtered, so a sudden section change
   * eases in instead of yanking him. LOWER = gentler starts.
   */
  targetSmoothing: 2.2,
  /**
   * Hard speed limit for the follow spring, in world units per second.
   * However far he has to travel, he never moves faster than this.
   * Softened again in fix pass 2 (was 1.6) — Umar asked twice for calm.
   */
  maxSpeed: 1.15,
  /**
   * WHERE THE ROPE IS NAILED TO THE TOP OF THE SCREEN.
   * Distance from the RIGHT edge, as a fraction of the screen width:
   * desktop 0.16 → he hangs at 84% of the width (a little bit right of
   * centre-right, clear of the text); mobile 0.18 → 82% of the width.
   * This anchor NEVER moves sideways — not between sections, not ever.
   * Scrolling only makes the rope longer/shorter.
   */
  anchorRightFractionDesktop: 0.16,
  anchorRightFractionMobile: 0.18,
  /** Character scale per device size. */
  scaleDesktop: 1,
  scaleMobile: 0.62,
  /**
   * Idle MICRO-sway: the largest sideways drift (world units at the
   * character, ≈ a few pixels) while he hangs still at a section. Just
   * enough to feel alive, small enough to never look like wandering.
   * While he is travelling to a new depth the sway is switched OFF
   * completely, so travel is a clean straight glide. LOWER = stiller.
   */
  idleSway: 0.02,
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

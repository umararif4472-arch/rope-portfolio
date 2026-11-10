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
 * Path of YOUR rigged model (Umar's Avaturn avatar, optimized build).
 * The file name is VERSIONED on purpose (`model-v2.glb`, next update
 * `model-v3.glb`, …): firebase.json serves every `*.glb` with a
 * one-year `immutable` cache header, so an updated model shipped under
 * the SAME name would never reach phones that already downloaded the
 * old one. The un-optimized source stays at `public/model.glb` as a
 * backup but is no longer referenced here.
 * While the file is missing (or fails to load) a cute procedural
 * character built from Three.js shapes takes over, so the site never
 * breaks.
 */
export const MODEL_PATH = '/model-v2.glb';

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
 *  (public/guide-fallback.webp) shown as a round medallion — exact
 *  likeness, because it IS his picture.
 *
 *  `guideMode: 'fixed'` (fix pass 5 — Umar's final word on motion):
 *  the medallion NEVER MOVES. Not while scrolling, not between
 *  sections, not when he is "scared", not on load. It sits at ONE
 *  fixed screen position set in plain CSS (see GuideMedallion.tsx and
 *  the `.guide-fixed` rules in src/index.css), with a short static
 *  rope segment above it. The ONLY things that still change are the
 *  speech bubble's text and visibility — he still greets you, still
 *  explains each section, still shouts when you scroll too fast…
 *  he just says it all from his one stuck spot. In this mode the
 *  Three.js canvas is not rendered at all, so no physics exists that
 *  could ever move anything on screen.
 *
 *  Set `useImageGuide` to `false` to go back to the moving 3D
 *  character (the procedural shapes character, or your real rigged
 *  model when public/model.glb exists — that code path stays in the
 *  codebase, just dormant).
 */
export const CHARACTER = {
  useImageGuide: true,
  /**
   * How the guide behaves:
   *  - 'model3d' → the REAL 3D model (MODEL_PATH, Umar's Avaturn
   *               avatar) hangs from a rope at the same anchored spot.
   *               Posed once (arms up, gripping the rope), then given
   *               SUBTLE life only — a tiny pendulum sway, breathing,
   *               head looks, leg lag (see `motion` below) — plus the
   *               up-and-down section-arrival routine (see `arrival`).
   *               He NEVER travels or swings free (no physics); with
   *               reduced-motion he is a frozen statue. If the GLB
   *               fails, the medallion takes over.
   *  - 'fixed'  → fix pass 5: the image medallion, stuck the same way.
   */
  guideMode: 'model3d',
  // -------------------------------------------------------------------------
  //  MODEL3D MODE — size of the fixed 3D guide container (mirrored by the
  //  `.guide-model3d` rules in src/index.css). Big enough that the full
  //  hanging body reads clearly; small enough to stay a "guide".
  // -------------------------------------------------------------------------
  modelWidthDesktopPx: 212,
  modelHeightDesktopPx: 312,
  modelWidthMobilePx: 168,
  modelHeightMobilePx: 250,
  // -------------------------------------------------------------------------
  //  SUBTLE LIFE (motion pass, 2026-11-10) — Umar reversed the freeze:
  //  he now wants the model to "do some movement and feel real", with
  //  the model and rope moving "a little bit only, not like old ones".
  //  So: a LIVING STATUE. He never changes spot, never travels, never
  //  swings free — these are the ONLY motions, and every size below is
  //  deliberately tiny. To calm him down (or freeze him again) lower
  //  the degrees toward 0; to make him livelier, raise them a little.
  //  With "prefers-reduced-motion" ALL of this is off — statue mode.
  // -------------------------------------------------------------------------
  motion: {
    /**
     * PENDULUM SWAY — model + rope tilt together, rigidly, around the
     * rope's anchor at the very top of the screen (like a real hanging
     * sign in a faint breeze). Biggest tilt in degrees; his head only
     * moves a few pixels. Period = seconds for one full swing cycle.
     */
    swayDeg: 1.6,
    swayPeriodS: 5,
    /**
     * A second, smaller wobble layered on the sway so the rhythm never
     * looks like a metronome. Degrees + seconds.
     */
    swayHarmonicDeg: 0.5,
    swayHarmonicPeriodS: 3.1,
    /**
     * BREATHING — his chest rises and falls this many degrees, on this
     * cycle. 0.8° is a whisper: you sense it more than see it.
     */
    breathDeg: 0.8,
    breathPeriodS: 3.8,
    /**
     * HEAD NOD — a constant tiny nod (thinking/alive), degrees + the
     * seconds one nod cycle takes.
     */
    nodDeg: 1.5,
    nodPeriodS: 6.5,
    /**
     * LOOK-AROUND — every lookEveryMinS..lookEveryMaxS seconds he
     * turns his head to one side by lookYawDeg, over lookTurnS
     * seconds, holds it for lookHoldS, then turns back. Sides
     * alternate. Never a snap — always a smooth ease.
     */
    lookYawDeg: 7,
    lookEveryMinS: 8,
    lookEveryMaxS: 11,
    lookTurnS: 1.4,
    lookHoldS: 1,
    /**
     * LEG LAG — his legs trail the sway a touch, like real legs on a
     * swing: this many degrees, arriving legLagS seconds late.
     */
    legLagDeg: 0.7,
    legLagS: 0.4,
  },
  // -------------------------------------------------------------------------
  //  SECTION ARRIVALS (2026-11-10) — when the visitor scrolls to a new
  //  section, he plays a little routine: he climbs UP out of the top
  //  of the screen along his rope, waits a beat, then drops back DOWN
  //  into this exact spot and greets the section ("Oh, so you're
  //  here!") before explaining it. Same drop-in once on page load
  //  (with the normal welcome line instead of the greeting). Straight
  //  up/down on the rope line ONLY — sideways movement stays banned.
  //  Fast scrolling past several sections only triggers the routine
  //  for the section you finally settle on.
  // -------------------------------------------------------------------------
  arrival: {
    /** How long the climb up out of the screen takes (ms). */
    riseMs: 350,
    /** How long he stays up/out of sight before coming back (ms). */
    waitMs: 1000,
    /** How long the drop back into his spot takes (ms). */
    descendMs: 700,
    /** How long the greeting bubble shows before the section text (ms). */
    greetingMs: 1600,
    /** The greeting he says when he lands on a new section. */
    greetingText: "Oh, so you're here!",
    /**
     * The tiny "settle" when he lands: he drops this many px PAST his
     * spot, then eases back up into place. 4px max — a soft landing,
     * never a bounce.
     */
    settlePx: 4,
    /**
     * TRAVEL TILT — while the rope carries him up or down, he leans a
     * few degrees like a real body hanging from a moving rope: the
     * tilt builds with the travel and melts back into the idle sway
     * by the time he lands. Degrees, hard cap 3 — a lean, not a swing.
     */
    travelTiltDeg: 2.6,
    /**
     * CLIMB BOB — while he RISES, tiny upward tugs (hand-over-hand
     * feel): this many px per tug, this many tugs across the climb.
     * Never more than 3px — you sense the effort more than see it.
     */
    climbBobPx: 2.5,
    climbBobCycles: 2,
    /**
     * LANDING ABSORB — when he touches down, his knees soften by this
     * many degrees and straighten again over kneeBendMs, like real
     * legs taking his weight. ~4° is a dip, not a squat.
     */
    kneeBendDeg: 4,
    kneeBendMs: 320,
    /**
     * A section must be on screen this long (ms) before the routine
     * triggers — this is what makes fast fly-by scrolling skip the
     * in-between sections.
     */
    debounceMs: 300,
    /** On page load: he waits this long (ms) up top, then drops in. */
    loadDelayMs: 500,
  },
  // -------------------------------------------------------------------------
  //  FIXED POSITION (fix pass 5) — where the stuck model sits, forever
  // -------------------------------------------------------------------------
  //  His CSS top is `calc(navbar height + fixedNavGapPx)`: the navbar
  //  height is measured from the real <header> once on load (and on
  //  resize) and stored in the CSS variable --guide-nav-h. If that
  //  measurement ever fails, the fallbacks below apply instead
  //  (desktop 92px / mobile 84px total top offset).
  /** Gap (px) left between the navbar's bottom edge and the model. */
  fixedNavGapPx: 14,
  /** Distance (px) from the RIGHT edge of the screen — desktop / mobile. */
  fixedRightDesktopPx: 16,
  fixedRightMobilePx: 12,
  /** Fallback total `top` (px) if the navbar can't be measured. */
  fixedTopFallbackDesktopPx: 92,
  fixedTopFallbackMobilePx: 84,
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
  // -------------------------------------------------------------------------
  //  SAFE BAND (fix pass 4) — LEGACY: kept for reference only.
  //  Fix pass 5's 'fixed' guide mode no longer glides the medallion
  //  anywhere, so the band/glide values below are not used by the image
  //  guide anymore (the 3D rope still uses ROPE/FOLLOW as before).
  // -------------------------------------------------------------------------
  //  Pass 3 clamped him to an 8px margin from the viewport top, which let
  //  him slide BEHIND the fixed navbar (~64px tall) and vanish. The
  //  medallion's position is now computed in the DOM layer from EXPLICIT
  //  pixel bounds (see GuideMedallion.tsx), independent of the rope sim:
  //
  //      boxTop    ∈ [ navH + bandTopGapPx ,  vh − bandBottomGapPx − boxH ]
  //      boxLeft   ∈ [ edgeMarginPx ,  vw − edgeMarginPx − size ]
  //
  //  …then BOTH ranges are shrunk by bandSafetyPx on every side, and the
  //  FINAL transform values are clamped into the shrunk ranges — so the
  //  whole medallion (hook ring included) always stays below the navbar
  //  and inside the viewport, mood rotations included.
  /** Fallback navbar height (px) if it can't be measured at runtime. */
  navFallbackPx: 76,
  /** Clear space kept between the navbar's bottom edge and the medallion. */
  bandTopGapPx: 10,
  /** Clear space kept between the medallion and the viewport bottom. */
  bandBottomGapPx: 14,
  /**
   * Extra shrink applied to the safe band on all sides (px). Mood dances
   * are rotations around the top hook applied AFTER clamping; this margin
   * absorbs the couple of px a rotating corner can swing.
   */
  bandSafetyPx: 6,
  /**
   * How he glides between band positions when the section changes:
   * a critically-damped spring in px space (stiffness/damping) plus a
   * hard speed cap, so travel is a calm glide — never a dart.
   * stiffness 22 with damping ≈ 2×√22 ≈ 9.4 settles in about a second
   * with no overshoot bounce.
   */
  glideStiffness: 22,
  glideDamping: 9.4,
  glideMaxSpeedDesktopPx: 300,
  glideMaxSpeedMobilePx: 220,
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
    bubbleText: "This is his Projects section — here are the things he's built. Click any card to see details!",
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

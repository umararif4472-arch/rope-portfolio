/**
 * GuideModel3D — the guide as a REAL 3D model of Umar, hanging from a
 * rope (the Avaturn GLB at public/model-v2.glb).
 *
 * Motion rules (revised by Umar, 2026-11-10): after five rounds of
 * "don't move", he asked for the opposite extreme to be avoided too —
 * "some movement and feel real… a little bit only, not like old ones".
 * So this is a LIVING STATUE, and every motion here obeys three bans
 * inherited from the old physics days: he NEVER travels, NEVER swings
 * free, NEVER leaves his anchored spot (except straight up/down the
 * rope line during the arrival routine). Concretely:
 *  - The anchor is plain CSS (`.guide-sway` + `.guide-model3d` in
 *    src/index.css) — same top-right spot below the navbar as the
 *    medallion, sized from CHARACTER.model*Px. The layout box never
 *    moves; all motion is transform/bones on top of it.
 *  - IDLE LIFE (CHARACTER.motion): a ±1.6° pendulum sway of rope+model
 *    together, pivoting at the rope's anchor on the viewport's top
 *    edge (one rAF writes a rotate() on the sway wrapper); in-scene,
 *    his chest breathes, his head nods and occasionally looks around,
 *    and his legs trail the sway a fraction late (one useFrame).
 *  - THE CHOREOGRAPHY (CHARACTER.arrival, Umar's design, final
 *    form 2026-11-11): WHILE the visitor scrolls — either
 *    direction — he climbs UP his rope and out of the top of the
 *    screen, coupled to the scroll itself (he starts moving as the
 *    scrolling starts, not as a reaction after it ends). The DOM
 *    rope inside the moving layer shortens above his hands as he
 *    climbs toward the anchor. When scrolling stops he stays up
 *    for ~1 s, then comes DOWN the rope "like real world" — a
 *    physical descent with gravity-feel easing and a knee-bend
 *    landing absorb — and only on landing, if the settled section
 *    is new, does the bubble say the greeting and the section's
 *    text. Scroll again mid-wait or mid-descent and he goes
 *    straight back up. The page-load drop-in is the same descent,
 *    once, with the welcome text instead. Symmetry is guaranteed
 *    two ways: a geometric watchdog re-derives the section from
 *    live layout (direction-agnostic, repeat-friendly), and a
 *    speech lock — raised the moment he departs — stops the
 *    fast-scroll director from clearing the greeting's queue (and
 *    keeps any bubble from floating over his empty spot while he
 *    is up).
 *  - With prefers-reduced-motion ALL motion is off: frozen statue,
 *    bubble swaps greeting → section text in place.
 *
 * Failure handling: if the GLB cannot load (missing file, decode
 * error, no WebGL), an error boundary reports up via `onFail` and
 * App swaps in the GuideMedallion image guide — the site never
 * breaks. While the model file is still downloading, his avatar
 * image shows in the container as a placeholder; the placeholder
 * hides ONLY once every texture in the scene has actually decoded
 * (see the readiness block below — a fixed timer was not enough on
 * a slow phone). Pure CSS placeholder, no store publishing — this
 * component is the only geometry publisher here.
 *
 * Bubble geometry: like GuideMedallion, this publishes his fixed
 * geometry to `guideScreenPos` on mount and on resize ONLY (his head
 * position inside the container), so SpeechBubble keeps behaving
 * exactly as it did in fixed mode.
 */
import { Component, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { BUBBLE, CHARACTER, MODEL_PATH, ROPE, SECTIONS } from '../config/character';
import type { SectionConfig } from '../config/character';
import { SITE } from '../config/site';
import {
  guideBandPos,
  guideScreenPos,
  isMobileNow,
  prefersReducedMotion,
  useStore,
} from '../store/useStore';

// ---------------------------------------------------------------------------
// The hanging pose — applied ONCE, then frozen forever.
// ---------------------------------------------------------------------------
// The Avaturn rig uses Mixamo-style bone names, and every bone's child
// offset runs along the bone's local +Y. So a bone's world direction is
// its world quaternion applied to (0,1,0), and we can "aim" a bone by
// rotating that direction onto a target — independent of bind pose.
const BONE_AXIS = new THREE.Vector3(0, 1, 0);

function aimBone(bone: THREE.Object3D, targetDir: THREE.Vector3) {
  bone.updateWorldMatrix(true, false);
  const worldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(worldQuat);
  const currentDir = BONE_AXIS.clone().applyQuaternion(worldQuat).normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(
    currentDir,
    targetDir.clone().normalize(),
  );
  const newWorldQuat = delta.multiply(worldQuat);
  const parentQuat = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQuat);
  bone.quaternion.copy(parentQuat.invert().multiply(newWorldQuat));
  bone.updateWorldMatrix(false, true);
}

/**
 * Pose targets (world-space directions each bone segment should point):
 * arms UP overhead, forearms angling inward so the hands meet at the
 * rope just above his head; legs straight down with a whisper of
 * inward angle so the feet hang together.
 */
const POSE = {
  leftUpperArm: new THREE.Vector3(-0.2, 1, 0.06),
  rightUpperArm: new THREE.Vector3(0.2, 1, 0.06),
  leftForeArm: new THREE.Vector3(-0.48, 1, 0.1),
  rightForeArm: new THREE.Vector3(0.48, 1, 0.1),
  leftThigh: new THREE.Vector3(-0.045, -1, 0),
  rightThigh: new THREE.Vector3(0.045, -1, 0),
  leftShin: new THREE.Vector3(-0.045, -1, 0),
  rightShin: new THREE.Vector3(0.045, -1, 0),
};

/** Where the hands meet — the rope's grip point, in model space. */
const GRIP = new THREE.Vector3(0, 2.0, 0.04);
/** Model-space Y that sits at the vertical centre of the frame. */
const FRAME_CENTER_Y = 1.01;

/**
 * Curl the fingers around the rope. The hands hang palm-forward, so a
 * world-space rotation about +X by a NEGATIVE angle folds the
 * fingertips back toward the palms (over the "bar"). Segment 1 curls
 * most, segment 3 least. Thumbs are left alone.
 */
const FINGER_CURL = [0, -0.55, -0.45, -0.35]; // index by segment 1..3
function curlFingers(scene: THREE.Object3D) {
  const curlAxis = new THREE.Vector3(1, 0, 0);
  scene.traverse((obj) => {
    const m = obj.name.match(/Hand(?:Index|Middle|Ring|Pinky)([123])$/);
    if (!m) return;
    const angle = FINGER_CURL[Number(m[1])];
    obj.updateWorldMatrix(true, false);
    const worldQuat = new THREE.Quaternion();
    obj.getWorldQuaternion(worldQuat);
    const delta = new THREE.Quaternion().setFromAxisAngle(curlAxis, angle);
    const newWorldQuat = delta.multiply(worldQuat);
    const parentQuat = new THREE.Quaternion();
    obj.parent?.getWorldQuaternion(parentQuat);
    obj.quaternion.copy(parentQuat.invert().multiply(newWorldQuat));
    obj.updateWorldMatrix(false, true);
  });
}

function poseHanging(scene: THREE.Object3D) {
  const byName = (n: string) => scene.getObjectByName(n);
  const armL = byName('LeftArm');
  const armR = byName('RightArm');
  const foreL = byName('LeftForeArm');
  const foreR = byName('RightForeArm');
  const thighL = byName('LeftUpLeg');
  const thighR = byName('RightUpLeg');
  const shinL = byName('LeftLeg');
  const shinR = byName('RightLeg');
  // Parents before children, so each aim reads fresh world matrices.
  if (armL) aimBone(armL, POSE.leftUpperArm);
  if (armR) aimBone(armR, POSE.rightUpperArm);
  if (foreL) aimBone(foreL, POSE.leftForeArm);
  if (foreR) aimBone(foreR, POSE.rightForeArm);
  if (thighL) aimBone(thighL, POSE.leftThigh);
  if (thighR) aimBone(thighR, POSE.rightThigh);
  if (shinL) aimBone(shinL, POSE.leftShin);
  if (shinR) aimBone(shinR, POSE.rightShin);
  curlFingers(scene);
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      // Posed bones can outgrow bind-pose bounding spheres; never let
      // the frustum culler hide a limb.
      obj.frustumCulled = false;
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  scene.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------
// Subtle life — tiny per-frame bone deltas layered ON TOP of the frozen
// pose. Every animated bone's POSED local quaternion is captured once
// (its "base"); each frame we reset to base, then apply a small
// WORLD-space delta rotation (converted back to local space against
// the parent's CURRENT world quaternion, so animated ancestors are
// respected). World-space axes keep this rig-independent: world X =
// pitch (nod / breathe), world Y = yaw (look around), world Z = the
// screen-plane tilt the legs use to trail the pendulum. The arms are
// never in this set — the grip on the rope is untouchable.
// ---------------------------------------------------------------------------
interface LifeBone {
  bone: THREE.Object3D;
  base: THREE.Quaternion;
}

interface LifeBones {
  chest?: LifeBone;
  head?: LifeBone;
  thighL?: LifeBone;
  thighR?: LifeBone;
  shinL?: LifeBone;
  shinR?: LifeBone;
}

function captureLifeBones(scene: THREE.Object3D): LifeBones {
  const grab = (names: string[]): LifeBone | undefined => {
    for (const n of names) {
      const bone = scene.getObjectByName(n);
      if (bone) return { bone, base: bone.quaternion.clone() };
    }
    return undefined;
  };
  return {
    // Upper chest reads as breathing best (shoulders ride it slightly).
    chest: grab(['Spine2', 'Spine1', 'Spine']),
    head: grab(['Head']),
    thighL: grab(['LeftUpLeg']),
    thighR: grab(['RightUpLeg']),
    // Shins join the thighs for the landing knee-bend absorb.
    shinL: grab(['LeftLeg']),
    shinR: grab(['RightLeg']),
  };
}

const _delta = new THREE.Quaternion();
const _world = new THREE.Quaternion();
const _parentWorld = new THREE.Quaternion();
const _axis = new THREE.Vector3();

function applyWorldDelta(lb: LifeBone, delta: THREE.Quaternion) {
  lb.bone.quaternion.copy(lb.base);
  lb.bone.updateWorldMatrix(true, false);
  lb.bone.getWorldQuaternion(_world);
  const parent = lb.bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_parentWorld);
  const newWorld = _delta.copy(delta).multiply(_world);
  lb.bone.quaternion.copy(_parentWorld.invert().multiply(newWorld));
}

function axisDelta(x: number, y: number, z: number, angle: number) {
  return new THREE.Quaternion().setFromAxisAngle(
    _axis.set(x, y, z),
    angle,
  );
}

const TAU = Math.PI * 2;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Smooth 0→1 ease for the head's look turns (no snaps, ever). */
function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/**
 * Head look-around state machine, driven by the shared motion clock:
 * idle (random wait) → turn (ease to one side) → hold → return → idle.
 */
interface LookState {
  phase: 'idle' | 'turn' | 'hold' | 'return';
  /** Motion-time the current phase began. */
  since: number;
  /** Motion-time the next look starts (idle phase). */
  nextAt: number;
  from: number;
  to: number;
  yaw: number;
  side: 1 | -1;
}

function stepLook(look: LookState, t: number): number {
  const M = CHARACTER.motion;
  switch (look.phase) {
    case 'idle':
      look.yaw = 0;
      if (t >= look.nextAt) {
        look.phase = 'turn';
        look.since = t;
        look.from = 0;
        look.side = look.side === 1 ? -1 : 1;
        look.to = look.side * rad(M.lookYawDeg) * (0.85 + Math.random() * 0.3);
      }
      break;
    case 'turn': {
      const p = Math.min((t - look.since) / M.lookTurnS, 1);
      look.yaw = look.from + (look.to - look.from) * easeInOut(p);
      if (p >= 1) {
        look.phase = 'hold';
        look.since = t;
      }
      break;
    }
    case 'hold':
      if (t - look.since >= M.lookHoldS) {
        look.phase = 'return';
        look.since = t;
        look.from = look.yaw;
      }
      break;
    case 'return': {
      const p = Math.min((t - look.since) / M.lookTurnS, 1);
      look.yaw = look.from * (1 - easeInOut(p));
      if (p >= 1) {
        look.phase = 'idle';
        look.yaw = 0;
        look.nextAt =
          t + M.lookEveryMinS + Math.random() * (M.lookEveryMaxS - M.lookEveryMinS);
      }
      break;
    }
  }
  return look.yaw;
}
// textured frame can exist. The old logic hid it on a fixed 350 ms
// timer and stopped invalidating after 2.2 s; on a slow phone the
// GLB's textures were still decoding at that point, so the last
// rendered frame could stick untextured (or the placeholder vanished
// before the model was truly up) — the owner saw no model at all.
// Now: collect every texture image in the scene and poll them. While
// ANY texture is pending we keep invalidating every ~250 ms (the
// scene is frozen — re-rendering the same static pose is invisible).
// When the LAST texture completes we invalidate once more and only
// then fire readiness. Safety valves: readiness fires anyway after
// 10 s (never trap the placeholder), and polling stops at 20 s.
// ---------------------------------------------------------------------------
function collectTextureImages(scene: THREE.Object3D): unknown[] {
  const images = new Set<unknown>();
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture && value.image) {
            images.add(value.image);
          }
        }
      }
    }
  });
  return [...images];
}

function textureImageReady(img: unknown): boolean {
  // ImageBitmaps arrive already decoded (GLTFLoader uses an
  // ImageBitmapLoader where available, e.g. Chrome/Android).
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    return img.width > 0;
  }
  if (
    typeof HTMLImageElement !== 'undefined' &&
    img instanceof HTMLImageElement
  ) {
    return img.complete && img.naturalWidth > 0;
  }
  // Canvas / ImageData / anything else: nothing to wait for.
  return true;
}

// ---------------------------------------------------------------------------
// The figure (GLB + in-scene rope): posed once, then given subtle life
// (breathing / head / leg lag) on top of the pose — see the LifeBones
// block above. With motion disabled the figure is the original statue.
// ---------------------------------------------------------------------------
export function HangingFigure({
  onReady,
  motionEnabled,
  motionTimeRef,
  landingRef,
}: {
  onReady?: () => void;
  motionEnabled: boolean;
  motionTimeRef: RefObject<number>;
  /** Motion-clock time of the most recent arrival landing (knees). */
  landingRef: RefObject<number>;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const invalidate = useThree((s) => s.invalidate);
  const readyFired = useRef(false);
  const life = useRef<LifeBones | null>(null);
  const look = useRef<LookState>({
    phase: 'idle',
    since: 0,
    nextAt: 6 + Math.random() * 3, // first look lands a few seconds in
    from: 0,
    to: 0,
    yaw: 0,
    side: 1,
  });

  useLayoutEffect(() => {
    poseHanging(scene);
    life.current = captureLifeBones(scene);
    invalidate();
  }, [scene, invalidate]);

  // ---- subtle life, one frame at a time -----------------------------------
  useFrame(() => {
    if (!motionEnabled || !life.current) return;
    const bones = life.current;
    const M = CHARACTER.motion;
    const t = motionTimeRef.current;

    // Breathing: chest pitch about world X, a whisper (±0.8°).
    if (bones.chest) {
      const a = rad(M.breathDeg) * Math.sin((TAU * t) / M.breathPeriodS);
      applyWorldDelta(bones.chest, axisDelta(1, 0, 0, a));
    }
    // Head: constant tiny nod (world X) + the look-around yaw (world
    // Y). World-absolute, so the chest's breathing doesn't shake him —
    // real heads stabilise the same way.
    if (bones.head) {
      const nod = rad(M.nodDeg) * Math.sin((TAU * t) / M.nodPeriodS);
      const yaw = stepLook(look.current, t);
      const delta = axisDelta(0, 1, 0, yaw).multiply(axisDelta(1, 0, 0, nod));
      applyWorldDelta(bones.head, delta);
    }
    // Leg lag: thighs tilt in the screen plane (world Z), following
    // the sway's phase a fraction late so the legs trail the swing.
    // (World Z appears mirrored on screen vs CSS rotation, hence the
    // sign flip — the wrapper's rotate() is clockwise-positive.)
    const swayPhase = (TAU * t) / M.swayPeriodS;
    const lagPhase = (TAU * M.legLagS) / M.swayPeriodS;
    const legAngle = -rad(M.legLagDeg) * Math.sin(swayPhase - lagPhase);

    // Landing absorb: for kneeBendMs after a touchdown, his knees
    // soften and straighten again — thighs pitch a touch toward the
    // viewer (hip flexion) while the shins fold a touch more the
    // other way, which is what a real knee does when it takes weight.
    // Envelope sin(πq) = out-and-back, peak at half-time. Composed
    // INTO the thigh delta (one reset per bone per frame, as always).
    const A = CHARACTER.arrival;
    const sinceLand = t - landingRef.current;
    const bendWin = A.kneeBendMs / 1000;
    let thighPitch = 0;
    let shinPitch = 0;
    if (sinceLand >= 0 && sinceLand <= bendWin) {
      const env = Math.sin(Math.PI * (sinceLand / bendWin));
      thighPitch = rad(A.kneeBendDeg) * env;
      shinPitch = -rad(A.kneeBendDeg) * 0.8 * env;
    }
    if (bones.thighL) {
      applyWorldDelta(
        bones.thighL,
        axisDelta(0, 0, 1, legAngle).multiply(axisDelta(1, 0, 0, thighPitch)),
      );
    }
    if (bones.thighR) {
      applyWorldDelta(
        bones.thighR,
        axisDelta(0, 0, 1, legAngle).multiply(axisDelta(1, 0, 0, thighPitch)),
      );
    }
    if (bones.shinL) applyWorldDelta(bones.shinL, axisDelta(1, 0, 0, shinPitch));
    if (bones.shinR) applyWorldDelta(bones.shinR, axisDelta(1, 0, 0, shinPitch));
  });

  useEffect(() => {
    const images = collectTextureImages(scene);
    // Nudge decoding along for element-backed images (Safari path).
    for (const img of images) {
      if (
        typeof HTMLImageElement !== 'undefined' &&
        img instanceof HTMLImageElement &&
        !img.complete &&
        typeof img.decode === 'function'
      ) {
        img.decode().catch(() => {
          /* decode is best-effort; the poll below is the real gate */
        });
      }
    }
    const startedAt = performance.now();
    const fireReady = () => {
      if (!readyFired.current) {
        readyFired.current = true;
        onReady?.();
      }
    };
    const tick = () => {
      const pending = images.some((img) => !textureImageReady(img));
      const elapsed = performance.now() - startedAt;
      if (!pending) {
        // One final render with every texture decoded, THEN the
        // placeholder may hide — a real textured frame now exists.
        invalidate();
        fireReady();
        window.clearInterval(timer);
        return;
      }
      // Still decoding: re-render the (frozen) pose so each texture
      // appears the moment it lands.
      invalidate();
      if (elapsed > 10_000) fireReady();
      if (elapsed > 20_000) window.clearInterval(timer);
    };
    const timer = window.setInterval(tick, 250);
    tick();
    return () => window.clearInterval(timer);
  }, [scene, invalidate, onReady]);

  return (
    <group position={[0, -FRAME_CENTER_Y, 0]}>
      <primitive object={scene} />
      {/* the rope inside the frame: a static cylinder from above the
          frame's top edge down to his hands, plus a small knot where
          the hands meet */}
      <mesh position={[GRIP.x, GRIP.y + 0.65, GRIP.z]}>
        <cylinderGeometry args={[0.018, 0.018, 1.34, 10]} />
        <meshStandardMaterial color={ROPE.color} roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — a broken GLB must hand over to the medallion guide.
// ---------------------------------------------------------------------------
class GuideErrorBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.info('[guide] 3D model unavailable, using image guide:', error.message);
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// The choreography state machine (Umar's design — see the CHARACTER.
// arrival header in config). It runs inside the same rAF as the sway
// (one transform writer for the wrapper), and watches the store's
// currentSection — the SAME source of truth the speech bubble uses
// (fed by App's ScrollTriggers and corrected by the geometric
// watchdog below).
//
//   risen ──(load delay + model ready)──▶ loadDescend ──▶ home
//   home ──(screen scrolling)──▶ rising ──(screen stops)──▶ waiting
//   waiting ──(waitAfterScrollMs)──▶ descending ──(landed)──▶ home
//   waiting/descending ──(scroll resumes)──▶ rising
//   home (speaking) ──(scroll)──▶ pending departure ──(speech done)──▶ rising
//
// WHILE scrolling (rising) he spring-climbs to the FULL exit — out
// of view above the top of the screen — coupled to the scroll from
// its first frames, in either direction. The wait only counts once
// the screen is truly still. The descent is the timed, gravity-feel
// trip back to his anchor; the greeting (if the settled section is
// new) fires ON LANDING, under the speech lock raised at departure
// — the lock also guarantees no bubble floats over his empty spot
// while he is up (direct say() lines are dropped under it, and the
// departure clears whatever bubble was showing). A section that
// settles WITHOUT a climb (a jump scroll) is greeted in place from
// home. Flying past three sections in one scroll still produces
// exactly ONE greeting — the settled one.
// ---------------------------------------------------------------------------
type ArrivalPhase =
  | 'risen'
  | 'loadDescend'
  | 'home'
  | 'rising'
  | 'waiting'
  | 'descending';

interface ArrivalState {
  phase: ArrivalPhase;
  /** Motion-clock time the current phase began. */
  since: number;
  /** translateY (px) when the descent began. */
  from: number;
  /** Current translateY (px): 0 = home, −travel = fully up/out. */
  offset: number;
  /** Climb-spring velocity (px/s) while rising/waiting. */
  riseVel: number;
  /**
   * Load drop-in only: the section that was current when the descent
   * BEGAN. The landing marks THIS as greeted — never the section at
   * completion time, or a fast first scroll during the drop-in would
   * be marked "already greeted" and never get its greeting.
   */
  loadSpoken: SectionConfig['id'];
  /** Latest section the store reported. */
  lastSeen: SectionConfig['id'];
  /** Motion-clock time `lastSeen` last changed. */
  seenAt: number;
  /** Motion-clock time the scroll last moved at real speed (Lenis). */
  stillSince: number;
  /** Motion-clock time scrollY last actually changed (screen stillness). */
  screenStillSince: number;
  /** Last section he has spoken for (or landed on, on load). */
  spoken: SectionConfig['id'];
  /**
   * Smoothed scroll velocity (px/s, + = scrolling down), derived
   * from live window.scrollY deltas — he answers the SCREEN's
   * movement, whatever drives it (wheel, touch, Lenis glide,
   * keyboard), and in EITHER direction: any real scroll sends him
   * UP the rope.
   */
  scrollVel: number;
  /** Previous frame's window.scrollY (null until first sampled). */
  lastScrollY: number | null;
  /** Motion-clock time raw scrolling last turned ON (−1 = off now). */
  hotSince: number;
  /** True while THIS machine holds the arrival speech lock. */
  lockHeld: boolean;
  /** True while our greeting → explanation sequence is playing. */
  speaking: boolean;
  /**
   * A scroll happened while he was SPEAKING: he never gets yanked
   * mid-sentence, so the departure is parked here and acted on the
   * moment the speech queue drains.
   */
  departurePending: boolean;
  /** Climb-bob phase (advances with distance actually climbed). */
  bobPhase: number;
  /** Climb-bob envelope 0..1 (swells while climbing, dies after). */
  bobAmp: number;
}

function descendOffset(p: number, from: number, settlePx: number): number {
  // The descent "like real world": a gentle release at the top, a
  // steady lowering through the middle, and a soft deceleration
  // into the landing — a smoothstep velocity profile does exactly
  // that (zero speed at both ends of the main segment, peak in the
  // middle, like a man braking with his hands as he nears his
  // spot). Then the small settle: he drops settlePx PAST home and
  // eases back up into place. Total overshoot = settlePx (4px).
  if (p < 0.85) {
    const q = p / 0.85;
    const s = q * q * (3 - 2 * q); // smoothstep
    return from + (settlePx - from) * s;
  }
  const q = (p - 0.85) / 0.15;
  return settlePx * (1 - easeInOut(q));
}

/**
 * Which section straddles the 55% viewport line RIGHT NOW, read from
 * live layout. This mirrors App's ScrollTrigger rule ('top 55%' …
 * 'bottom 55%') but is computed from geometry on demand, so it cannot
 * be missed, swallowed or invalidated the way a scroll event can —
 * the arrival machine watches BOTH sources (see the watchdog in the
 * rAF below). Direction-agnostic by construction: the same answer
 * scrolling up, down, or landing on a section you've visited before.
 */
function geometricSectionId(): SectionConfig['id'] | null {
  if (typeof window === 'undefined') return null;
  const line = window.innerHeight * 0.55;
  for (const cfg of SECTIONS) {
    const el = document.getElementById(cfg.id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= line && r.bottom >= line) return cfg.id;
  }
  return null;
}

/** Greeting first, then the section's own explanation — same bubble. */
function speakSection(id: SectionConfig['id'], onDone?: () => void) {
  const cfg = SECTIONS.find((s) => s.id === id);
  if (!cfg) return;
  const A = CHARACTER.arrival;
  useStore.getState().saySequence(
    [
      { text: A.greetingText, durationMs: A.greetingMs },
      {
        text: isMobileNow() ? cfg.mobileBubbleText : cfg.bubbleText,
        durationMs: BUBBLE.sectionDurationMs,
      },
    ],
    onDone,
  );
}

// ---------------------------------------------------------------------------
// The guide: sway wrapper (pendulum + arrival transforms) around the
// anchored container (DOM rope segment + canvas).
// ---------------------------------------------------------------------------
export default function GuideModel3D({ onFail }: { onFail: () => void }) {
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Shared motion clock (seconds, accumulated) — drives sway, the
   *  arrival machine AND the in-scene bone life, so they never drift. */
  const motionTimeRef = useRef(0);
  const readyRef = useRef(false);
  /** Motion-clock time of the latest landing (drives the knee bend). */
  const landingRef = useRef(-Infinity);
  /** Motion-clock time of the last geometric-section watchdog check. */
  const lastWatchRef = useRef(0);
  /** Pixels he must travel up to leave the screen fully (set by publish). */
  const travelRef = useRef(900);
  const arrivalRef = useRef<ArrivalState>({
    phase: 'risen',
    since: 0,
    from: 0,
    offset: 0,
    riseVel: 0,
    loadSpoken: 'hero',
    lastSeen: 'hero',
    seenAt: 0,
    stillSince: 0,
    screenStillSince: 0,
    spoken: 'hero',
    scrollVel: 0,
    lastScrollY: null,
    hotSince: -1,
    lockHeld: false,
    speaking: false,
    departurePending: false,
    bobPhase: 0,
    bobAmp: 0,
  });
  /** Reduced-motion mode: last section greeted by text swap alone. */
  const reducedSpokenRef = useRef<SectionConfig['id'] | null>(null);
  /** Token of the current arrival speech lock (store-owned). */
  const speechTokenRef = useRef(0);

  useEffect(() => {
    // Publish his fixed geometry for the speech bubble — on mount and
    // on resize ONLY, mirroring GuideMedallion exactly (including the
    // --guide-nav-h CSS variable the fixed positioning relies on).
    const publish = () => {
      const vw = window.innerWidth;
      const mobile = vw < 768;
      const w = mobile ? CHARACTER.modelWidthMobilePx : CHARACTER.modelWidthDesktopPx;
      const h = mobile ? CHARACTER.modelHeightMobilePx : CHARACTER.modelHeightDesktopPx;
      const right = mobile
        ? CHARACTER.fixedRightMobilePx
        : CHARACTER.fixedRightDesktopPx;

      const header = document.querySelector('header');
      const navH = header?.offsetHeight ?? 0;
      if (navH > 0) {
        document.documentElement.style.setProperty('--guide-nav-h', `${navH}px`);
      }
      const effectiveNavH = navH > 0 ? navH : mobile ? 70 : 78;
      const topPx = effectiveNavH + CHARACTER.fixedNavGapPx;

      // Arrival travel: to vanish completely he must rise by his top
      // offset + his full height (+ a small margin so his feet clear
      // the top edge of the screen).
      travelRef.current = topPx + h + 8;

      const centerX = vw - right - w / 2;
      // His head sits ~21% down the framed figure (see framing maths
      // in this file's header history: frame centre = model y 1.01,
      // head centre ≈ y 1.74 in a ±1.23 world-unit half-frame).
      const headY = topPx + h * 0.21;
      guideScreenPos.centerX = centerX;
      guideScreenPos.centerY = headY;
      guideScreenPos.sizePx = w;
      guideScreenPos.ready = true;
      guideBandPos.hookX = centerX;
      guideBandPos.hookY = topPx + CHARACTER.hookSizePx / 2;
      guideBandPos.anchorX = centerX;
      guideBandPos.ready = true;
    };

    publish();
    window.addEventListener('resize', publish);
    // While this guide is mounted it owns section speech (the arrival
    // routine speaks on landing). App checks this flag before saying
    // a section line directly; when the GLB fails and we unmount, the
    // flag clears and App speaks for the medallion fallback instead.
    useStore.getState().setArrivalGuideMounted(true);
    return () => {
      window.removeEventListener('resize', publish);
      guideScreenPos.ready = false;
      guideBandPos.ready = false;
      useStore.getState().setArrivalGuideMounted(false);
      // If he was mid-choreography holding the speech lock, let it
      // go — the fallback guide that mounts in our place must be
      // free to speak (the token store's 30s failsafe would free
      // it eventually, but never leave it waiting if we know).
      if (arrivalRef.current.lockHeld) {
        arrivalRef.current.lockHeld = false;
        useStore.getState().endArrivalSpeech(speechTokenRef.current);
      }
    };
  }, []);

  // ---- reduced motion: no rise/descend, no sway — but the greeting
  // text swap on section arrivals still happens, in place. -----------
  useEffect(() => {
    if (!prefersReducedMotion) return;
    let timer: number | undefined;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.currentSection === prev.currentSection) return;
      window.clearTimeout(timer);
      const id = state.currentSection;
      timer = window.setTimeout(() => {
        const st = useStore.getState();
        if (!st.welcomed || st.currentSection !== id) return;
        if (reducedSpokenRef.current === id) return;
        reducedSpokenRef.current = id;
        const token = st.beginArrivalSpeech();
        speakSection(id, () => useStore.getState().endArrivalSpeech(token));
      }, CHARACTER.arrival.debounceMs);
    });
    // Same geometric watchdog as the animated path (below): keep the
    // store's section honest from live layout, both scroll directions.
    // A new section found here flows through the subscription above,
    // whose repeat-guard only suppresses greeting the SAME section
    // twice in a row — leaving and returning re-greets, as it should.
    const watch = window.setInterval(() => {
      const geo = geometricSectionId();
      if (geo && geo !== useStore.getState().currentSection) {
        useStore.getState().setSection(geo);
      }
    }, 250);
    return () => {
      unsub();
      window.clearTimeout(timer);
      window.clearInterval(watch);
    };
  }, []);

  // ---- the one rAF: motion clock + sway + choreography machine ---
  useEffect(() => {
    if (prefersReducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const A = CHARACTER.arrival;
    const M = CHARACTER.motion;
    const arr = arrivalRef.current;
    // Critically damped climb spring: c = 2√k — the fastest possible
    // approach to the exit with NO overshoot (he must never bob past
    // "fully out" and peek back in).
    const riseK = A.riseSpring;
    const riseC = 2 * Math.sqrt(riseK);

    /** Departure: hide the bubble, take the speech lock, climb. */
    const startDeparture = (store: ReturnType<typeof useStore.getState>) => {
      // No bubble may float over his empty spot while he is up:
      // clear whatever is showing. (If a sequence was somehow still
      // queued, clearing drops it without its onDone — the matching
      // bookkeeping is repaired by `speaking` being reset here too.)
      store.hideBubble();
      arr.speaking = false;
      if (!arr.lockHeld) {
        speechTokenRef.current = store.beginArrivalSpeech();
        arr.lockHeld = true;
      }
      arr.phase = 'rising';
      arr.riseVel = 0;
      arr.departurePending = false;
    };

    /** Release the speech lock if (and only if) we hold it. */
    const releaseLock = (store: ReturnType<typeof useStore.getState>) => {
      if (arr.lockHeld) {
        arr.lockHeld = false;
        store.endArrivalSpeech(speechTokenRef.current);
      }
    };

    /**
     * Fire the greeting → explanation for a section, under the lock
     * we already hold. The sequence's onDone is the exact moment the
     * speech ENDS: it clears `speaking` and releases the lock — so a
     * scroll that arrived mid-sentence (departurePending) is acted
     * on by the very next frame, never mid-sentence.
     */
    const speakGreeting = (
      store: ReturnType<typeof useStore.getState>,
      id: SectionConfig['id'],
    ) => {
      arr.speaking = true;
      arr.spoken = id;
      speakSection(id, () => {
        arr.speaking = false;
        releaseLock(store);
      });
    };

    /**
     * One frame of the climb spring, toward the full exit (−travel).
     * Also advances the climb bob in proportion to the distance
     * actually climbed — the bob IS the hand-over-hand rhythm.
     */
    const springUp = (dt: number, travel: number) => {
      const prev = arr.offset;
      const accel = -riseK * (arr.offset + travel) - riseC * arr.riseVel;
      arr.riseVel += accel * dt;
      arr.offset += arr.riseVel * dt;
      if (arr.offset < -travel) {
        arr.offset = -travel;
        arr.riseVel = 0;
      }
      if (arr.offset > 0) {
        arr.offset = 0;
        arr.riseVel = 0;
      }
      const climbed = prev - arr.offset;
      if (climbed > 0) {
        arr.bobPhase += (climbed / travel) * A.climbBobCycles * TAU;
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      motionTimeRef.current += dt;
      const t = motionTimeRef.current;
      const store = useStore.getState();

      // Watch the section (store = the same source the bubble uses).
      if (store.currentSection !== arr.lastSeen) {
        arr.lastSeen = store.currentSection;
        arr.seenAt = t;
      }
      // Geometric watchdog (~every 150 ms): App's ScrollTriggers are
      // one driver of currentSection, but an event can be missed or
      // invalidated on a real phone (mobile URL-bar resizes refresh
      // trigger geometry mid-gesture). Live layout can't lie and
      // doesn't care about scroll DIRECTION — if geometry says a
      // different section owns the 55% line, believe geometry. This
      // is what guarantees arrivals fire symmetrically: up, down,
      // first visit or fiftieth.
      if (t - lastWatchRef.current >= 0.15) {
        lastWatchRef.current = t;
        const geo = geometricSectionId();
        if (geo && geo !== store.currentSection) {
          store.setSection(geo);
          arr.lastSeen = geo;
          arr.seenAt = t;
        }
      }
      // "Settled" also requires the SCROLL to have stopped: a section
      // the reader is merely gliding through on momentum must not
      // trigger a routine — only the section they actually land on
      // does, exactly once. The hard cap (debounce + 1.2 s of section
      // stability) guarantees a creeping scroll can never starve an
      // arrival forever.
      if (Math.abs(store.scrollVelocity) >= 3) arr.stillSince = t;
      const settled =
        t - arr.seenAt >= A.debounceMs / 1000 &&
        (t - arr.stillSince >= A.debounceMs / 1000 ||
          t - arr.seenAt >= A.debounceMs / 1000 + 1.2);
      const travel = travelRef.current;

      // --- Live scroll signals, from the SCREEN's actual movement --
      // scrollY deltas per frame → smoothed velocity (rate 12/s: a
      // single noisy frame can't yank him, but he answers within a
      // frame or two). ANY direction counts — the choreography
      // climbs on up-scrolls exactly as on down-scrolls.
      const yNow = window.scrollY;
      if (arr.lastScrollY === null) {
        arr.lastScrollY = yNow;
        arr.screenStillSince = t;
      }
      const dy = yNow - arr.lastScrollY;
      arr.lastScrollY = yNow;
      if (Math.abs(dy) >= 1) arr.screenStillSince = t;
      const instVel = dt > 0 ? dy / dt : 0;
      arr.scrollVel += (instVel - arr.scrollVel) * (1 - Math.exp(-12 * dt));
      const rawScrolling = Math.abs(arr.scrollVel) > A.stopPxPerSec;
      if (rawScrolling) {
        if (arr.hotSince < 0) arr.hotSince = t;
      } else {
        arr.hotSince = -1;
      }
      // A departure needs the scroll to PERSIST briefly (a one-frame
      // wheel nudge shouldn't banish him); a stop needs the screen
      // TRULY still, so smooth scrolling's dying tail can't fake one.
      const scrollHot =
        arr.hotSince >= 0 && t - arr.hotSince >= A.scrollHotMs / 1000;
      const scrollStopped =
        t - arr.screenStillSince >= A.scrollColdMs / 1000;
      // Failsafe self-heal: if the store's 30 s lock failsafe dropped
      // a lock we still believe we hold (a very long scroll), quietly
      // re-take it — the lock's whole job is that nothing else speaks
      // while he is away.
      if (arr.lockHeld && !store.arrivalSpeaking) {
        speechTokenRef.current = store.beginArrivalSpeech();
      }

      // Travel dressing for THIS frame (see the composition below):
      // a lean while the rope carries him, sized by the phase below.
      let travelTiltDeg = 0;

      switch (arr.phase) {
        case 'risen': {
          // Page-load hold: he starts up out of sight, then lowers
          // himself in once the model is ready (3 s cap so a slow
          // GLB never traps him up there — the placeholder comes
          // down instead).
          arr.offset = -travel;
          if (t >= A.loadDelayMs / 1000 && (readyRef.current || t >= 3)) {
            arr.phase = 'loadDescend';
            arr.since = t;
            arr.from = arr.offset;
            arr.loadSpoken = store.currentSection;
          }
          break;
        }
        case 'loadDescend': {
          // The page-load drop-in: the same physical descent the
          // choreography uses, once, with the welcome line instead
          // of a greeting.
          const p = Math.min((t - arr.since) / (A.descentMs / 1000), 1);
          arr.offset = descendOffset(p, arr.from, A.settlePx);
          // Lowering him, the lean trails the descent and melts to
          // zero exactly as he lands (the knee bend takes it then).
          travelTiltDeg = A.travelTiltDeg * 0.8 * Math.sin(Math.PI * p);
          if (p >= 1) {
            arr.offset = 0;
            arr.phase = 'home';
            landingRef.current = t; // knees absorb from this instant
            // Load landing: the welcome sequence owns his voice.
            // Mark greeted ONLY the section current when the descent
            // began — if the visitor already scrolled mid-drop-in,
            // that section is still greeted next (from home, once
            // it settles).
            arr.spoken = arr.loadSpoken;
          }
          break;
        }
        case 'home': {
          arr.offset = 0;
          if (arr.speaking) {
            // Mid-sentence: NEVER yank him up the rope. If the
            // visitor is scrolling, park the departure — the
            // sequence's onDone clears `speaking` and the lock, and
            // the pending departure is acted on the frame after.
            if (rawScrolling) arr.departurePending = true;
            break;
          }
          if (arr.departurePending) {
            arr.departurePending = false;
            if (rawScrolling) {
              startDeparture(store);
              break;
            }
            // The scroll died during the speech — nothing to leave
            // for; fall through to the in-place greeting check.
          }
          if (scrollHot) {
            // THE CHOREOGRAPHY, step 1: scrolling → he climbs.
            startDeparture(store);
          } else if (
            store.welcomed &&
            settled &&
            arr.lastSeen !== arr.spoken
          ) {
            // A section settled WITHOUT a climb (a glide too gentle
            // to trip the climb, a nav tap): greet it in place — he
            // is already home. Raise the speech lock first so the
            // fast-scroll director cannot clear the greeting's queue
            // mid-play; the sequence's own onDone lowers it — exact,
            // not a duration estimate.
            speechTokenRef.current = store.beginArrivalSpeech();
            arr.lockHeld = true;
            speakGreeting(store, arr.lastSeen);
          }
          break;
        }
        case 'rising': {
          // Step 1, continued: spring-climb to the FULL exit WHILE
          // the screen moves. He leans INTO the climb in proportion
          // to how much rope he has taken in.
          springUp(dt, travel);
          travelTiltDeg = -A.travelTiltDeg * Math.min(1, -arr.offset / travel);
          if (scrollStopped) {
            // Step 2 begins: the wait counts from TRUE stillness,
            // not from when the smoothed velocity happened to die.
            arr.phase = 'waiting';
            arr.since = arr.screenStillSince;
          }
          break;
        }
        case 'waiting': {
          // Step 2: he stays up ~1 s. The spring keeps pulling him
          // to the exit meanwhile (he "remains on top"), and the
          // lean holds with him.
          springUp(dt, travel);
          travelTiltDeg = -A.travelTiltDeg * Math.min(1, -arr.offset / travel);
          if (rawScrolling) {
            arr.phase = 'rising'; // scroll resumed — back to climbing
          } else if (t - arr.since >= A.waitAfterScrollMs / 1000) {
            // Step 3: he comes down "like real world".
            arr.phase = 'descending';
            arr.since = t;
            arr.from = arr.offset;
          }
          break;
        }
        case 'descending': {
          if (rawScrolling) {
            // Scroll resumed mid-descent: straight back UP. No
            // greeting had started (speech only begins on landing),
            // so nothing needs cancelling — the lock simply stays
            // raised for the next attempt.
            arr.phase = 'rising';
            arr.riseVel = 0;
            break;
          }
          const p = Math.min((t - arr.since) / (A.descentMs / 1000), 1);
          arr.offset = descendOffset(p, arr.from, A.settlePx);
          // The lean trails the lowering and melts to zero exactly
          // as he lands (the knee bend takes it from there).
          travelTiltDeg = A.travelTiltDeg * 0.8 * Math.sin(Math.PI * p);
          if (p >= 1) {
            arr.offset = 0;
            arr.phase = 'home';
            landingRef.current = t; // knees absorb from this instant
            // Step 4: ON LANDING, greet — but only a NEW section,
            // and only once the welcome has played (before that the
            // welcome owns his voice; the home settle-greet picks
            // the section up right after it).
            if (store.welcomed && arr.lastSeen !== arr.spoken) {
              speakGreeting(store, arr.lastSeen);
            } else {
              releaseLock(store);
            }
          }
          break;
        }
      }

      // Climb-bob envelope: swells while he is actually hauling
      // himself up, dies away once he is up, coming down, or home.
      const climbing =
        (arr.phase === 'rising' || arr.phase === 'waiting') && arr.riseVel < -5;
      arr.bobAmp += ((climbing ? 1 : 0) - arr.bobAmp) * (1 - Math.exp(-6 * dt));
      const bobY = arr.bobAmp * A.climbBobPx * Math.sin(arr.bobPhase);

      // Compose sway + choreography into the wrapper's ONE
      // transform. Pivot (transform-origin: 50% 0 on .guide-sway)
      // is the rope's anchor at the top of the viewport, so the
      // rotate() IS the pendulum; the translateY() carries the
      // choreography offset plus the climb bob. The travel tilt
      // rides INSIDE the same rotate() — still one writer, one
      // clock, and layout never moves (transform-only).
      const sway =
        M.swayDeg * Math.sin((TAU * t) / M.swayPeriodS) +
        M.swayHarmonicDeg *
          Math.sin((TAU * t) / M.swayHarmonicPeriodS + 1.3);
      const el = wrapRef.current;
      if (el) {
        el.style.transform = `translate3d(0, ${(arr.offset + bobY).toFixed(2)}px, 0) rotate(${(sway + travelTiltDeg).toFixed(4)}deg)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="guide-sway"
      data-guide-sway="true"
      ref={wrapRef}
      style={
        // He starts the page up out of sight, ready for the drop-in;
        // the rAF writes the real transform from its first frame.
        // (Reduced motion: no transform, ever — statue in place.)
        prefersReducedMotion
          ? undefined
          : { transform: 'translate3d(0, -120vh, 0)' }
      }
    >
      <div className="guide-model3d" data-guide-model3d="true">
        {/* the rope: viewport top → the container's top edge, where
            the in-scene rope takes over down to his hands. It lives
            inside the sway/choreography layer and is a full
            viewport tall, so at every climb/descent offset its
            visible length above his hands shrinks/grows with him
            while its top end stays far above the screen — the line
            can never detach. */}
        <div
          className="guide-model-rope"
          style={{ background: ROPE.color, boxShadow: '0 0 6px rgba(0,0,0,0.35)' }}
          aria-hidden="true"
        />

        {/* loading placeholder: his avatar image until the GLB is posed */}
        {!ready && (
          <div className="guide-model-placeholder" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}${CHARACTER.imageFile}`}
              alt=""
              draggable={false}
            />
          </div>
        )}

        <GuideErrorBoundary onFail={onFail}>
          <Canvas
            frameloop={prefersReducedMotion ? 'demand' : 'always'}
            dpr={[1, 2]}
            camera={{ fov: 30, position: [0, 0, 4.6], near: 0.1, far: 30 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
              preserveDrawingBuffer: true,
            }}
            style={{ pointerEvents: 'none' }}
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[2.5, 3, 5]} intensity={1.9} />
            <pointLight position={[-3, -1, 3]} intensity={6} color="#D99A2B" />
            <Suspense fallback={null}>
              <HangingFigure
                onReady={() => {
                  readyRef.current = true;
                  setReady(true);
                }}
                motionEnabled={!prefersReducedMotion}
                motionTimeRef={motionTimeRef}
                landingRef={landingRef}
              />
            </Suspense>
          </Canvas>
        </GuideErrorBoundary>

        <span className="sr-only">3D model of {SITE.name} hanging from a rope</span>
      </div>
    </div>
  );
}

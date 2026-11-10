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
 *  - ARRIVALS (CHARACTER.arrival): when the active section changes
 *    and settles, he climbs straight up out of the screen along the
 *    rope, waits ~1 s, drops back into the exact same spot with a ≤4px
 *    settle, then the bubble says the greeting and the section's text.
 *    The same drop-in plays once on page load (welcome text instead).
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
}: {
  onReady?: () => void;
  motionEnabled: boolean;
  motionTimeRef: RefObject<number>;
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
    if (bones.thighL) applyWorldDelta(bones.thighL, axisDelta(0, 0, 1, legAngle));
    if (bones.thighR) applyWorldDelta(bones.thighR, axisDelta(0, 0, 1, legAngle));
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
// Section arrivals — the choreography state machine. It runs inside
// the same rAF as the sway (one transform writer for the wrapper), and
// watches the store's currentSection — the SAME source of truth the
// speech bubble uses (fed by App's ScrollTriggers).
//
//   risen ──(load delay + model ready)──▶ descending ──▶ idle
//   idle ──(new section settles 300 ms)──▶ rising ──▶ waiting
//   waiting ──(waitMs)──▶ descending ──(land)──▶ speak + idle
//
// While rising/waiting, a newer settled section simply retargets the
// routine (and restarts the wait), so flying past three sections in a
// fast scroll produces exactly ONE routine — for the settled section.
// ---------------------------------------------------------------------------
type ArrivalPhase = 'risen' | 'idle' | 'rising' | 'waiting' | 'descending';

interface ArrivalState {
  phase: ArrivalPhase;
  /** Motion-clock time the current phase began. */
  since: number;
  /** translateY (px) when the current phase began. */
  from: number;
  /** Current translateY (px): 0 = home, negative = up the rope. */
  offset: number;
  /** Section the routine is currently greeting. */
  target: SectionConfig['id'];
  /** Section to speak for when the descent lands (null on load). */
  speakOnLand: SectionConfig['id'] | null;
  /**
   * Load drop-in only: the section that was current when the descent
   * BEGAN. The landing marks THIS as greeted — never the section at
   * completion time, or a fast first scroll during the drop-in would
   * be marked "already greeted" and never get its routine.
   */
  loadSpoken: SectionConfig['id'];
  /** Latest section the store reported. */
  lastSeen: SectionConfig['id'];
  /** Motion-clock time `lastSeen` last changed. */
  seenAt: number;
  /** Last section he has spoken for (or landed on, on load). */
  spoken: SectionConfig['id'];
}

function descendOffset(p: number, from: number, settlePx: number): number {
  // Two segments: a fast ease-out that lands settlePx PAST home, then
  // a short ease back up into place. Total overshoot = settlePx (4px).
  if (p < 0.8) {
    const q = p / 0.8;
    return from + (settlePx - from) * (1 - Math.pow(1 - q, 3));
  }
  const q = (p - 0.8) / 0.2;
  return settlePx * (1 - easeInOut(q));
}

/** Greeting first, then the section's own explanation — same bubble. */
function speakSection(id: SectionConfig['id']) {
  const cfg = SECTIONS.find((s) => s.id === id);
  if (!cfg) return;
  const A = CHARACTER.arrival;
  useStore.getState().saySequence([
    { text: A.greetingText, durationMs: A.greetingMs },
    {
      text: isMobileNow() ? cfg.mobileBubbleText : cfg.bubbleText,
      durationMs: BUBBLE.sectionDurationMs,
    },
  ]);
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
  /** Pixels he must travel up to leave the screen fully (set by publish). */
  const travelRef = useRef(900);
  const arrivalRef = useRef<ArrivalState>({
    phase: 'risen',
    since: 0,
    from: 0,
    offset: 0,
    target: 'hero',
    speakOnLand: null,
    loadSpoken: 'hero',
    lastSeen: 'hero',
    seenAt: 0,
    spoken: 'hero',
  });
  /** Reduced-motion mode: last section greeted by text swap alone. */
  const reducedSpokenRef = useRef<SectionConfig['id'] | null>(null);

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
        speakSection(id);
      }, CHARACTER.arrival.debounceMs);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, []);

  // ---- the one rAF: motion clock + sway + arrival state machine ----
  useEffect(() => {
    if (prefersReducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const A = CHARACTER.arrival;
    const M = CHARACTER.motion;
    const arr = arrivalRef.current;

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
      const settled = t - arr.seenAt >= A.debounceMs / 1000;
      const travel = travelRef.current;

      switch (arr.phase) {
        case 'risen': {
          // Page-load hold: he starts up out of sight, then drops in
          // once the model is ready (3 s cap so a slow GLB never
          // traps him up there — the placeholder drops in instead).
          arr.offset = -travel;
          if (
            t >= A.loadDelayMs / 1000 &&
            (readyRef.current || t >= 3)
          ) {
            arr.phase = 'descending';
            arr.since = t;
            arr.from = arr.offset;
            arr.speakOnLand = null; // load: App's welcome line speaks
            arr.loadSpoken = store.currentSection;
          }
          break;
        }
        case 'idle': {
          arr.offset = 0;
          if (store.welcomed && settled && arr.lastSeen !== arr.spoken) {
            arr.phase = 'rising';
            arr.since = t;
            arr.from = arr.offset;
            arr.target = arr.lastSeen;
          }
          break;
        }
        case 'rising': {
          if (settled && arr.lastSeen !== arr.target) {
            arr.target = arr.lastSeen;
          }
          const p = Math.min((t - arr.since) / (A.riseMs / 1000), 1);
          const e = p * p; // ease-in: he accelerates away up the rope
          arr.offset = arr.from + (-travel - arr.from) * e;
          if (p >= 1) {
            arr.phase = 'waiting';
            arr.since = t;
          }
          break;
        }
        case 'waiting': {
          arr.offset = -travel;
          if (settled && arr.lastSeen !== arr.target) {
            // A newer section settled while he was up — greet that
            // one instead, and restart the beat so the pause holds.
            arr.target = arr.lastSeen;
            arr.since = t;
          }
          if (t - arr.since >= A.waitMs / 1000) {
            arr.phase = 'descending';
            arr.since = t;
            arr.from = arr.offset;
            arr.speakOnLand = arr.target;
          }
          break;
        }
        case 'descending': {
          const p = Math.min((t - arr.since) / (A.descendMs / 1000), 1);
          arr.offset = descendOffset(p, arr.from, A.settlePx);
          if (p >= 1) {
            arr.offset = 0;
            arr.phase = 'idle';
            if (arr.speakOnLand) {
              // If yet another section settled during the drop,
              // greet the one he actually landed on.
              const id =
                settled && arr.lastSeen !== arr.speakOnLand
                  ? arr.lastSeen
                  : arr.speakOnLand;
              speakSection(id);
              arr.spoken = id;
            } else {
              // Load landing: the welcome sequence owns his voice.
              // Mark greeted ONLY the section current when the drop
              // began — if the visitor already scrolled mid-drop-in,
              // that section still gets its own routine next.
              arr.spoken = arr.loadSpoken;
            }
            arr.speakOnLand = null;
          }
          break;
        }
      }

      // Compose sway + arrival into the wrapper's ONE transform.
      // Pivot (transform-origin: 50% 0 on .guide-sway) is the rope's
      // anchor at the top of the viewport, so the rotate() IS the
      // pendulum; the translateY() is the arrival climb/drop.
      const sway =
        M.swayDeg * Math.sin((TAU * t) / M.swayPeriodS) +
        M.swayHarmonicDeg *
          Math.sin((TAU * t) / M.swayHarmonicPeriodS + 1.3);
      const el = wrapRef.current;
      if (el) {
        el.style.transform = `translate3d(0, ${arr.offset.toFixed(2)}px, 0) rotate(${sway.toFixed(4)}deg)`;
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
            inside the swaying/climbing layer, so its visible length
            pays in and out with him as he rises and drops. */}
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
              />
            </Suspense>
          </Canvas>
        </GuideErrorBoundary>

        <span className="sr-only">3D model of {SITE.name} hanging from a rope</span>
      </div>
    </div>
  );
}

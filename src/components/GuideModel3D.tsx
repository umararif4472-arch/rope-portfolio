/**
 * GuideModel3D — the guide as a REAL 3D model of Umar, hanging from a
 * frozen rope (the Avaturn GLB at public/model.glb).
 *
 * Umar's rule, stated five times and enforced here in code: the model
 * and the rope DO NOT MOVE. Not on scroll, not between sections, not
 * when he is "scared". Concretely:
 *  - The wrapper is `position: fixed` in plain CSS (`.guide-model3d`
 *    in src/index.css) — same top-right spot below the navbar as the
 *    medallion, sized from CHARACTER.model*Px.
 *  - The GLB is posed ONCE on load (bone rotations: both arms up
 *    overhead, hands meeting at the rope; legs straight, feet
 *    together) and then never touched again. There is NO useFrame
 *    anywhere in this file.
 *  - The canvas runs frameloop="demand": it renders when the model
 *    arrives and a few extra times while textures settle, then sits
 *    perfectly still. Scrolling does not invalidate it.
 *  - The rope is a static DOM segment from the top of the viewport
 *    down to the container, continuing in-scene as a static cylinder
 *    from the frame top down to his hands. One straight amber line,
 *    forever.
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
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CHARACTER, MODEL_PATH, ROPE } from '../config/character';
import { SITE } from '../config/site';
import { guideBandPos, guideScreenPos } from '../store/useStore';

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
// Texture readiness — the placeholder may only hide once a REAL
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
// The figure (GLB + in-scene rope), posed once and rendered on demand.
// ---------------------------------------------------------------------------
export function HangingFigure({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF(MODEL_PATH);
  const invalidate = useThree((s) => s.invalidate);
  const readyFired = useRef(false);

  useLayoutEffect(() => {
    poseHanging(scene);
    invalidate();
  }, [scene, invalidate]);

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
// The fixed guide container (DOM) + canvas.
// ---------------------------------------------------------------------------
export default function GuideModel3D({ onFail }: { onFail: () => void }) {
  const [ready, setReady] = useState(false);

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
    return () => {
      window.removeEventListener('resize', publish);
      guideScreenPos.ready = false;
      guideBandPos.ready = false;
    };
  }, []);

  return (
    <div className="guide-model3d" data-guide-model3d="true">
      {/* the static rope: viewport top → the container's top edge,
          where the in-scene rope takes over down to his hands */}
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
          frameloop="demand"
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
            <HangingFigure onReady={() => setReady(true)} />
          </Suspense>
        </Canvas>
      </GuideErrorBoundary>

      <span className="sr-only">3D model of {SITE.name} hanging from a rope</span>
    </div>
  );
}

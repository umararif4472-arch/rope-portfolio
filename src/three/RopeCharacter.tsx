/**
 * RopeCharacter — rope + character + the follow/spring brain, in 3D.
 *
 * What happens here every frame:
 *  1. Work out where the character SHOULD hang: on the right side of the
 *     screen, at the `hangDepth` of the section that is currently active
 *     (from config SECTIONS).
 *  2. A spring (stiffness/damping from config FOLLOW) pulls the rope's
 *     target length toward that depth, so he glides with weight.
 *     While `isFastScrolling` is true he does NOT get the new target —
 *     that is the "lag behind" part of the scared reaction.
 *  3. The verlet RopeSim steps, and the rope mesh (a TubeGeometry rebuilt
 *     from the sim points) follows it — stretching/shortening visibly.
 *  4. The character group is placed on the rope's last point. His X is
 *     HARD-LOCKED to the anchor line (plus a deliberate micro-sway of a
 *     few hundredths of a unit): the anchor is nailed to the right side
 *     of the screen and scrolling only ever changes the rope's LENGTH.
 *     He travels straight down/up like a lift — he cannot wander.
 *  5. His screen position is projected and published to
 *     `characterScreenPos` so the DOM speech bubble can follow him.
 *
 * Welcome drop: the spring starts at a very short length high above the
 * hero target, so on load he drops in with one gentle wiggle and settles.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CHARACTER, FOLLOW, ROPE, SECTIONS } from '../config/character';
import { useStore, characterScreenPos, guideBandPos, isMobileNow, prefersReducedMotion } from '../store/useStore';
import { RopeSim } from './RopeSim';
import CharacterModel from './CharacterModel';

export default function RopeCharacter() {
  const viewport = useThree((s) => s.viewport);
  const camera = useThree((s) => s.camera);
  const tubeRef = useRef<THREE.Mesh>(null!);
  const charRef = useRef<THREE.Group>(null!);
  const mountRef = useRef<THREE.Group>(null!);

  // Spring state (kept in refs — 60fps values don't belong in React state).
  const spring = useRef({ length: 0.6, velocity: 0 });
  // Smoothed copy of the follow target — the spring chases THIS, so a new
  // section's destination eases in instead of yanking him (see config).
  const smoothTarget = useRef(0.6);
  const welcomed = useRef(false);
  // Smoothed micro-sway amplitude (world units) + when the welcome wiggle
  // started, so the one welcome sway can decay away gracefully.
  const swayAmp = useRef(0);
  const welcomeStart = useRef<number | null>(null);

  const sim = useMemo(
    () => new RopeSim(new THREE.Vector3(0, 0, 0), 0.6),
    [],
  );

  // Anchor at the top-centre-right of the visible world.
  const anchorFor = (mobile: boolean) => {
    const frac = mobile ? FOLLOW.anchorRightFractionMobile : FOLLOW.anchorRightFractionDesktop;
    return new THREE.Vector3(
      viewport.width / 2 - viewport.width * frac,
      viewport.height / 2 + 0.6, // slightly above the top edge
      0,
    );
  };

  useEffect(() => {
    sim.setAnchor(anchorFor(isMobileNow()));
    // Welcome drop: he simply lowers in; the frame loop adds ONE small
    // decaying wiggle (see welcomeStart below) — no sideways kick, so he
    // can never swing off his anchor line even on arrival.
    const id = window.setTimeout(() => {
      welcomed.current = true;
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.width, viewport.height]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = state.clock.elapsedTime;
    const store = useStore.getState();
    const mobile = isMobileNow();
    const scale = mobile ? FOLLOW.scaleMobile : FOLLOW.scaleDesktop;

    // -- 1+2. spring toward the active section's hang depth ------------------
    const section = SECTIONS.find((s) => s.id === store.currentSection) ?? SECTIONS[0];
    const anchor = anchorFor(mobile);
    sim.setAnchor(anchor);
    // Fix pass 4 (image guide): the MEDALLION owns the visible position
    // (DOM safe band — see GuideMedallion.tsx) and the rope now follows
    // IT: drive the target length from the medallion's clamped hook Y so
    // the rope's end lands on the hook. (Screen px → world Y: the canvas
    // is full-screen, so worldY = (0.5 − hookY/vh) × viewport.height.)
    // The 3D-character mode keeps the original section hangDepth target.
    let desiredLength: number;
    if (CHARACTER.useImageGuide && guideBandPos.ready) {
      const hookWorldY =
        (0.5 - guideBandPos.hookY / window.innerHeight) * viewport.height;
      desiredLength = Math.max(0.6, anchor.y - hookWorldY);
    } else {
      const targetCharY = viewport.height / 2 - section.hangDepth * viewport.height;
      desiredLength = Math.max(0.6, anchor.y - targetCharY);
    }

    if (!store.isFastScrolling) {
      // Smooth the target itself first (exponential low-pass) so section
      // changes start gently, then run the spring toward it.
      smoothTarget.current +=
        (desiredLength - smoothTarget.current) *
        Math.min(1, dt * FOLLOW.targetSmoothing);
      // Spring (semi-implicit Euler), with a hard speed cap so however far
      // he has to travel, he glides — never darts.
      const accel =
        FOLLOW.stiffness * (smoothTarget.current - spring.current.length) -
        FOLLOW.damping * spring.current.velocity;
      spring.current.velocity += accel * dt;
      spring.current.velocity = THREE.MathUtils.clamp(
        spring.current.velocity,
        -FOLLOW.maxSpeed,
        FOLLOW.maxSpeed,
      );
      spring.current.length += spring.current.velocity * dt;
    } else {
      // Keep the smoothed target in sync while frozen, so the catch-up
      // doesn't start with a sudden jump.
      smoothTarget.current = spring.current.length;
    }
    // else: frozen target = he lags behind while you scroll too fast.
    sim.targetLength = spring.current.length;

    // -- sway: a MICRO-sway only, and only while parked at a section -------
    // Fix pass 2: sway is no longer a force (forces made him wander). It
    // is a tiny target offset fed to the sim's X-lock: at most
    // FOLLOW.idleSway (0.02 world units ≈ a few pixels) while he hangs
    // still, switching OFF completely while he is travelling so the glide
    // is perfectly straight, and capped at ROPE.scaredSway during the
    // scared reaction — a shiver on the spot, never a trip across screen.
    const travelling =
      Math.abs(spring.current.velocity) > 0.04 ||
      Math.abs(smoothTarget.current - spring.current.length) > 0.02;
    const panicking =
      store.isFastScrolling || store.mood === 'swing' || store.mood === 'scared';
    let ampTarget = 0;
    if (!prefersReducedMotion) {
      ampTarget = panicking ? ROPE.scaredSway : travelling ? 0 : FOLLOW.idleSway;
    }
    swayAmp.current = THREE.MathUtils.damp(swayAmp.current, ampTarget, 3, dt);
    let swayOffset = Math.sin(t * 0.55) * swayAmp.current;
    // One gentle welcome wiggle that decays away over ~3 s.
    if (welcomed.current && welcomeStart.current === null) welcomeStart.current = t;
    if (welcomeStart.current !== null && !prefersReducedMotion) {
      const wt = t - welcomeStart.current;
      if (wt < 4) swayOffset += Math.sin(wt * 2.4) * 0.04 * Math.exp(-wt * 1.15);
    }
    sim.swayOffsetX = THREE.MathUtils.clamp(swayOffset, -ROPE.maxSway, ROPE.maxSway);
    // While travelling, the rope gets the extra-strong "through honey"
    // damping; while parked, the normal calm damping.
    sim.motionDamping = travelling ? ROPE.motionDamping : ROPE.damping;

    // -- 3. step the rope (at the calmer physics time scale from config) -----
    sim.step(dt * ROPE.timeScale);

    // -- rebuild the rope tube from the sim points -----------------------------
    const curve = new THREE.CatmullRomCurve3(sim.points);
    const geo = new THREE.TubeGeometry(curve, 40, ROPE.radius, 6, false);
    tubeRef.current.geometry.dispose();
    tubeRef.current.geometry = geo;

    // -- 4. place the character on the rope end --------------------------------
    // His X is taken from the anchor line + micro-sway directly (not from
    // the sim), so the character group can NEVER sit anywhere else.
    const end = sim.endPoint;
    charRef.current.position.copy(end);
    charRef.current.position.x = anchor.x + sim.swayOffsetX;
    charRef.current.rotation.z = prefersReducedMotion ? 0 : -sim.bottomAngle * 0.75;
    charRef.current.scale.setScalar(scale);

    // anchor mount (little ceiling hook) follows viewport resizes
    mountRef.current.position.copy(anchor);

    // -- 5. publish screen position for the bubble + image medallion -----------
    tmp.copy(end);
    tmp.x = anchor.x + sim.swayOffsetX; // same locked X the character uses
    // Image guide (fix pass 3): the DOM medallion's hook must sit EXACTLY
    // on the rope's end point, so publish the end point untouched.
    // 3D character: his head is a bit below the grip point — offset to it.
    if (!CHARACTER.useImageGuide) tmp.y -= 0.5 * scale;
    tmp.project(camera);
    const w = window.innerWidth;
    const h = window.innerHeight;
    characterScreenPos.x = (tmp.x * 0.5 + 0.5) * w;
    characterScreenPos.y = (-tmp.y * 0.5 + 0.5) * h;
    characterScreenPos.heightPx = 2.35 * scale * (h / viewport.height);
    characterScreenPos.ready = true;
  });

  return (
    <group>
      {/* ceiling mount / hook the rope hangs from */}
      <group ref={mountRef}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.09, 0.13, 0.22, 12]} />
          <meshStandardMaterial color="#D99A2B" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[2.4, 0.07, 0.07]} />
          <meshStandardMaterial color="#134e4a" roughness={0.6} />
        </mesh>
      </group>

      {/* the rope itself (geometry rebuilt every frame from the sim) */}
      <mesh ref={tubeRef}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]), 8, ROPE.radius, 6, false]} />
        <meshStandardMaterial color={ROPE.color} roughness={0.55} />
      </mesh>

      {/* The character mount point on the rope's last point.
          Fix pass 3: while CHARACTER.useImageGuide is on, the visible
          character is the DOM medallion (GuideMedallion.tsx) hanging on
          this exact point — the 3D character (procedural shapes or your
          future model.glb via CharacterModel) is NOT mounted, so its
          code path stays dormant but intact. Flip the config flag to
          bring the 3D character back. */}
      <group ref={charRef}>
        {CHARACTER.useImageGuide ? null : <CharacterModel />}
      </group>
    </group>
  );
}

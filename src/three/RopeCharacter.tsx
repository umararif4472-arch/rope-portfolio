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
 *  4. The character group is placed on the rope's last point, tilted by
 *     the rope's swing angle like a real pendulum.
 *  5. His screen position is projected and published to
 *     `characterScreenPos` so the DOM speech bubble can follow him.
 *
 * Welcome drop: the spring starts at a very short length high above the
 * hero target, so on load he drops in, swings, and settles on his own.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FOLLOW, ROPE, SECTIONS } from '../config/character';
import { useStore, characterScreenPos, isMobileNow, prefersReducedMotion } from '../store/useStore';
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
  const welcomed = useRef(false);

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
    // Welcome drop: one sideways kick so he swings as he lands.
    const id = window.setTimeout(() => {
      if (!prefersReducedMotion) sim.kick(2.2);
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
    const targetCharY = viewport.height / 2 - section.hangDepth * viewport.height;
    const desiredLength = Math.max(0.6, anchor.y - targetCharY);

    if (!store.isFastScrolling) {
      // Normal spring (semi-implicit Euler).
      const accel =
        FOLLOW.stiffness * (desiredLength - spring.current.length) -
        FOLLOW.damping * spring.current.velocity;
      spring.current.velocity += accel * dt;
      spring.current.length += spring.current.velocity * dt;
    }
    // else: frozen target = he lags behind while you scroll too fast.
    sim.targetLength = spring.current.length;

    // -- sway: gentle idle breeze, wild when dragged fast or swinging --------
    if (prefersReducedMotion) {
      sim.swayForce = 0;
    } else if (store.isFastScrolling || store.mood === 'swing') {
      sim.swayForce = Math.sin(t * 7.3) * 26;
    } else if (store.mood === 'scared') {
      sim.swayForce = Math.sin(t * 22) * 7;
    } else {
      sim.swayForce = Math.sin(t * 0.9) * FOLLOW.idleSway * 22;
    }

    // -- 3. step the rope ------------------------------------------------------
    sim.step(dt);

    // -- rebuild the rope tube from the sim points -----------------------------
    const curve = new THREE.CatmullRomCurve3(sim.points);
    const geo = new THREE.TubeGeometry(curve, 40, ROPE.radius, 6, false);
    tubeRef.current.geometry.dispose();
    tubeRef.current.geometry = geo;

    // -- 4. place the character on the rope end --------------------------------
    const end = sim.endPoint;
    charRef.current.position.copy(end);
    charRef.current.rotation.z = prefersReducedMotion ? 0 : -sim.bottomAngle * 0.75;
    charRef.current.scale.setScalar(scale);

    // anchor mount (little ceiling hook) follows viewport resizes
    mountRef.current.position.copy(anchor);

    // -- 5. publish screen position for the speech bubble -----------------------
    tmp.copy(end);
    tmp.y -= 0.5 * scale; // approx. his head
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

      {/* the character, attached to the rope's last point */}
      <group ref={charRef}>
        <CharacterModel />
      </group>
    </group>
  );
}

/**
 * ProceduralCharacter — the stand-in hero, built from plain Three.js shapes.
 *
 * He is used whenever `public/model.glb` is missing or fails to load, which
 * means he IS the default experience until Umar drops in his real model.
 *
 * His body parts are grouped like bones — shoulder pivots, a head pivot, hip
 * pivots — and every mood (wave, point, nod, thumbsUp, scared, idle, swing)
 * is faked by rotating those pivots each frame. When the real GLB arrives,
 * THIS file is what gets skipped; nothing else changes.
 *
 * Local space: origin = the point where his hands grip the rope.
 * Everything hangs DOWNWARD from there (negative Y).
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, prefersReducedMotion } from '../store/useStore';

// Umar's brand palette (deep teal + amber), matched to his 3D avatar.
const TEAL = '#0e4f4a';
const TEAL_DARK = '#08312e';
const AMBER = '#D99A2B';
const SKIN = '#e8b08a';
const HAIR = '#241610';
const DARK = '#101418';

const damp = THREE.MathUtils.damp;

export default function ProceduralCharacter() {
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const mood = useStore.getState().mood;
    const calm = prefersReducedMotion;
    const L = 7.5; // how fast pivots ease toward their target pose (lower = gentler)

    // ---- target poses per mood -------------------------------------------
    // Arms hang UP to the rope by default (he is holding on!).
    let aLz = -0.55, aRz = 0.55, aLx = 0, aRx = 0; // arm rotation.z / .x
    let headX = 0, headY = Math.sin(t * 0.6) * 0.06, headZ = 0;
    let legSwing = Math.sin(t * 1.4) * 0.06;
    let tremble = 0;

    switch (mood) {
      case 'wave':
        aRz = -1.05 + (calm ? 0 : Math.sin(t * 6) * 0.35); // right arm up + waving (slowed)
        headZ = 0.08;
        break;
      case 'point':
        aRz = 1.4; // right arm stretched out toward the content (his left)
        break;
      case 'nod':
        headX = calm ? 0.18 : Math.abs(Math.sin(t * 2.4)) * 0.3;
        break;
      case 'thumbsUp':
        aRz = -0.55;
        aRx = -0.9; // forearm bent up in front — thumb up!
        break;
      case 'scared':
        aLz = -1.9; aRz = 1.9; // both arms thrown up
        tremble = calm ? 0 : 0.02; // visible tremble, but smaller/slower than before
        headY = calm ? 0 : Math.sin(t * 20) * 0.12;
        legSwing = calm ? 0 : Math.sin(t * 14) * 0.18;
        break;
      case 'swing':
        aLz = -1.5; aRz = 1.5; // arms out, flailing while dragged
        legSwing = calm ? 0 : Math.sin(t * 4) * 0.2;
        headZ = calm ? 0 : Math.sin(t * 3.8) * 0.1;
        break;
      default: // idle — gentle breathing sway
        aLz = -0.55 + Math.sin(t * 1.4) * 0.04;
        aRz = 0.55 - Math.sin(t * 1.4) * 0.04;
    }

    // ---- ease every pivot toward its target --------------------------------
    armL.current.rotation.z = damp(armL.current.rotation.z, aLz, L, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, aRz, L, dt);
    armL.current.rotation.x = damp(armL.current.rotation.x, aLx, L, dt);
    armR.current.rotation.x = damp(armR.current.rotation.x, aRx, L, dt);
    head.current.rotation.x = damp(head.current.rotation.x, headX, L, dt);
    head.current.rotation.y = damp(head.current.rotation.y, headY, L, dt);
    head.current.rotation.z = damp(head.current.rotation.z, headZ, L, dt);
    legL.current.rotation.x = damp(legL.current.rotation.x, legSwing, L, dt);
    legR.current.rotation.x = damp(legR.current.rotation.x, -legSwing, L, dt);

    // Body tremble (scared) — tiny rapid jitter on the whole body group.
    if (tremble > 0) {
      body.current.position.set(
        (Math.random() - 0.5) * tremble,
        (Math.random() - 0.5) * tremble,
        0,
      );
    } else {
      body.current.position.set(0, Math.sin(t * 1.2) * 0.012, 0);
    }
  });

  return (
    <group ref={body}>
      {/* ------------------------------ arms (shoulder pivots) ------------- */}
      <group ref={armL} position={[-0.33, -0.6, 0]}>
        <mesh position={[0, 0.27, 0]}>
          <capsuleGeometry args={[0.095, 0.4, 6, 12]} />
          <meshStandardMaterial color={TEAL} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.105, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.33, -0.6, 0]}>
        <mesh position={[0, 0.27, 0]}>
          <capsuleGeometry args={[0.095, 0.4, 6, 12]} />
          <meshStandardMaterial color={TEAL} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <sphereGeometry args={[0.105, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* the all-important thumb */}
        <mesh position={[0.07, 0.62, 0.03]}>
          <capsuleGeometry args={[0.032, 0.07, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* ------------------------------ head (neck pivot) ------------------ */}
      <group ref={head} position={[0, -0.66, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.27, 24, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.65} />
        </mesh>
        {/* hair — a slightly bigger half-dome tipped back */}
        <mesh position={[0, 0.27, -0.045]} rotation={[0.35, 0, 0]}>
          <sphereGeometry args={[0.278, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={HAIR} roughness={0.85} />
        </mesh>
        {/* beard */}
        <mesh position={[0, 0.05, 0.13]} rotation={[0.5, 0, 0]}>
          <sphereGeometry args={[0.19, 20, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.5]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* sunglasses — his signature look */}
        <mesh position={[0, 0.24, 0.235]}>
          <boxGeometry args={[0.42, 0.11, 0.05]} />
          <meshStandardMaterial color={DARK} roughness={0.25} metalness={0.4} />
        </mesh>
        {/* smile */}
        <mesh position={[0, 0.08, 0.252]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>
      </group>

      {/* ------------------------------ torso ------------------------------ */}
      <mesh position={[0, -1.08, 0]}>
        <capsuleGeometry args={[0.31, 0.5, 8, 16]} />
        <meshStandardMaterial color={TEAL} roughness={0.6} />
      </mesh>
      {/* amber collar + belt — the brand accents */}
      <mesh position={[0, -0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.045, 10, 24]} />
        <meshStandardMaterial color={AMBER} roughness={0.4} />
      </mesh>
      <mesh position={[0, -1.38, 0]}>
        <cylinderGeometry args={[0.315, 0.315, 0.09, 20]} />
        <meshStandardMaterial color={AMBER} roughness={0.4} />
      </mesh>

      {/* ------------------------------ legs (hip pivots) ------------------ */}
      <group ref={legL} position={[-0.15, -1.48, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 6, 12]} />
          <meshStandardMaterial color={TEAL_DARK} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0.05]}>
          <boxGeometry args={[0.16, 0.09, 0.3]} />
          <meshStandardMaterial color={AMBER} roughness={0.45} />
        </mesh>
      </group>
      <group ref={legR} position={[0.15, -1.48, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 6, 12]} />
          <meshStandardMaterial color={TEAL_DARK} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0.05]}>
          <boxGeometry args={[0.16, 0.09, 0.3]} />
          <meshStandardMaterial color={AMBER} roughness={0.45} />
        </mesh>
      </group>
    </group>
  );
}

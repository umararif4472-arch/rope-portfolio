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

// Colours matched to Umar's real 3D avatar (public/guide-fallback.webp):
// warm brown skin, black swept hair + full black beard, black sunglasses,
// NAVY polo with a GOLD collar, BLACK long arm sleeves, dark trousers.
const NAVY = '#1E3A5F'; // polo shirt
const NAVY_DARK = '#16293F';
const GOLD = '#D99A2B'; // polo collar + placket
const SKIN = '#9C6642'; // warm medium-brown skin
const HAIR = '#0B0908'; // near-black hair + beard
const SLEEVE = '#0D0F12'; // black arm sleeves / shoes
const TROUSER = '#1B2432'; // dark charcoal-navy trousers
const LENS = '#05070A'; // sunglasses lenses

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
      {/* ------------------------------ arms (shoulder pivots) -------------
          Each arm, top→bottom: short NAVY polo sleeve, then a BLACK long
          arm-sleeve to the wrist, then a skin-tone hand gripping the rope. */}
      <group ref={armL} position={[-0.34, -0.6, 0]}>
        <mesh position={[0, 0.16, 0]}>
          <capsuleGeometry args={[0.105, 0.16, 6, 12]} />
          <meshStandardMaterial color={NAVY} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <capsuleGeometry args={[0.085, 0.26, 6, 12]} />
          <meshStandardMaterial color={SLEEVE} roughness={0.75} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.34, -0.6, 0]}>
        <mesh position={[0, 0.16, 0]}>
          <capsuleGeometry args={[0.105, 0.16, 6, 12]} />
          <meshStandardMaterial color={NAVY} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <capsuleGeometry args={[0.085, 0.26, 6, 12]} />
          <meshStandardMaterial color={SLEEVE} roughness={0.75} />
        </mesh>
        {/* smartwatch on his LEFT wrist (the +X side, facing the visitor) */}
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[0.2, 0.055, 0.2]} />
          <meshStandardMaterial color={SLEEVE} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.52, 0.095]}>
          <boxGeometry args={[0.095, 0.05, 0.02]} />
          <meshStandardMaterial
            color="#9FD8E8"
            emissive="#2E5E6E"
            emissiveIntensity={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* the all-important thumb */}
        <mesh position={[0.07, 0.7, 0.03]}>
          <capsuleGeometry args={[0.032, 0.07, 4, 8]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* ------------------------------ head (neck pivot) ------------------
          Slightly large head so the features read at small size: swept
          black hair with volume, a full black beard band on the jaw,
          glossy sunglasses, warm brown skin. */}
      <group ref={head} position={[0, -0.66, 0]} scale={1.07}>
        {/* neck */}
        <mesh position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.16, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* skull / face */}
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.29, 24, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.65} />
        </mesh>
        {/* ears */}
        <mesh position={[-0.285, 0.2, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        <mesh position={[0.285, 0.2, 0]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* hair — a cap of volume on top, tipped slightly back */}
        <mesh position={[0, 0.245, -0.02]} rotation={[-0.15, 0, 0]} scale={[1, 0.85, 1]}>
          <sphereGeometry args={[0.298, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* the swept-up fringe / quiff at the front */}
        <mesh position={[0, 0.4, 0.13]} scale={[1.15, 0.55, 0.8]}>
          <sphereGeometry args={[0.16, 18, 14]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* beard — a shell band wrapping jaw, chin and lower cheeks */}
        <mesh position={[0, 0.215, 0.01]} scale={[0.98, 1, 0.98]}>
          <sphereGeometry
            args={[0.295, 24, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]}
          />
          <meshStandardMaterial color={HAIR} roughness={0.95} />
        </mesh>
        {/* subtle mouth line just above the beard */}
        <mesh position={[0, 0.1, 0.288]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.045, 0.01, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#5A4030" roughness={0.7} />
        </mesh>
        {/* sunglasses — glossy black bar + two lens panels + temple arms */}
        <group position={[0, 0.28, 0.245]}>
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[0.47, 0.055, 0.045]} />
            <meshStandardMaterial color={LENS} roughness={0.15} metalness={0.55} />
          </mesh>
          <mesh position={[-0.115, -0.03, 0.005]}>
            <boxGeometry args={[0.175, 0.125, 0.05]} />
            <meshStandardMaterial color={LENS} roughness={0.12} metalness={0.6} />
          </mesh>
          <mesh position={[0.115, -0.03, 0.005]}>
            <boxGeometry args={[0.175, 0.125, 0.05]} />
            <meshStandardMaterial color={LENS} roughness={0.12} metalness={0.6} />
          </mesh>
          <mesh position={[-0.245, 0.03, -0.09]}>
            <boxGeometry args={[0.03, 0.04, 0.24]} />
            <meshStandardMaterial color={LENS} roughness={0.2} metalness={0.5} />
          </mesh>
          <mesh position={[0.245, 0.03, -0.09]}>
            <boxGeometry args={[0.03, 0.04, 0.24]} />
            <meshStandardMaterial color={LENS} roughness={0.2} metalness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ------------------------------ torso: navy polo ------------------- */}
      <mesh position={[0, -1.08, 0]}>
        <capsuleGeometry args={[0.32, 0.5, 8, 16]} />
        <meshStandardMaterial color={NAVY} roughness={0.6} />
      </mesh>
      {/* GOLD polo collar — a band at the neck, like the real shirt */}
      <mesh position={[0, -0.79, 0]}>
        <cylinderGeometry args={[0.19, 0.235, 0.11, 20]} />
        <meshStandardMaterial color={GOLD} roughness={0.45} />
      </mesh>
      {/* small gold placket line down the chest */}
      <mesh position={[0, -0.97, 0.312]}>
        <boxGeometry args={[0.05, 0.24, 0.02]} />
        <meshStandardMaterial color={GOLD} roughness={0.45} />
      </mesh>
      {/* plain dark belt where polo meets trousers */}
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.325, 0.325, 0.07, 20]} />
        <meshStandardMaterial color={NAVY_DARK} roughness={0.6} />
      </mesh>

      {/* ------------------------------ legs (hip pivots) ------------------ */}
      <group ref={legL} position={[-0.15, -1.48, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 6, 12]} />
          <meshStandardMaterial color={TROUSER} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0.05]}>
          <boxGeometry args={[0.16, 0.09, 0.3]} />
          <meshStandardMaterial color={SLEEVE} roughness={0.5} />
        </mesh>
      </group>
      <group ref={legR} position={[0.15, -1.48, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <capsuleGeometry args={[0.11, 0.42, 6, 12]} />
          <meshStandardMaterial color={TROUSER} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.66, 0.05]}>
          <boxGeometry args={[0.16, 0.09, 0.3]} />
          <meshStandardMaterial color={SLEEVE} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

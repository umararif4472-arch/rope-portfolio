/**
 * CharacterModel — loads YOUR rigged model from /model.glb, safely.
 *
 * Behaviour:
 *  1. `useGLTF` lazily loads public/model.glb (Draco-compressed files OK)
 *     inside <Suspense>. A class ErrorBoundary catches a missing/broken
 *     file, and in both cases the ProceduralCharacter takes over — the
 *     site can never break just because the model is not there yet.
 *  2. When the GLB loads, `useAnimations` plays the clip whose name matches
 *     the current mood in config's CLIPS map.
 *  3. If a named clip is MISSING from the file, we fall back to procedural
 *     bone animation: we look for bones named like Mixamo's (*Head*,
 *     *RightArm*, *LeftArm*, *Spine*) and rotate those directly.
 *
 * To use your own model: export it as public/model.glb with clips named
 * to match CLIPS in src/config/character.ts (see README → "Your own model").
 */
import { Component, Suspense, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CLIPS, DRACO_DECODER_PATH, MODEL_PATH } from '../config/character';
import { useStore, prefersReducedMotion } from '../store/useStore';
import ProceduralCharacter from './ProceduralCharacter';

// --- tiny error boundary (React requires a class for this) ------------------
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    // Not fatal — the procedural character is the designed fallback.
    console.info('[guide] model.glb unavailable, using procedural character:', error.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// --- the GLB character -------------------------------------------------------
function GlbCharacter() {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_PATH, DRACO_DECODER_PATH);
  const { actions } = useAnimations(animations, group);
  const mood = useStore((s) => s.mood);
  const missingClip = useRef(false);
  const bones = useRef<{ head?: THREE.Object3D; armR?: THREE.Object3D; armL?: THREE.Object3D }>({});

  // Find animatable bones once, for the procedural fallback.
  useEffect(() => {
    const found: typeof bones.current = {};
    scene.traverse((obj) => {
      const n = obj.name.toLowerCase();
      if (!found.head && n.includes('head')) found.head = obj;
      if (!found.armR && n.includes('rightarm') && !n.includes('fore')) found.armR = obj;
      if (!found.armL && n.includes('leftarm') && !n.includes('fore')) found.armL = obj;
    });
    bones.current = found;
  }, [scene]);

  // Play the clip for the current mood; note if it is missing.
  useEffect(() => {
    const clipName = CLIPS[mood];
    const action = actions[clipName];
    missingClip.current = !action;
    if (action) {
      action.reset().fadeIn(0.25).play();
      return () => {
        action.fadeOut(0.25);
      };
    }
    // No clip for this mood → keep idle playing underneath, bones do the rest.
    const idle = actions[CLIPS.idle];
    idle?.reset().fadeIn(0.25).play();
    return undefined;
  }, [actions, mood]);

  // Procedural bone fallback for missing clips (best-effort, Mixamo names).
  useFrame((state) => {
    if (!missingClip.current) return;
    const t = state.clock.elapsedTime;
    const { head, armR, armL } = bones.current;
    const calm = prefersReducedMotion;
    if (mood === 'wave' && armR) armR.rotation.z = -0.6 + (calm ? 0 : Math.sin(t * 6) * 0.35);
    if (mood === 'nod' && head) head.rotation.x = calm ? 0.15 : Math.abs(Math.sin(t * 2.4)) * 0.3;
    if (mood === 'point' && armR) armR.rotation.x = -1.35;
    if (mood === 'thumbsUp' && armR) armR.rotation.z = -0.4;
    if (mood === 'scared') {
      const j = calm ? 0 : 0.015;
      group.current.position.set((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, 0);
      if (armR) armR.rotation.z = -1.8;
      if (armL) armL.rotation.z = 1.8;
    }
  });

  // Free GPU memory when this unmounts.
  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
    };
  }, [scene]);

  return (
    <group ref={group}>
      {/* The model is authored hanging downward from its grip point;
          scale/position are normalised in RopeCharacter. */}
      <primitive object={scene} />
    </group>
  );
}

export default function CharacterModel() {
  return (
    <ModelErrorBoundary fallback={<ProceduralCharacter />}>
      <Suspense fallback={<ProceduralCharacter />}>
        <GlbCharacter />
      </Suspense>
    </ModelErrorBoundary>
  );
}

/**
 * Scene — the fixed, full-screen, click-through 3D layer.
 *
 * The canvas sits above the page (z-index) but has pointer-events: none,
 * so every link, button and card underneath stays clickable. Rendering
 * pauses while the tab is hidden (battery + CPU friendly). We keep
 * frameloop="always" while visible because the rope physics is continuous
 * — the README explains why "demand" mode doesn't fit a physics loop.
 */
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import RopeCharacter from './RopeCharacter';

export default function Scene() {
  const [frameloop, setFrameloop] = useState<'always' | 'never'>('always');

  useEffect(() => {
    const onVisibility = () =>
      setFrameloop(document.hidden ? 'never' : 'always');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30"
      aria-hidden="true" // the guide also exists as real DOM text in the bubble
    >
      <Canvas
        dpr={[1, 1.75]} // cap pixel ratio: crisp but 60fps-friendly
        camera={{ fov: 42, position: [0, 0, 12], near: 0.1, far: 60 }}
        frameloop={frameloop}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 8]} intensity={1.6} />
        <pointLight position={[-6, -2, 6]} intensity={12} color="#D99A2B" />
        <RopeCharacter />
      </Canvas>
    </div>
  );
}

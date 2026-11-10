/**
 * LoadingScreen — shown while the 3D model (and page) loads.
 *
 * Progress comes from drei's useProgress, which tracks every asset the
 * 3D layer requests (including model.glb — even when it 404s and the
 * procedural character takes over, loading still "completes").
 * A safety timeout in App.tsx guarantees the welcome sequence starts
 * even if progress reporting behaves oddly.
 */
import { useProgress } from '@react-three/drei';
import { SITE } from '../config/site';

export default function LoadingScreen({ done }: { done: boolean }) {
  const { progress, active } = useProgress();
  const shown = Math.max(progress, done ? 100 : 0);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#071512] transition-opacity duration-700 ${
        done ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden={done}
      role="status"
      aria-label="Loading portfolio"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#D99A2B]">
        {SITE.firstName} is climbing up…
      </p>
      <div className="mt-6 h-2 w-64 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#D99A2B] transition-[width] duration-300"
          style={{ width: `${shown}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-white/50">
        {active ? `Loading assets — ${Math.round(shown)}%` : 'Almost ready…'}
      </p>
    </div>
  );
}

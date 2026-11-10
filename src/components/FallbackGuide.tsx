/**
 * FallbackGuide — the graceful 2D fallback when WebGL is unavailable.
 *
 * Instead of the 3D character you get his 3D-avatar portrait
 * (public/guide-fallback.webp) as a small fixed companion, bottom-right,
 * with the same section texts from config shown beside it. No physics,
 * no swinging — just a friendly guide that still explains every section.
 */
import { useEffect, useState } from 'react';
import { SECTIONS } from '../config/character';
import { SITE } from '../config/site';
import { useStore, isMobileNow } from '../store/useStore';

export default function FallbackGuide() {
  const currentSection = useStore((s) => s.currentSection);
  const bubbleText = useStore((s) => s.bubbleText);
  const bubbleVisible = useStore((s) => s.bubbleVisible);
  const [mobile, setMobile] = useState(isMobileNow());

  useEffect(() => {
    const onResize = () => setMobile(isMobileNow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const section = SECTIONS.find((s) => s.id === currentSection);
  const text =
    bubbleText ||
    (section ? (mobile ? section.mobileBubbleText : section.bubbleText) : '');

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex items-end gap-3">
      <div
        className={`relative max-w-[240px] rounded-2xl bg-white px-4 py-3 text-[13px] font-medium leading-snug text-slate-900 shadow-xl transition-all duration-300 ${
          bubbleVisible || text ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        role="status"
        aria-live="polite"
      >
        {text}
        <span
          className="absolute bottom-4 right-[-7px] h-4 w-4 rotate-45 rounded-[3px] bg-white"
          aria-hidden="true"
        />
      </div>
      <img
        src={`${import.meta.env.BASE_URL}guide-fallback.webp`}
        alt={`3D avatar of ${SITE.name}, your guide`}
        width={76}
        height={100}
        className="h-[92px] w-auto rounded-2xl border-2 border-[#D99A2B]/70 object-cover shadow-2xl"
        loading="lazy"
      />
    </div>
  );
}

/**
 * SpeechBubble — a DOM overlay (not drei <Html>) that follows the character.
 *
 * Why DOM and not <Html>? The bubble must stay pixel-crisp, be readable by
 * screen readers (aria-live) and never fight the WebGL layer. Each frame we
 * read the character's projected screen position from `characterScreenPos`
 * (written by the 3D loop) and move this div with a CSS transform — that
 * avoids re-rendering React at 60fps; Zustand only changes when the TEXT
 * or visibility changes.
 *
 * Behaviour: typewriter text, pop in/out animation, auto-hide after the
 * duration passed to the store's `say(text, durationMs)`, and the whole
 * bubble is clamped inside the viewport on every screen size.
 */
import { useEffect, useRef, useState } from 'react';
import { BUBBLE } from '../config/character';
import { useStore, characterScreenPos, guideScreenPos } from '../store/useStore';

export default function SpeechBubble() {
  const bubbleText = useStore((s) => s.bubbleText);
  const bubbleVisible = useStore((s) => s.bubbleVisible);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const tailMode = useRef<'side' | 'below'>('side');
  const [typed, setTyped] = useState('');

  // ---- typewriter ----------------------------------------------------------
  useEffect(() => {
    if (!bubbleVisible || !bubbleText) {
      setTyped('');
      return;
    }
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(bubbleText.slice(0, i));
      if (i >= bubbleText.length) window.clearInterval(id);
    }, BUBBLE.typewriterMsPerChar);
    return () => window.clearInterval(id);
  }, [bubbleText, bubbleVisible]);

  // ---- follow the character (direct DOM transform, no re-render) -----------
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = wrapRef.current;
      if (!el || (!characterScreenPos.ready && !guideScreenPos.ready)) return;
      const bubbleW = el.offsetWidth || 260;
      const bubbleH = el.offsetHeight || 80;
      let x: number;
      let y: number;
      let mode: 'side' | 'below' = 'side';
      if (guideScreenPos.ready) {
        // IMAGE GUIDE (fix pass 3): sit to the LEFT of the medallion,
        // vertically centred on it. guideScreenPos is his final CLAMPED
        // geometry, so the bubble tracks the medallion he actually sees.
        x = guideScreenPos.centerX - guideScreenPos.sizePx / 2 - bubbleW - 14;
        y = guideScreenPos.centerY - bubbleH / 2;
        if (x < 10) {
          // No room on his left (phones): sit BELOW him, never over him.
          mode = 'below';
          x = Math.max(10, guideScreenPos.centerX - bubbleW + 70);
          y = guideScreenPos.centerY + guideScreenPos.sizePx / 2 + 12;
        }
      } else {
        // 3D character: sit to his LEFT, roughly at head height.
        x = characterScreenPos.x - bubbleW - 18;
        y = characterScreenPos.y - bubbleH - 10;
        // On narrow screens there is no room on the left — go above-left instead.
        if (x < 10) x = Math.max(10, characterScreenPos.x - bubbleW + 40);
      }
      // Clamp inside the viewport.
      x = Math.min(Math.max(10, x), window.innerWidth - bubbleW - 10);
      y = Math.min(Math.max(70, y), window.innerHeight - bubbleH - 10);
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Point the little tail at him: right side normally, top when below.
      if (tailRef.current && tailMode.current !== mode) {
        tailMode.current = mode;
        const tail = tailRef.current;
        if (mode === 'below') {
          tail.style.right = '42px';
          tail.style.top = '-7px';
          tail.style.transform = 'rotate(45deg)';
        } else {
          tail.style.right = '-7px';
          tail.style.top = '50%';
          tail.style.transform = 'translateY(-50%) rotate(45deg)';
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed left-0 top-0 z-40 will-change-transform"
      aria-live="polite"
    >
      <div
        className={`relative max-w-[270px] rounded-2xl bg-white px-4 py-3 text-[13.5px] font-medium leading-snug text-slate-900 shadow-[0_18px_45px_rgba(0,0,0,0.45)] transition-all duration-300 sm:max-w-[300px] sm:text-sm ${
          bubbleVisible
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-90 opacity-0'
        }`}
        role="status"
      >
        {typed || bubbleText}
        {/* little tail pointing at the character (repositioned by the
            follow loop: right side normally, top when the bubble sits
            below the medallion on narrow screens) */}
        <span
          ref={tailRef}
          className="absolute h-4 w-4 rounded-[3px] bg-white"
          style={{ right: '-7px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * GuideMedallion — the visible guide since fix pass 3: Umar's REAL avatar.
 *
 * Umar's verdict on the shape-built 3D character was "that's not my 3d
 * model" — and he was right: primitives can echo a person, never BE him.
 * So the visible character is now his actual 3D-avatar render
 * (public/guide-fallback.webp) in a round, gold-ringed medallion. It is
 * his real picture — exact likeness — presented as the hanging guide.
 * (It is still a picture, not a rigged 3D model: the model.glb code path
 * in CharacterModel.tsx remains for the day he drops one in, and
 * CHARACTER.useImageGuide in config switches back to it.)
 *
 * How it hangs: the 3D layer keeps simulating the calm, X-locked rope and
 * publishes the rope's END point every frame to `characterScreenPos`
 * (screen px). This component reads that point each frame and:
 *   1. adds the current mood's little dance (sway / wiggle / dip / shake),
 *   2. HARD-CLAMPS the result so the whole medallion + hook is always
 *      fully inside the viewport (see the clamp rule below),
 *   3. moves the DOM node with a direct transform — no React re-renders.
 * If the clamp ever holds him away from the rope's true end (e.g. the
 * rope wants to dip below the bottom edge), an SVG segment in this same
 * overlay bridges rope-end → hook, so the rope always looks attached.
 *
 * ==========================================================================
 *  THE ALWAYS-ON-SCREEN CLAMP (why he can NEVER leave the screen again)
 * ==========================================================================
 *  Every frame, before the transform is applied, the hook position is
 *  clamped so that:
 *      hookX ∈ [ margin + size/2 ,  vw − margin − size/2 ]
 *      hookY ∈ [ margin + ringR ,  vh − margin − circleGap − size ]
 *  i.e. the circle's left/right edges and the ring's top / circle's
 *  bottom always stay ≥ CHARACTER.edgeMarginPx (8px) inside the
 *  viewport — during section glides, fast scrolling and the scared
 *  shake alike. While clamped, he simply waits at the edge, fully
 *  visible, until the section target comes back into range; the rope
 *  length in the 3D layer adjusts on its own via the follow spring.
 */
import { useEffect, useRef } from 'react';
import { CHARACTER, ROPE } from '../config/character';
import { SITE } from '../config/site';
import { useStore, characterScreenPos, guideScreenPos, prefersReducedMotion } from '../store/useStore';

/** Vertical gap between the hook point and the top of the circle (px). */
const CIRCLE_GAP_PX = 6;

const clampRange = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

export default function GuideMedallion() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastMood = '';
    let moodSince = 0;
    let lastSize = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!characterScreenPos.ready) {
        wrap.style.opacity = '0';
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const size = vw < 768 ? CHARACTER.sizeMobilePx : CHARACTER.sizeDesktopPx;
      const margin = CHARACTER.edgeMarginPx;
      const ringR = CHARACTER.hookSizePx / 2;
      const t = performance.now() / 1000;
      const mood = useStore.getState().mood;
      if (mood !== lastMood) {
        lastMood = mood;
        moodSince = t;
      }
      const moodAge = t - moodSince;

      // ---- mood dance (translations are added BEFORE the clamp, so even
      //      the scared shake can never push him off screen) ---------------
      let shakeX = 0;
      let shakeY = 0;
      let rot = 0;
      if (!prefersReducedMotion) {
        if (mood === 'scared') {
          // Rapid small shake bursts (~0.5 s feel, lasts while mood=scared).
          shakeX = Math.sin(t * 47) * 3;
          shakeY = Math.cos(t * 39) * 2;
          rot = Math.sin(t * 30) * 2;
        } else if (mood === 'swing') {
          // Being dragged by a fast scroll — a wider, slower sway.
          rot = Math.sin(t * 3.2) * 3;
        } else if (
          (mood === 'wave' || mood === 'nod' || mood === 'point' || mood === 'thumbsUp') &&
          moodAge < 0.9
        ) {
          // One-shot greeting gestures, played once when the mood arrives.
          const env = Math.sin(Math.min(moodAge / 0.9, 1) * Math.PI); // 0→1→0
          if (mood === 'wave') {
            rot = Math.sin(moodAge * 16) * 4 * env; // friendly wiggles
          } else {
            shakeY = 7 * env; // happy dip / bounce
            rot = Math.sin(moodAge * 10) * 1.5 * env;
          }
        } else {
          // Idle (and the resting state after any one-shot): barely-there sway.
          rot = Math.sin(t * 0.9) * 1.2;
        }
      }

      // ---- THE CLAMP: hook position, hard-limited every frame -------------
      const rawX = characterScreenPos.x;
      const rawY = characterScreenPos.y;
      const hookX = clampRange(
        rawX + shakeX,
        margin + size / 2,
        vw - margin - size / 2,
      );
      const hookY = clampRange(
        rawY + shakeY,
        margin + ringR,
        vh - margin - CIRCLE_GAP_PX - size,
      );

      // ---- apply transforms directly (no React re-render) -----------------
      wrap.style.opacity = '1';
      wrap.style.transform = `translate3d(${hookX}px, ${hookY}px, 0)`;
      if (swingRef.current) {
        swingRef.current.style.transform = `rotate(${rot}deg)`;
      }
      if (circleRef.current && size !== lastSize) {
        lastSize = size;
        circleRef.current.style.width = `${size}px`;
        circleRef.current.style.height = `${size}px`;
      }

      // ---- bridge segment: rope end → hook, only while clamped apart ----
      const line = lineRef.current;
      if (line) {
        const dx = hookX - rawX;
        const dy = hookY - rawY;
        if (dx * dx + dy * dy > 2.25) {
          line.setAttribute('x1', `${rawX}`);
          line.setAttribute('y1', `${rawY}`);
          line.setAttribute('x2', `${hookX}`);
          line.setAttribute('y2', `${hookY}`);
          line.style.opacity = '1';
        } else {
          line.style.opacity = '0';
        }
      }

      // ---- publish the final geometry for the speech bubble ---------------
      guideScreenPos.centerX = hookX;
      guideScreenPos.centerY = hookY + CIRCLE_GAP_PX + size / 2;
      guideScreenPos.sizePx = size;
      guideScreenPos.ready = true;
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      guideScreenPos.ready = false;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* bridge segment between the 3D rope's end and the clamped hook */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line
          ref={lineRef}
          stroke={ROPE.color}
          strokeWidth={4}
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />
      </svg>

      {/* the medallion, positioned by direct transform at the hook point */}
      <div
        ref={wrapRef}
        className="absolute left-0 top-0 opacity-0 transition-opacity duration-500 will-change-transform"
      >
        {/* swing pivot: rotates around the hook point (transform-origin 0 0) */}
        <div
          ref={swingRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{ transformOrigin: '0 0' }}
        >
          <div
            ref={circleRef}
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: CHARACTER.sizeDesktopPx,
              height: CHARACTER.sizeDesktopPx,
              transform: `translate(-50%, ${CIRCLE_GAP_PX}px)`,
              overflow: 'hidden',
              background: '#0d2420',
              border: '4px solid #D99A2B', // gold ring (accent)
              boxShadow: '0 22px 50px rgba(0,0,0,0.55)',
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}${CHARACTER.imageFile}`}
              alt={`3D avatar of ${SITE.name}, your guide`}
              className="h-full w-full object-cover"
              style={{ objectPosition: CHARACTER.imagePosition }}
              draggable={false}
            />
          </div>
        </div>

        {/* the little metal ring the rope visually attaches to — drawn last
            so it sits on top of the circle's top edge */}
        <div
          className="absolute left-0 top-0 rounded-full"
          style={{
            width: CHARACTER.hookSizePx,
            height: CHARACTER.hookSizePx,
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle at 35% 30%, #f4f7fa 0%, #aeb9c4 45%, #5f6b76 100%)',
            boxShadow:
              'inset 0 0 0 3px rgba(38,45,52,0.85), 0 2px 6px rgba(0,0,0,0.45)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

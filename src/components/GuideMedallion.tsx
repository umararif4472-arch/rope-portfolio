/**
 * GuideMedallion — the visible guide: Umar's REAL avatar (fix pass 3),
 * repositioned on a GUARANTEED SAFE BAND (fix pass 4).
 *
 * Why pass 4 exists: in pass 3 the medallion inherited its position from
 * the 3D rope's projected end point. On the hero that point starts at the
 * very top of the viewport, and the old clamp only kept an 8px margin —
 * so the medallion slid BEHIND the fixed navbar (~65px tall) and was
 * effectively invisible in Umar's phone screenshots. The files served
 * fine; the failure was purely positional.
 *
 * ==========================================================================
 *  THE SAFE BAND — he can NEVER hide behind the navbar or leave the screen
 * ==========================================================================
 *  His position is now computed HERE, in the DOM layer, from explicit
 *  pixel bounds — fully independent of the rope simulation:
 *
 *      navH      = the real navbar height, measured at runtime from the
 *                  <header> element (offsetHeight), fallback 76px
 *      boxTop    ∈ [ navH + 10 ,  vh − 14 − boxHeight ]
 *      boxLeft   ∈ [ 8 ,  vw − 8 − size ]
 *
 *  Both ranges are then shrunk by CHARACTER.bandSafetyPx (6px) on every
 *  side, and the FINAL transform values are clamped into the shrunk
 *  ranges every frame. Mood dances are ROTATIONS around the top hook
 *  applied after clamping (plus a ≤3% scale bounce); the safety margin
 *  absorbs the few px a rotating corner can swing.
 *
 *  Within the band he still travels: the active section's index maps to
 *  a fraction of the band (hero = top of band … contact = bottom), and
 *  a critically-damped px spring glides him there with a hard speed
 *  cap. While the visitor scrolls too fast the target freezes — he lags
 *  behind, exactly like before, but always inside the band.
 *
 *  The rope still connects: this component publishes the clamped hook
 *  position to `guideBandPos` every frame; the 3D layer drives its rope
 *  length from it (see RopeCharacter.tsx), and the SVG bridge in this
 *  overlay draws any residual segment between the rope's end and the
 *  hook, so a visible disconnect cannot happen.
 */
import { useEffect, useRef } from 'react';
import { CHARACTER, FOLLOW, ROPE, SECTIONS } from '../config/character';
import { SITE } from '../config/site';
import {
  useStore,
  characterScreenPos,
  guideBandPos,
  guideScreenPos,
  prefersReducedMotion,
} from '../store/useStore';

/** Distance from the top of the medallion box to the circle's top edge. */
const CIRCLE_TOP_PX = 12;

const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi);

export default function GuideMedallion() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const swingRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastMood = '';
    let moodSince = 0;
    let lastSize = 0;
    // Glide state (px space — kept in refs, never React state).
    let curX: number | null = null;
    let curY: number | null = null;
    let velX = 0;
    let velY = 0;
    let targetX = 0;
    let targetY = 0;
    let hasTarget = false;
    // Navbar height, re-measured a few times a second (cheap + resize-safe).
    let navH = CHARACTER.navFallbackPx;
    let navMeasuredAt = 0;
    let lastTime = performance.now();

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const wrap = wrapRef.current;
      const box = boxRef.current;
      if (!wrap || !box) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 1 / 20);
      lastTime = now;
      const t = now / 1000;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 768;
      const size = mobile ? CHARACTER.sizeMobilePx : CHARACTER.sizeDesktopPx;
      const boxW = size;
      const boxH = CIRCLE_TOP_PX + size;
      const safety = CHARACTER.bandSafetyPx;

      // ---- measure the REAL navbar (its height is the band's ceiling) ----
      if (now - navMeasuredAt > 300) {
        navMeasuredAt = now;
        const header = document.querySelector('header');
        const h = header?.offsetHeight ?? 0;
        navH = h > 0 ? h : CHARACTER.navFallbackPx;
      }

      // ---- THE SAFE BAND (explicit px bounds, shrunk by the safety px) ---
      const minLeft = CHARACTER.edgeMarginPx + safety;
      const maxLeft = vw - CHARACTER.edgeMarginPx - safety - boxW;
      const minTop = navH + CHARACTER.bandTopGapPx + safety;
      const maxTop = vh - CHARACTER.bandBottomGapPx - safety - boxH;

      // ---- target: right-side x + section fraction down the band ---------
      const store = useStore.getState();
      const fracX = mobile
        ? FOLLOW.anchorRightFractionMobile
        : FOLLOW.anchorRightFractionDesktop;
      const anchorX = vw * (1 - fracX);
      if (!store.isFastScrolling) {
        // While fast-scrolling he lags: the target simply doesn't move.
        const idx = Math.max(
          0,
          SECTIONS.findIndex((s) => s.id === store.currentSection),
        );
        const frac = SECTIONS.length > 1 ? idx / (SECTIONS.length - 1) : 0;
        targetX = clamp(anchorX - boxW / 2, minLeft, maxLeft);
        targetY = clamp(minTop + frac * (maxTop - minTop), minTop, maxTop);
        hasTarget = true;
      }

      // ---- first frame: appear AT the target (visible below the navbar
      //      immediately — no waiting on the rope sim, no drop from y=0) --
      if (curX === null || curY === null) {
        curX = targetX;
        curY = targetY;
      }

      // ---- calm glide: critically-damped px spring + hard speed cap ------
      if (hasTarget) {
        const maxSpeed = mobile
          ? CHARACTER.glideMaxSpeedMobilePx
          : CHARACTER.glideMaxSpeedDesktopPx;
        const ax =
          CHARACTER.glideStiffness * (targetX - curX) - CHARACTER.glideDamping * velX;
        const ay =
          CHARACTER.glideStiffness * (targetY - curY) - CHARACTER.glideDamping * velY;
        velX = clamp(velX + ax * dt, -maxSpeed, maxSpeed);
        velY = clamp(velY + ay * dt, -maxSpeed, maxSpeed);
        curX += velX * dt;
        curY += velY * dt;
      }

      // ---- FINAL CLAMP: the values written to the transform are clamped --
      const finalX = clamp(curX, minLeft, maxLeft);
      const finalY = clamp(curY, minTop, maxTop);
      // Keep the integrator honest while clamped at an edge.
      curX = finalX;
      curY = finalY;

      // ---- mood dances: ROTATIONS ONLY (applied after the clamp; the
      //      safety margin absorbs the few px a rotating corner swings) ---
      const mood = store.mood;
      if (mood !== lastMood) {
        lastMood = mood;
        moodSince = t;
      }
      const moodAge = t - moodSince;
      let rot = 0;
      let scale = 1;
      if (!prefersReducedMotion) {
        if (mood === 'scared') {
          rot = Math.sin(t * 30) * 2.5; // rapid little shake, in place
        } else if (mood === 'swing') {
          rot = Math.sin(t * 3.2) * 3; // dragged-by-fast-scroll sway
        } else if (
          (mood === 'wave' || mood === 'nod' || mood === 'point' || mood === 'thumbsUp') &&
          moodAge < 0.9
        ) {
          const env = Math.sin(Math.min(moodAge / 0.9, 1) * Math.PI); // 0→1→0
          if (mood === 'wave') {
            rot = Math.sin(moodAge * 16) * 4 * env; // friendly wiggles
          } else {
            scale = 1 + 0.03 * env; // happy dip, as a tiny bounce
            rot = Math.sin(moodAge * 10) * 1.5 * env;
          }
        } else {
          rot = Math.sin(t * 0.9) * 1.2; // idle micro-sway
        }
      }

      // ---- apply transforms directly (no React re-render) -----------------
      wrap.style.opacity = '1';
      wrap.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
      if (swingRef.current) {
        swingRef.current.style.transform = `rotate(${rot}deg) scale(${scale})`;
      }
      if (size !== lastSize) {
        lastSize = size;
        box.style.width = `${boxW}px`;
        box.style.height = `${boxH}px`;
        if (swingRef.current) {
          swingRef.current.style.width = `${boxW}px`;
          swingRef.current.style.height = `${boxH}px`;
        }
      }

      // ---- publish final geometry -----------------------------------------
      const hookX = finalX + boxW / 2;
      const hookY = finalY + CHARACTER.hookSizePx / 2;
      guideBandPos.hookX = hookX;
      guideBandPos.hookY = hookY;
      guideBandPos.anchorX = anchorX;
      guideBandPos.ready = true;
      guideScreenPos.centerX = hookX;
      guideScreenPos.centerY = finalY + CIRCLE_TOP_PX + size / 2;
      guideScreenPos.sizePx = size;
      guideScreenPos.ready = true;

      // ---- bridge: always a drawn line from the rope to the hook ---------
      const line = lineRef.current;
      if (line) {
        // Prefer the real rope end; fall back to the top anchor point.
        const fromX = characterScreenPos.ready ? characterScreenPos.x : anchorX;
        const fromY = characterScreenPos.ready ? characterScreenPos.y : 0;
        const dx = hookX - fromX;
        const dy = hookY - fromY;
        if (dx * dx + dy * dy > 4) {
          line.setAttribute('x1', `${fromX}`);
          line.setAttribute('y1', `${fromY}`);
          line.setAttribute('x2', `${hookX}`);
          line.setAttribute('y2', `${hookY}`);
          line.style.opacity = '1';
        } else {
          line.style.opacity = '0';
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      guideBandPos.ready = false;
      guideScreenPos.ready = false;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* bridge segment between the 3D rope's end and the medallion hook */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        <line
          ref={lineRef}
          stroke={ROPE.color}
          strokeWidth={4}
          strokeLinecap="round"
          style={{ opacity: 0 }}
        />
      </svg>

      {/* The medallion BOX. The loop sets its transform to the final,
          safe-band-clamped top-left corner — the whole box (hook ring +
          circle) is guaranteed inside the band. */}
      <div
        ref={wrapRef}
        className="absolute left-0 top-0 opacity-0 transition-opacity duration-500 will-change-transform"
      >
        {/* swing pivot: rotates around the hook point (top-centre) */}
        <div
          ref={swingRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{
            width: CHARACTER.sizeDesktopPx,
            height: CIRCLE_TOP_PX + CHARACTER.sizeDesktopPx,
            transformOrigin: `50% ${CHARACTER.hookSizePx / 2}px`,
          }}
        >
          <div
            ref={boxRef}
            className="relative"
            style={{
              width: CHARACTER.sizeDesktopPx,
              height: CIRCLE_TOP_PX + CHARACTER.sizeDesktopPx,
            }}
          >
            {/* the portrait circle */}
            <div
              className="absolute left-0 rounded-full"
              style={{
                top: CIRCLE_TOP_PX,
                width: '100%',
                aspectRatio: '1 / 1',
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

            {/* the little metal ring the rope visually attaches to */}
            <div
              className="absolute rounded-full"
              style={{
                width: CHARACTER.hookSizePx,
                height: CHARACTER.hookSizePx,
                left: `calc(50% - ${CHARACTER.hookSizePx / 2}px)`,
                top: 0,
                background:
                  'radial-gradient(circle at 35% 30%, #f4f7fa 0%, #aeb9c4 45%, #5f6b76 100%)',
                boxShadow:
                  'inset 0 0 0 3px rgba(38,45,52,0.85), 0 2px 6px rgba(0,0,0,0.45)',
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

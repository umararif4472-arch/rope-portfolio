/**
 * GuideMedallion — the visible guide: Umar's REAL avatar, STUCK (fix pass 5).
 *
 * History, so the next reader understands why it looks like this:
 *  - Pass 3 made the medallion hang from the 3D rope's end point.
 *  - Pass 4 moved it onto a DOM "safe band" with a glide spring, after it
 *    hid behind the navbar in Umar's phone screenshots.
 *  - Pass 5 is Umar's final verdict after testing pass 4: "model move
 *    very freely — I want model don't move like that, it STICK."
 *
 * So now the medallion Does Not Move. At all. Ever:
 *  - ONE fixed screen position in plain CSS (`.guide-fixed` in
 *    src/index.css): `position: fixed; right: 16px (12px mobile);
 *    top: calc(var(--guide-nav-h, 78px) + 14px)` — just below the
 *    navbar, right side, identical on every section, every scroll
 *    position and every mood.
 *  - There is NO requestAnimationFrame loop here, NO glide spring, NO
 *    sway rotation, NO mood dance, NO transform on the medallion.
 *    Its transform is `none`, set by nobody, forever.
 *  - The rope is a short STATIC segment (a plain div) running from the
 *    top of the viewport down to his hook ring. It never changes.
 *  - In this mode App.tsx does not render the Three.js canvas at all,
 *    so no physics exists that could move anything on screen.
 *
 * The only things that still change are the speech bubble's TEXT and
 * visibility (SpeechBubble.tsx). For the bubble to sit beside him, this
 * component publishes his fixed geometry to `guideScreenPos` — computed
 * once on mount and again on resize (the two moments his CSS position
 * can legitimately change), using the exact same numbers the CSS uses.
 *
 * The numbers live in CHARACTER.fixed* (src/config/character.ts) and
 * are mirrored by the `.guide-fixed` rules in src/index.css.
 */
import { useEffect } from 'react';
import { CHARACTER, ROPE } from '../config/character';
import { SITE } from '../config/site';
import { guideBandPos, guideScreenPos } from '../store/useStore';

/** Distance from the top of the medallion box to the circle's top edge. */
const CIRCLE_TOP_PX = 12;

export default function GuideMedallion() {
  useEffect(() => {
    // Publish his fixed geometry (for the speech bubble) and hand the
    // navbar's real height to the CSS via --guide-nav-h. Runs on mount
    // and on resize ONLY — there is deliberately no per-frame loop.
    const publish = () => {
      const vw = window.innerWidth;
      const mobile = vw < 768;
      const size = mobile ? CHARACTER.sizeMobilePx : CHARACTER.sizeDesktopPx;
      const right = mobile
        ? CHARACTER.fixedRightMobilePx
        : CHARACTER.fixedRightDesktopPx;

      const header = document.querySelector('header');
      const navH = header?.offsetHeight ?? 0;
      if (navH > 0) {
        document.documentElement.style.setProperty(
          '--guide-nav-h',
          `${navH}px`,
        );
      }
      // Mirror the CSS fallback maths exactly: desktop var fallback is
      // 78px (→ top 92), mobile 70px (→ top 84).
      const effectiveNavH = navH > 0 ? navH : mobile ? 70 : 78;
      const topPx = effectiveNavH + CHARACTER.fixedNavGapPx;

      const centerX = vw - right - size / 2;
      const centerY = topPx + CIRCLE_TOP_PX + size / 2;
      guideScreenPos.centerX = centerX;
      guideScreenPos.centerY = centerY;
      guideScreenPos.sizePx = size;
      guideScreenPos.ready = true;
      // Kept for backward compatibility (nothing renders the 3D rope in
      // fixed mode, but the store shape stays intact).
      guideBandPos.hookX = centerX;
      guideBandPos.hookY = topPx + CHARACTER.hookSizePx / 2;
      guideBandPos.anchorX = centerX;
      guideBandPos.ready = true;
    };

    publish();
    window.addEventListener('resize', publish);
    return () => {
      window.removeEventListener('resize', publish);
      guideScreenPos.ready = false;
      guideBandPos.ready = false;
    };
  }, []);

  return (
    <div className="guide-fixed" data-guide-medallion="true">
      {/* the box: hook ring on top, portrait circle below it */}
      <div className="guide-box">
        {/* the static rope: viewport top → his hook ring. A plain div,
            positioned once by CSS; it never moves, stretches or sways. */}
        <div
          className="guide-rope"
          style={{
            background: ROPE.color,
            boxShadow: '0 0 6px rgba(0,0,0,0.35)',
          }}
          aria-hidden="true"
        />

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
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        {/* the portrait circle — his actual avatar render */}
        <div
          className="absolute left-0 w-full rounded-full"
          style={{
            top: CIRCLE_TOP_PX,
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
      </div>
    </div>
  );
}

/**
 * App — puts everything together:
 *
 *  1. Lenis smooth scrolling, driven by GSAP's ticker (the official recipe),
 *     with ScrollTrigger kept in sync and the raw scroll velocity published
 *     to the store (the guide director + 3D loop read it from there).
 *  2. GSAP ScrollTriggers per section: arriving at a section updates the
 *     store, sets the character's animation and shows his bubble — once per
 *     visit; he only repeats a section after you leave and come back.
 *  3. The welcome sequence: loading overlay → he drops in on the rope →
 *     waves → typewriter welcome bubble → auto-hide after ~5 s.
 *     (In fixed image-guide mode there is no drop-in: he is stuck in
 *     place from the first frame and only the bubble speaks.)
 *  4. Reveal animations for every `.reveal` element.
 *  5. If WebGL is unavailable, the 3D layer is swapped for the 2D
 *     FallbackGuide — everything else works identically. (Fixed image
 *     mode doesn't need WebGL at all — no canvas is rendered.)
 */
import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useProgress } from '@react-three/drei';
import { BUBBLE, CHARACTER, SECTIONS, WELCOME_TEXT } from './config/character';
import { useStore, isMobileNow, prefersReducedMotion } from './store/useStore';
import { lenisRef } from './hooks/lenisRef';
import { useGuideDirector } from './hooks/useGuideDirector';
import Navbar from './components/Navbar';
import LoadingScreen from './components/LoadingScreen';
import SpeechBubble from './components/SpeechBubble';
import GuideMedallion from './components/GuideMedallion';
import GuideModel3D from './components/GuideModel3D';
import FallbackGuide from './components/FallbackGuide';
import Scene from './three/Scene';
import Hero from './sections/Hero';
import About from './sections/About';
import Skills from './sections/Skills';
import Projects from './sections/Projects';
import Experience from './sections/Experience';
import Contact from './sections/Contact';

gsap.registerPlugin(ScrollTrigger);

/**
 * Fix pass 5: in 'fixed' image-guide mode the model is STUCK (plain CSS
 * position, static rope segment) and the Three.js canvas is not rendered
 * at all — no physics exists that could move anything on screen.
 */
const IMAGE_FIXED =
  CHARACTER.useImageGuide && CHARACTER.guideMode === 'fixed';

/**
 * Model3D guide mode: the REAL 3D model (Avaturn GLB) hangs from a
 * frozen rope at the same fixed spot. Static render only — see
 * GuideModel3D.tsx. If the GLB fails, we fall back to the medallion.
 */
const MODEL3D = CHARACTER.guideMode === 'model3d';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export default function App() {
  const [webgl] = useState(webglAvailable);
  const [loadingDone, setLoadingDone] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const { progress, active } = useProgress();
  const lastSaidSection = useRef<string | null>(null);

  useGuideDirector();

  // ---- Lenis + GSAP ticker --------------------------------------------------
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: !prefersReducedMotion,
    });
    lenisRef.current = lenis;
    lenis.on('scroll', (e) => {
      ScrollTrigger.update();
      useStore.getState().setScrollVelocity(e.velocity);
    });
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // ---- section triggers ------------------------------------------------------
  useEffect(() => {
    const triggers = SECTIONS.map((cfg) => {
      const el = document.getElementById(cfg.id);
      if (!el) return null;
      const arrive = () => {
        const store = useStore.getState();
        store.setSection(cfg.id);
        if (!store.welcomed) return; // welcome sequence owns him at first
        store.setMood(cfg.animation);
        if (MODEL3D && store.arrivalGuideMounted) {
          // The 3D guide runs its arrival routine for this section and
          // speaks when he lands (greeting first, then this section's
          // text) — saying it here too would double-speak and mistime
          // it. If the GLB failed, the guide is unmounted, the flag is
          // false, and we fall through to the direct line below.
          lastSaidSection.current = cfg.id;
          return;
        }
        if (lastSaidSection.current !== cfg.id) {
          lastSaidSection.current = cfg.id;
          store.say(
            isMobileNow() ? cfg.mobileBubbleText : cfg.bubbleText,
            BUBBLE.sectionDurationMs,
          );
        }
      };
      return ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 55%',
        onEnter: arrive,
        onEnterBack: arrive,
      });
    });
    return () => triggers.forEach((t) => t?.kill());
  }, []);

  // ---- reveal animations ------------------------------------------------------
  useEffect(() => {
    if (prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 34 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          },
        );
      });
    });
    return () => ctx.revert();
  }, []);

  // ---- loading → welcome sequence ----------------------------------------------
  useEffect(() => {
    if (loadingDone) return;
    if (IMAGE_FIXED || MODEL3D) {
      // Fixed image mode mounts no 3D scene at all. Model3d mode loads
      // its 13 MB GLB lazily in the background (placeholder + medallion
      // fallback cover the wait) — the page must never sit on a
      // loading screen for the guide's sake.
      setLoadingDone(true);
      return;
    }
    if (!active && progress >= 100) {
      setLoadingDone(true);
      return;
    }
    // Safety net: never trap the visitor on the loading screen.
    const safety = window.setTimeout(() => setLoadingDone(true), 4000);
    return () => window.clearTimeout(safety);
  }, [progress, active, loadingDone]);

  useEffect(() => {
    if (!loadingDone) return;
    const store = useStore.getState();
    // In 3D mode he drops in (≈1 s of spring + swing) first; in fixed
    // image mode he is simply THERE — stuck — from the first frame.
    // Either way he then "waves" (store mood) and says hello.
    const waveTimer = window.setTimeout(() => {
      store.setMood('wave');
      store.say(WELCOME_TEXT, BUBBLE.welcomeDurationMs);
    }, 1050);
    const doneTimer = window.setTimeout(() => {
      store.setWelcomed();
      if (useStore.getState().currentSection === 'hero') store.setMood('idle');
    }, 3600);
    return () => {
      window.clearTimeout(waveTimer);
      window.clearTimeout(doneTimer);
    };
  }, [loadingDone]);

  return (
    <div className="min-h-screen bg-[#071512] font-sans text-white antialiased">
      <a
        href="#about"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-[#D99A2B] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#071512]"
      >
        Skip to content
      </a>

      <Navbar />
      <main>
        <Hero />
        <About />
        <Skills />
        <Projects />
        <Experience />
        <Contact />
      </main>

      {MODEL3D && webgl && !modelFailed ? (
        <>
          {/* The real 3D model, posed once (arms up, gripping the rope)
              in an anchored container. No <Scene/>, no physics — only
              subtle life (sway/breathing/looks) and the up/down
              arrival routine, both driven inside GuideModel3D. */}
          <GuideModel3D onFail={() => setModelFailed(true)} />
          <SpeechBubble />
        </>
      ) : IMAGE_FIXED || MODEL3D ? (
        <>
          {/* Fix pass 5: NO <Scene/> here — the Three.js canvas is not
              rendered at all in fixed mode. The guide is the stuck CSS
              medallion + static rope segment; only the bubble changes.
              (Also the model3d fallback: GLB failed or no WebGL.) */}
          <GuideMedallion />
          <SpeechBubble />
        </>
      ) : webgl ? (
        <>
          <Scene />
          {/* With the (non-fixed) image guide on, the visible character
              is Umar's real avatar medallion; the 3D rope still renders
              inside <Scene/>. */}
          {CHARACTER.useImageGuide && <GuideMedallion />}
          <SpeechBubble />
        </>
      ) : (
        <FallbackGuide />
      )}

      <LoadingScreen done={loadingDone} />
    </div>
  );
}

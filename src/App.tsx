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
 *  4. Reveal animations for every `.reveal` element.
 *  5. If WebGL is unavailable, the 3D layer is swapped for the 2D
 *     FallbackGuide — everything else works identically.
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
import FallbackGuide from './components/FallbackGuide';
import Scene from './three/Scene';
import Hero from './sections/Hero';
import About from './sections/About';
import Skills from './sections/Skills';
import Projects from './sections/Projects';
import Experience from './sections/Experience';
import Contact from './sections/Contact';

gsap.registerPlugin(ScrollTrigger);

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
    // He drops in (≈1 s of spring + swing), then waves and says hello.
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

      {webgl ? (
        <>
          <Scene />
          {/* Fix pass 3: with the image guide on, the visible character is
              Umar's real avatar medallion hanging on the rope's end
              (the 3D rope still renders inside <Scene/>). */}
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

/** Hero — the first screen. Big type on the left; the right side is kept
 *  visually open because that's where the 3D guide hangs from his rope. */
import { SITE } from '../config/site';
import { lenisRef } from '../hooks/lenisRef';

export default function Hero() {
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (el && lenisRef.current) lenisRef.current.scrollTo(el, { offset: -70, duration: 1.4 });
  };

  return (
    <section
      id="hero"
      data-section="hero"
      className="relative flex min-h-screen items-center overflow-hidden pt-[64px]"
      aria-label="Introduction"
    >
      {/* soft amber glow, top right — behind the hanging guide */}
      <div
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-[#D99A2B]/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="mx-auto w-full max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          {/* Audit fix: on small screens the one-line pill ran UNDER the
              stuck guide medallion and its text was partially hidden.
              Below 680px the pill is width-capped (100vw − 9rem keeps it
              clear of the medallion's left edge) and wraps fully visible
              instead. Desktop rendering is unchanged. */}
          <p className="reveal inline-flex max-w-full items-center gap-2 rounded-full bg-[#D99A2B]/12 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#D99A2B] ring-1 ring-[#D99A2B]/30 max-[680px]:max-w-[calc(100vw-9rem)] max-[680px]:text-[11px] max-[680px]:leading-snug">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#D99A2B]" aria-hidden="true" />
            {SITE.availability}
          </p>
          <h1 className="reveal mt-6 text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-7xl">
            {SITE.name}
          </h1>
          <p className="reveal mt-4 text-xl font-semibold text-[#D99A2B] sm:text-2xl">
            {SITE.role}
          </p>
          <p className="reveal mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
            {SITE.bio}
          </p>
          <p className="reveal mt-4 text-sm text-white/50">
            📍 {SITE.location} · 🎓 {SITE.education}
          </p>
          <div className="reveal mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => go('projects')}
              className="rounded-full bg-[#D99A2B] px-6 py-3 text-sm font-bold text-[#071512] transition hover:bg-[#e8ab3d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              See my projects
            </button>
            <button
              onClick={() => go('contact')}
              className="rounded-full bg-white/5 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
            >
              Get in touch
            </button>
          </div>
          <p className="reveal mt-10 text-sm text-white/50">
            Psst — the little guy hanging on the right is my guide. Scroll slowly… he scares easily. 🪢
          </p>
        </div>
      </div>
    </section>
  );
}

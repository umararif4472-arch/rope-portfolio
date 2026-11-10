/**
 * Navbar — fixed top bar with smooth-scroll links.
 *
 * Clicking a link uses Lenis' scrollTo (the instance is shared through a
 * tiny ref module, see App.tsx). Because the jump is fast, Lenis reports a
 * velocity spike… which means the character reacts to navbar jumps too,
 * exactly like fast manual scrolling. That is a feature, not a bug. 🙂
 */
import { SECTIONS } from '../config/character';
import { SITE, CONTACT } from '../config/site';
import { lenisRef } from '../hooks/lenisRef';
import { useStore } from '../store/useStore';

export default function Navbar() {
  const currentSection = useStore((s) => s.currentSection);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -70, duration: 1.4 });
    else el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-[#071512]/80 backdrop-blur-md">
      {/* The right padding is NOT decoration — it reserves the stuck
          guide's strip. His static rope hangs at a fixed x near the right
          edge (mobile: viewport −66…−62px; ≥768px: −98…−94px) and crosses
          the navbar band. The padding keeps every link/button ending at
          least ~10px LEFT of the rope at every width, without ever
          moving the guide: pr-76 on mobile (66 + 10 clearance), pr-108
          from md up (98 + 10). At ≥1400px the centred max-w-6xl column
          already ends well left of the rope, so plain pr-5 returns. */}
      <nav
        className="mx-auto flex h-[64px] max-w-6xl items-center justify-between pl-4 pr-[76px] sm:pl-5 md:pr-[108px] min-[1400px]:pr-5"
        aria-label="Main navigation"
      >
        <button
          onClick={() => go('hero')}
          className="flex shrink-0 items-center gap-2.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
          aria-label={`${SITE.name} — back to top`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D99A2B] text-sm font-black text-[#071512]">
            {SITE.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </span>
          {/* Name waits for lg: at md widths the links row needs the room
              next to the reserved rope strip (and the name used to wrap
              to two lines at 768px, stretching this button to 59px). */}
          <span className="hidden font-bold tracking-tight text-white lg:block">
            {SITE.name}
          </span>
        </button>

        {/* On narrow phones the six links don't fit next to the brand at
            full size: they run smaller, the "Home" link hides under
            400px (the brand button already goes home), and as a last
            resort the row can scroll sideways instead of pushing links
            off-screen (audit fix — "Experience"/"Contact" were clipped
            or unreachable at 390px). */}
        <ul className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2 sm:overflow-visible">
          {SECTIONS.map((s) => (
            <li
              key={s.id}
              className={
                s.id === 'hero' ? 'shrink-0 max-[400px]:hidden' : 'shrink-0'
              }
            >
              <button
                onClick={() => go(s.id)}
                aria-current={currentSection === s.id ? 'true' : undefined}
                className={`rounded-full px-2 py-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B] sm:px-2 sm:py-2.5 sm:text-sm lg:px-3 ${
                  currentSection === s.id
                    ? 'bg-[#D99A2B]/15 text-[#D99A2B]'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
          <li className="ml-1 hidden md:block">
            <a
              href={CONTACT.github}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#D99A2B] px-4 py-2.5 text-sm font-semibold text-[#071512] transition hover:bg-[#e8ab3d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              GitHub ↗
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

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
      <nav
        className="mx-auto flex h-[64px] max-w-6xl items-center justify-between px-5"
        aria-label="Main navigation"
      >
        <button
          onClick={() => go('hero')}
          className="flex items-center gap-2.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
          aria-label={`${SITE.name} — back to top`}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D99A2B] text-sm font-black text-[#071512]">
            {SITE.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </span>
          <span className="hidden font-bold tracking-tight text-white sm:block">
            {SITE.name}
          </span>
        </button>

        <ul className="flex items-center gap-1 sm:gap-2">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => go(s.id)}
                aria-current={currentSection === s.id ? 'true' : undefined}
                className={`rounded-full px-3 py-2 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B] sm:text-sm ${
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
              className="rounded-full bg-[#D99A2B] px-4 py-2 text-sm font-semibold text-[#071512] transition hover:bg-[#e8ab3d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              GitHub ↗
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

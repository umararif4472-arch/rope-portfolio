/**
 * Projects — cards with cover, hover lift, and a detail modal.
 * Covers are gradient placeholders until real screenshots are dropped
 * into public/projects/ and set as `image` in src/config/site.ts.
 */
import { useState } from 'react';
import { PROJECTS } from '../config/site';
import type { Project } from '../config/site';
import ProjectModal from '../components/ProjectModal';

export default function Projects() {
  const [selected, setSelected] = useState<Project | null>(null);

  return (
    <section
      id="projects"
      data-section="projects"
      className="relative py-28"
      aria-label="My projects"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl">
          <h2 className="reveal text-3xl font-black tracking-tight text-white sm:text-5xl">
            Things I&apos;ve <span className="text-[#D99A2B]">built</span>
          </h2>
          <p className="reveal mt-5 text-white/70 sm:text-lg">
            Real projects with real users — click any card for the full story.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-6 pr-0 sm:grid-cols-2 sm:pr-24 lg:grid-cols-3 lg:pr-0">
          {PROJECTS.map((p) => (
            <li key={p.title} className="reveal">
              <button
                onClick={() => setSelected(p)}
                className="group block h-full w-full overflow-hidden rounded-3xl bg-white/[0.04] text-left ring-1 ring-white/10 transition duration-300 hover:-translate-y-1.5 hover:ring-[#D99A2B]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
                aria-label={`${p.title} — view details`}
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={`Screenshot of ${p.title}`}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-44 items-center justify-center transition duration-300 group-hover:scale-[1.03]"
                    style={{
                      background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                    }}
                    aria-hidden="true"
                  >
                    <span className="text-5xl font-black text-white/90">{p.coverLabel}</span>
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{p.tagline}</p>
                  <p className="mt-4 flex flex-wrap gap-1.5">
                    {p.tech.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-medium text-white/75 ring-1 ring-white/10"
                      >
                        {t}
                      </span>
                    ))}
                  </p>
                  <span className="mt-5 inline-block text-sm font-semibold text-[#D99A2B]">
                    View details →
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <ProjectModal project={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

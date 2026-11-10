/**
 * ProjectModal — detail view for a project card.
 * Accessible dialog: labelled, Esc to close, click-the-backdrop to close,
 * focus returns naturally, and body scroll is locked via Lenis stop/start.
 */
import { useEffect } from 'react';
import type { Project } from '../config/site';
import { lenisRef } from '../hooks/lenisRef';

export default function ProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    lenisRef.current?.stop();
    return () => {
      window.removeEventListener('keydown', onKey);
      lenisRef.current?.start();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.title} — project details`}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#0b2420] p-6 shadow-2xl ring-1 ring-white/10 sm:rounded-3xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* cover */}
        {project.image ? (
          <img
            src={project.image}
            alt={`Screenshot of ${project.title}`}
            className="mb-6 h-52 w-full rounded-2xl object-cover"
          />
        ) : (
          <div
            className="mb-6 flex h-52 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${project.gradient[0]}, ${project.gradient[1]})`,
            }}
            aria-hidden="true"
          >
            <span className="text-6xl font-black tracking-tight text-white/90">
              {project.coverLabel}
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-bold text-white">{project.title}</h3>
          <button
            onClick={onClose}
            aria-label="Close project details"
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 font-medium text-[#D99A2B]">{project.tagline}</p>
        <p className="mt-4 leading-relaxed text-white/75">{project.description}</p>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Technologies used">
          {project.tech.map((t) => (
            <li
              key={t}
              className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10"
            >
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#D99A2B] px-5 py-2.5 text-sm font-semibold text-[#071512] transition hover:bg-[#e8ab3d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              View live ↗
            </a>
          )}
          {project.codeUrl && (
            <a
              href={project.codeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
            >
              Source code ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

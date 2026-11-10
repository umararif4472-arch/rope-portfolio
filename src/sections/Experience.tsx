/** Experience — a simple vertical timeline from config (EXPERIENCE). */
import { EXPERIENCE } from '../config/site';

export default function Experience() {
  return (
    <section
      id="experience"
      data-section="experience"
      className="relative py-28"
      aria-label="My experience"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl">
          <h2 className="reveal text-3xl font-black tracking-tight text-white sm:text-5xl">
            My <span className="text-[#D99A2B]">journey</span>
          </h2>
        </div>
        <ol className="relative mt-12 max-w-3xl space-y-10 border-l border-white/10 pl-8 pr-0 sm:mr-24">
          {EXPERIENCE.map((item) => (
            <li key={item.role + item.place} className="reveal relative">
              <span
                className="absolute -left-[37px] top-1.5 h-4 w-4 rounded-full border-4 border-[#071512] bg-[#D99A2B]"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold uppercase tracking-widest text-[#D99A2B]">
                {item.period}
              </p>
              <h3 className="mt-1 text-xl font-bold text-white">{item.role}</h3>
              <p className="font-medium text-white/60">{item.place}</p>
              <ul className="mt-3 space-y-1.5 text-white/75">
                {item.points.map((pt) => (
                  <li key={pt} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D99A2B]" aria-hidden="true" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

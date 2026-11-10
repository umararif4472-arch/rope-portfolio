/** Skills — grouped skill cards from config (SKILL_GROUPS). */
import { SKILL_GROUPS } from '../config/site';

export default function Skills() {
  return (
    <section
      id="skills"
      data-section="skills"
      className="relative py-28"
      aria-label="My skills"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl">
          <h2 className="reveal text-3xl font-black tracking-tight text-white sm:text-5xl">
            My <span className="text-[#D99A2B]">skills</span>
          </h2>
          <p className="reveal mt-5 text-white/70 sm:text-lg">
            Two crafts, one goal: web and mobile, built properly and tested
            before anyone calls them done.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 pr-0 sm:grid-cols-2 sm:pr-24 lg:grid-cols-4 lg:pr-0">
          {SKILL_GROUPS.map((group) => (
            <article
              key={group.title}
              className="reveal rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition hover:ring-[#D99A2B]/40"
            >
              <h3 className="font-bold text-[#D99A2B]">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.skills.map((skill) => (
                  <li key={skill} className="flex items-center gap-2.5 text-white/85">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D99A2B]" aria-hidden="true" />
                    {skill}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

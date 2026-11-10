/** About — who Umar is, where he studies, and the short version of his story. */
import { SITE } from '../config/site';

const FACTS = [
  { label: 'Based in', value: SITE.location },
  { label: 'Studying', value: `${SITE.degree} — ${SITE.education}` },
  { label: 'Focus', value: 'Web & mobile products, end to end' },
  { label: 'Flagship', value: 'NeighborMart — live in production' },
];

export default function About() {
  return (
    <section
      id="about"
      data-section="about"
      className="relative py-28"
      aria-label="About me"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="max-w-3xl pr-0 sm:pr-24">
          <h2 className="reveal text-3xl font-black tracking-tight text-white sm:text-5xl">
            About <span className="text-[#D99A2B]">me</span>
          </h2>
          <p className="reveal mt-6 text-base leading-relaxed text-white/75 sm:text-lg">
            I&apos;m {SITE.name}, a Software Engineering student at{' '}
            {SITE.education}. I&apos;m not just a mobile developer — I build for
            the web too, and I learn by shipping real things: a live
            marketplace, a hackathon app built in five hours, and a scraping
            tool my internship team actually used.
          </p>
          <p className="reveal mt-4 text-base leading-relaxed text-white/75 sm:text-lg">
            My rule is simple: a project isn&apos;t done when it runs on my
            machine — it&apos;s done when it&apos;s tested, verified and live
            in someone else&apos;s hands.
          </p>
          <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FACTS.map((f) => (
              <div
                key={f.label}
                className="reveal rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
              >
                <dt className="text-xs font-semibold uppercase tracking-widest text-[#D99A2B]">
                  {f.label}
                </dt>
                <dd className="mt-1.5 font-medium text-white">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

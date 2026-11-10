/**
 * Contact — frontend-only form + social links.
 *
 * Submitting opens the visitor's email app with a pre-filled message
 * (mailto:). To switch to EmailJS later: install @emailjs/browser, then
 * replace the handler below with emailjs.send(SERVICE_ID, TEMPLATE_ID, …)
 * using keys from your EmailJS dashboard — nothing else needs to change.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { CONTACT, SITE } from '../config/site';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Portfolio message from ${name || 'a visitor'}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${CONTACT.email}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const inputCls =
    'w-full rounded-xl bg-white/[0.05] px-4 py-3 text-white placeholder-white/50 ring-1 ring-white/10 transition focus:outline-none focus:ring-2 focus:ring-[#D99A2B]';

  return (
    <section
      id="contact"
      data-section="contact"
      className="relative py-28"
      aria-label="Contact me"
    >
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-12 pr-0 sm:pr-24 lg:grid-cols-2 lg:pr-0">
          <div>
            <h2 className="reveal text-3xl font-black tracking-tight text-white sm:text-5xl">
              Let&apos;s <span className="text-[#D99A2B]">talk</span>
            </h2>
            <p className="reveal mt-5 leading-relaxed text-white/70 sm:text-lg">
              Internship, job, or a freelance project — my inbox is open and I
              reply fast. Based in {SITE.location}.
            </p>
            <div className="reveal mt-8 space-y-3">
              <a
                href={`mailto:${CONTACT.email}`}
                className="block w-fit rounded-lg font-medium text-white underline decoration-[#D99A2B] decoration-2 underline-offset-4 hover:text-[#D99A2B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
              >
                ✉️ {CONTACT.email}
              </a>
              <a
                href={CONTACT.github}
                target="_blank"
                rel="noreferrer"
                className="block w-fit rounded-lg font-medium text-white underline decoration-[#D99A2B] decoration-2 underline-offset-4 hover:text-[#D99A2B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
              >
                🐙 github.com/umararif4472-arch
              </a>
              {CONTACT.linkedin && (
                <a
                  href={CONTACT.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-fit rounded-lg font-medium text-white underline decoration-[#D99A2B] decoration-2 underline-offset-4 hover:text-[#D99A2B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]"
                >
                  💼 LinkedIn
                </a>
              )}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="reveal space-y-4 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 sm:p-8"
            aria-label="Send me a message"
          >
            <div>
              <label htmlFor="cf-name" className="mb-1.5 block text-sm font-medium text-white/80">
                Your name
              </label>
              <input
                id="cf-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Jane from HR"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="cf-email" className="mb-1.5 block text-sm font-medium text-white/80">
                Your email
              </label>
              <input
                id="cf-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="cf-message" className="mb-1.5 block text-sm font-medium text-white/80">
                Message
              </label>
              <textarea
                id="cf-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={inputCls}
                placeholder="Hi Umar, we'd like to talk about…"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-[#D99A2B] px-6 py-3 text-sm font-bold text-[#071512] transition hover:bg-[#e8ab3d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Send message →
            </button>
            {sent && (
              <p className="text-center text-sm text-[#D99A2B]" role="status">
                Your email app should have opened with the message ready — just press send there. 📩
              </p>
            )}
          </form>
        </div>

        <footer className="mt-24 border-t border-white/10 pt-8 pb-4 text-center text-sm text-white/50">
          <p>
            © {new Date().getFullYear()} {SITE.name} · {SITE.location} · Built
            with React, TypeScript and one very brave rope. 🪢
          </p>
        </footer>
      </div>
    </section>
  );
}

/**
 * ============================================================================
 *  SITE CONFIG — edit everything about YOU in this one file.
 * ============================================================================
 *  Change your name, role, bio, skills, projects, experience and contact
 *  details here and the whole website updates. You never need to touch the
 *  components just to change text.
 */

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------
export const SITE = {
  /** Your full name — shown in the hero, navbar, footer and welcome bubble. */
  name: 'Umar Arif Rana',
  /** Short first name, used by the 3D guide in casual bubble lines. */
  firstName: 'Umar',
  /** Your headline role. */
  role: 'Software Engineering Student & Web/Mobile Developer',
  /** Where you are based. (Umar's hometown — Sahiwal, not Lahore!) */
  location: 'Sahiwal, Punjab, Pakistan',
  /** Your university / school. No semester/GPA is shown anywhere on purpose. */
  education: 'Riphah International University, Sahiwal',
  degree: 'BSc Software Engineering',
  /** 2–3 line bio shown in the hero and the About section. Keep it truthful! */
  bio: 'I build web and mobile products end to end — from the first sketch to a live, tested release. My marketplace NeighborMart is running in production, and I completed an IT internship at Artistic Milliners, a multinational denim manufacturer.',
  /** One-line availability note shown as a pill in the hero. */
  availability: 'Available for internships, jobs & freelance projects',
  /** Used in <title>, meta description and Open Graph tags. */
  siteTitle: 'Umar Arif Rana — Web & Mobile Developer',
  siteDescription:
    'Portfolio of Umar Arif Rana, a Software Engineering student and web/mobile developer from Sahiwal, Punjab, Pakistan. Creator of NeighborMart, a live marketplace app.',
};

// ---------------------------------------------------------------------------
// Contact + socials
// ---------------------------------------------------------------------------
export const CONTACT = {
  email: 'umararif4472@gmail.com',
  github: 'https://github.com/umararif4472-arch',
  /**
   * TODO: paste your real LinkedIn profile URL here, e.g.
   * 'https://www.linkedin.com/in/your-handle'
   * The LinkedIn button stays hidden while this is empty — we never invent
   * a profile link.
   */
  linkedin: '',
};

// ---------------------------------------------------------------------------
// Skills — grouped, exactly as shown in the Skills section
// ---------------------------------------------------------------------------
export const SKILL_GROUPS: { title: string; skills: string[] }[] = [
  { title: 'Mobile', skills: ['Flutter', 'Dart'] },
  { title: 'Web', skills: ['React', 'TypeScript', 'JavaScript', 'Django', 'Flask'] },
  {
    title: 'Backend & Data',
    skills: ['Firebase / Firestore', 'Node.js', 'REST APIs'],
  },
  {
    title: 'Tools & Craft',
    skills: ['Python', 'Web Scraping', 'Git & GitHub', 'Testing & QA'],
  },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export interface Project {
  title: string;
  /** One-line summary for the card. */
  tagline: string;
  /** Longer text for the detail modal. */
  description: string;
  tech: string[];
  /** Live/demo link (optional). */
  liveUrl?: string;
  /** Source code link (optional). */
  codeUrl?: string;
  /**
   * Screenshot path, e.g. '/projects/neighbormart.png'.
   * Drop real screenshots into the `public/projects/` folder and set the
   * path here — until then a branded gradient cover is shown instead.
   */
  image?: string;
  /** Two CSS colours for the gradient placeholder cover. */
  gradient: [string, string];
  /** Emoji-free short label drawn on the placeholder cover. */
  coverLabel: string;
}

export const PROJECTS: Project[] = [
  {
    title: 'NeighborMart',
    tagline: 'A 4-section local marketplace for borrowing, renting and selling — live in production.',
    description:
      'NeighborMart is a complete marketplace (Flutter app + React web) with four sections — Items & Tools, Vehicles, Properties and Arenas & Venues — where neighbours borrow, rent and sell in PKR. It runs on Firebase with Cloudinary photo uploads, trust scores, an admin moderation panel and a fully verified test suite (500+ automated tests across app and web). I designed, built and shipped it solo.',
    tech: ['Flutter', 'React', 'TypeScript', 'Firebase', 'Cloudinary'],
    liveUrl: 'https://neighbormart-7eff0.web.app',
    codeUrl: 'https://github.com/umararif4472-arch/neighbormart',
    gradient: ['#0b3b36', '#D99A2B'],
    coverLabel: 'NM',
  },
  {
    title: 'HomeSplit (SharedNest)',
    tagline: 'Shared-living expense splitter built in 5 hours at the Riphah Computing Challenge Cup.',
    description:
      'HomeSplit splits shared-house shopping and expenses with exact integer-paisa maths — no floating-point rounding errors, ever. It has smart settlement suggestions, payment-request confirmations for JazzCash/Easypaisa/Bank, receipt upload with a verify/dispute audit trail, and real auth (email + PIN sessions and Google sign-in). Built from scratch — Flutter app plus a zero-dependency Node API — inside a 5-hour hackathon window.',
    tech: ['Flutter', 'Dart', 'Node.js', 'REST API'],
    liveUrl: 'https://umararif4472-arch.github.io/homesplit-web/',
    codeUrl: 'https://github.com/umararif4472-arch/HomeSplit',
    gradient: ['#123c33', '#7fb069'],
    coverLabel: 'HS',
  },
  {
    title: 'Target Reviews Scraper',
    tagline: 'API-first Python/Flask scraper built during my Artistic Milliners IT internship.',
    description:
      'During my IT internship at Artistic Milliners I built this scraper for free instead of paying for scraping services. Instead of driving a browser that gets blocked, it calls the site’s own public APIs directly, extracting 581+ product reviews into clean spreadsheets — a $0/month pipeline replacing tools that cost $16–250/month.',
    tech: ['Python', 'Flask', 'curl_cffi', 'pandas'],
    codeUrl: 'https://github.com/umararif4472-arch/target-reviews-scraper',
    gradient: ['#402b0b', '#D99A2B'],
    coverLabel: 'TS',
  },
  {
    title: 'Dental Clinic',
    tagline: 'Full-stack dental clinic website — React front end, Django back end.',
    description:
      'A complete clinic website with a React front end and a Django back end: services, doctor listings, appointment flows and a real database behind it. One of my full-stack web projects, built with a clean front-end/back-end split.',
    tech: ['React', 'Django', 'JavaScript', 'Python'],
    codeUrl: 'https://github.com/umararif4472-arch/Dental-Clinic',
    gradient: ['#0d2f3a', '#4fb0c6'],
    coverLabel: 'DC',
  },
  {
    title: 'PatternLab',
    tagline: 'Flutter architecture lab — Riverpod + Bloc side by side, offline-first.',
    description:
      'PatternLab is my testing ground for professional Flutter architecture: feature-first clean architecture, Riverpod code generation next to Bloc/Cubit, Dio interceptors, an offline-first cache, and a Firebase-ready auth seam. Verified with static analysis and tests — it is where I prove patterns before they go into real products.',
    tech: ['Flutter', 'Dart', 'Riverpod', 'Bloc'],
    codeUrl: 'https://github.com/umararif4472-arch/pattern-lab',
    gradient: ['#2a2140', '#8f7ff5'],
    coverLabel: 'PL',
  },
];

// ---------------------------------------------------------------------------
// Experience / journey
// ---------------------------------------------------------------------------
export interface ExperienceItem {
  role: string;
  place: string;
  period: string;
  points: string[];
}

export const EXPERIENCE: ExperienceItem[] = [
  {
    role: 'IT Intern',
    place: 'Artistic Milliners — IT Department',
    period: 'Internship',
    points: [
      'Worked inside the IT department of a multinational denim manufacturer.',
      'Built the Target Reviews Scraper (Python/Flask) that the team used — delivered for free instead of a paid scraping service.',
      'Published the project openly on GitHub.',
    ],
  },
  {
    role: 'Independent Product Developer',
    place: 'NeighborMart',
    period: 'Ongoing',
    points: [
      'Designed, built and shipped a complete live marketplace solo — Flutter app, React web, Firebase backend.',
      'Full product craft: branding, trust scores, moderation/admin panel, dark mode, 500+ automated tests.',
      'Live in production today.',
    ],
  },
  {
    role: 'Hackathon Builder',
    place: 'Riphah Computing Challenge Cup (RC3), Lahore',
    period: 'November 2026',
    points: [
      'Competed in the Web / Mobile App Development track.',
      'Built HomeSplit — a full-stack shared-living app with exact money maths — in a 5-hour window.',
    ],
  },
  {
    role: 'Software Engineering Student',
    place: 'Riphah International University, Sahiwal',
    period: 'Ongoing',
    points: [
      'Studying Software Engineering at Riphah International University, Sahiwal.',
      'Strong, working projects across almost all subjects so far — web, mobile, databases and more.',
    ],
  },
];

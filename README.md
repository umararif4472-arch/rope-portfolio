# 🪢 Rope Portfolio — Umar Arif Rana

A portfolio website with a twist: a **3D character hangs from a physics rope**,
welcomes you, follows you as you scroll, explains every section in a speech
bubble — and **gets scared if you scroll too fast**.

**Live:** https://rope-portfolio.web.app/ (Firebase Hosting)
**Code:** https://github.com/umararif4472-arch/rope-portfolio

Built with React + Vite + TypeScript, Three.js (@react-three/fiber + drei),
GSAP + ScrollTrigger, Lenis smooth scrolling, Zustand and Tailwind CSS.

---

## Quick start

```bash
npm install     # install dependencies
npm run dev     # start the dev server (http://localhost:5173)
npm run build   # production build (type-checks first) → dist/
npm run preview # preview the production build locally
```

## What you need to provide

| Item | Where it goes | Status |
| --- | --- | --- |
| **Your rigged model** `model.glb` with animation clips | `public/model.glb` | ⏳ not yet — a charming procedural character covers for it |
| **LinkedIn URL** | `src/config/site.ts` → `CONTACT.linkedin` | ⏳ empty (button hidden until filled) |
| **Real project screenshots** | `public/projects/*.png` + set `image` in `src/config/site.ts` | ⏳ gradient covers shown until then |
| **EmailJS keys** (optional) | only if you replace the mailto form — see `src/sections/Contact.tsx` | optional |

Everything personal is pre-filled with Umar's real info (name, role, bio,
Sahiwal hometown, Riphah International University Sahiwal, projects,
experience, email, GitHub).

## Folder map

```
src/
  config/     ← EDIT THESE: site.ts (your info) + character.ts (all behaviour)
  store/      useStore.ts — Zustand state + character screen-position ref
  hooks/      useGuideDirector.ts (fast-scroll brain), lenisRef.ts
  three/      Scene.tsx (canvas), RopeCharacter.tsx (spring follow + tube),
              RopeSim.ts (verlet rope), CharacterModel.tsx (GLB + fallback),
              ProceduralCharacter.tsx (the stand-in character)
  components/ Navbar, SpeechBubble, LoadingScreen, ProjectModal, FallbackGuide
  sections/   Hero, About, Skills, Projects, Experience, Contact
public/       model.glb goes here · guide-fallback.webp · favicon.svg
scripts/      deploy-firebase.mjs (Firebase Hosting REST deploy)
.github/      optional backup workflow → GitHub Pages
```

## Editing the site (no component surgery needed)

- **Your info, projects, skills, experience:** `src/config/site.ts`
- **Bubble texts per section:** `src/config/character.ts` → `SECTIONS`
- **How easily he gets scared:** `FAST_SCROLL.velocityThreshold`
  (lower = scares sooner), cooldowns, catch-up delay and the scared lines
  are right next to it.
- **Follow feel:** `FOLLOW.stiffness` / `FOLLOW.damping`; rope look in `ROPE`.
- **Bubble timings:** `BUBBLE` (welcome 5 s, sections 6 s, typewriter speed).

## Your own 3D model (Mixamo → .glb)

You don't need to model anything from scratch:

1. Go to [mixamo.com](https://www.mixamo.com) (free Adobe account) and pick a
   character you like.
2. Download it as **FBX Binary**, skin **With Skin**, at 30 fps.
3. For animations (Idle, Waving, Pointing, Nodding, Thumbs Up, Scared/
   Trembling, Swinging), search Mixamo's animation library, preview each on
   your character, and download each as FBX (**Without Skin** for pure
   animations after the first).
4. Open **Blender** (free), import the character FBX, then import each
   animation FBX and copy its action onto the character's armature. Rename
   each Action to match the names in `CLIPS` (Idle, Wave, Point, Nod,
   ThumbsUp, Scared, Swing) in `src/config/character.ts`.
5. Export: File → Export → **glTF 2.0 (.glb)**, tick "Include Animations",
   and enable Draco compression if offered (the loader is Draco-ready).
6. Save the file as **`public/model.glb`**, rebuild, done — the site uses it
   automatically. Clip named differently? Just update the `CLIPS` map in
   `src/config/character.ts`; missing clips fall back to procedural bone
   animation, and a missing/broken file falls back to the built-in
   procedural character.

## How the guide works (30-second tour)

- **Rope:** a custom **verlet simulation** (`RopeSim.ts`) — a chain of
  points pinned at the top, solved with distance constraints. We chose this
  over rapier/cannon-es: one rope doesn't need a physics engine, and this
  is ~100 lines with zero bundle cost. The rope is rendered as a
  TubeGeometry rebuilt each frame, and its target length eases, so you can
  *see* it stretch and shorten between sections.
- **Follow:** a spring (stiffness/damping in config) pulls the rope length
  toward the active section's `hangDepth`. GSAP ScrollTrigger detects the
  section; Lenis provides smooth scrolling **and** the velocity reading.
- **Scared mode:** if |velocity| > threshold, the follow target freezes
  (he lags), the rope's sway force spikes, and after a random 0.8–1.5 s he
  catches up, plays `scared`, and shouts a random scared line — at most
  once per 4 s. After 2 calm seconds he relaxes with a "Phew…" line.
- **Bubble:** a DOM overlay (not drei Html) moved by direct style transforms
  from the character's projected screen position — crisp text, aria-live
  for screen readers, no React re-renders at 60 fps.
- **The face you see (fix pass 3):** the visible guide is Umar's *actual*
  3D-avatar render (`public/guide-fallback.webp`) in a gold-ringed round
  medallion (`GuideMedallion.tsx`) that hangs from the rope's end point —
  exact likeness, because it is his real picture. Moods become small
  medallion dances (gentle sway, greeting wiggle/dip, scared shake). It is
  a picture, not a rigged 3D model: set `CHARACTER.useImageGuide = false`
  in `src/config/character.ts` to switch back to the 3D character
  (procedural shapes, or your own `model.glb` — that code path is kept,
  dormant, and takes over automatically when the file exists and the
  flag is off).
- **Always on screen — guaranteed:** every frame, the medallion's hook
  position is hard-clamped so the whole medallion (metal ring included)
  stays at least `CHARACTER.edgeMarginPx` (8 px) inside the viewport on
  all four sides — during section glides, fast scrolling and the scared
  shake alike. While clamped he waits at the edge, fully visible, until
  the section target comes back into range (the rope length adjusts via
  the follow spring), and a small SVG segment in the overlay bridges any
  gap between the 3D rope's end and his hook so he always looks attached.

## Performance & accessibility notes

- `dpr={[1, 1.75]}` caps pixel ratio; GLB geometries/materials are disposed
  on unmount; rendering pauses when the tab is hidden (`visibilitychange`).
- `frameloop` stays `"always"` *while visible* because a physics sim needs
  continuous frames — `"demand"` mode would freeze the rope between
  invalidations. This trade-off is deliberate.
- `prefers-reduced-motion`: no swinging, no scared shaking — smooth fades
  only; Lenis smoothing is disabled too.
- If WebGL fails entirely, a 2D fallback guide (`guide-fallback.webp`, his
  3D-avatar portrait) takes over with the same section texts.
- Keyboard accessible nav/cards/modal (Esc closes), skip-to-content link,
  aria labels on interactive elements, alt text on images.

## Deployment

### Firebase Hosting (primary — this is what's live)

The portfolio runs as a **second Hosting site** (`rope-portfolio`) on
Umar's existing Firebase project `neighbormart-7eff0` (Spark/free) — the
NeighborMart site itself is untouched.

```bash
npm run build
node scripts/deploy-firebase.mjs --site rope-portfolio
```

The script uses the Firebase Hosting REST API with the service-account key
at `~/.config/neighbormart/service-account.json` (firebase-tools rejects
service-account auth on this machine — that's why the REST script exists).

### GitHub Pages (backup)

A ready workflow lives in `.github/workflows/deploy.yml` — it builds with
`VITE_BASE=/rope-portfolio/` and deploys on push to `main`:
https://umararif4472-arch.github.io/rope-portfolio/

### Vercel

Import the repo at vercel.com/new → framework preset **Vite** → build
command `npm run build`, output `dist`. No env vars needed (base stays `/`).

### Netlify

New site from Git → build command `npm run build`, publish directory
`dist`. The current one-page site works as-is; if you add client-side
routes later, add a `public/_redirects` file containing
`/* /index.html 200`.

---

© Umar Arif Rana — built with React, Three.js and one very brave rope. 🪢

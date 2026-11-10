/**
 * Shared handle to the single Lenis instance (created in App.tsx).
 * Navbar and anything else that needs programmatic smooth scrolling
 * imports this instead of creating a second Lenis.
 */
import type Lenis from 'lenis';

export const lenisRef: { current: Lenis | null } = { current: null };

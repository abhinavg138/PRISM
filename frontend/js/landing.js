/**
 * ============================================================================
 * PRISM — Minimal Landing Page Controller (v4)
 * Handles interactive wordmark trigger, light refraction transition, and redirect.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  const trigger = document.getElementById('prism-hero-trigger');
  if (!trigger) return;

  let isNavigating = false;

  function triggerTransition(e) {
    if (e) {
      e.preventDefault();
    }
    if (isNavigating) return;
    isNavigating = true;

    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      window.location.href = '/login';
      return;
    }

    // Trigger visual light refraction sweep and scale exit
    document.body.classList.add('prism-transitioning');

    // Smooth, prompt hand-off to the simulated login portal (480ms)
    setTimeout(() => {
      window.location.href = '/login';
    }, 480);
  }

  // Mouse & Touch interactions
  trigger.addEventListener('click', triggerTransition);

  // Keyboard accessibility: Enter & Space
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      triggerTransition(e);
    }
  });
});

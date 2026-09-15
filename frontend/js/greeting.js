/**
 * ============================================================================
 * PRISM — Multilingual Welcome Greeting Component (v5)
 * Cycles through "Welcome" greetings in 20 major Indian & global languages.
 * Smooth crossfade transitions with no layout shifts and font fallbacks.
 * ============================================================================
 */

export const GREETINGS = [
  { lang: 'Hindi', text: 'नमस्ते' },
  { lang: 'English', text: 'Welcome' },
  { lang: 'Bengali', text: 'স্বাগতম' },
  { lang: 'Tamil', text: 'வரவேற்பு' },
  { lang: 'Telugu', text: 'స్వాగతం' },
  { lang: 'Marathi', text: 'स्वागत आहे' },
  { lang: 'Gujarati', text: 'સ્વાગત છે' },
  { lang: 'Kannada', text: 'ಸ್ವಾಗತ' },
  { lang: 'Malayalam', text: 'സ്വാഗതം' },
  { lang: 'Punjabi', text: 'ਜੀ ਆਇਆਂ ਨੂੰ' },
  { lang: 'Odia', text: 'ସ୍ୱାଗତ' },
  { lang: 'Assamese', text: 'স্বাগতম' },
  { lang: 'Urdu', text: 'خوش آمدید' },
  { lang: 'Sanskrit', text: 'स्वागतम्' },
  { lang: 'French', text: 'Bienvenue' },
  { lang: 'Spanish', text: 'Bienvenido' },
  { lang: 'German', text: 'Willkommen' },
  { lang: 'Japanese', text: 'ようこそ' },
  { lang: 'Arabic', text: 'أهلاً وسهلاً' },
  { lang: 'Mandarin', text: '欢迎' }
];

export function initMultilingualGreeting(containerId = 'multilingual-greeting') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const textEl = container.querySelector('.greeting-text');
  const langEl = container.querySelector('.greeting-lang');

  if (!textEl) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    textEl.textContent = 'Welcome';
    if (langEl) langEl.textContent = 'English';
    return;
  }

  let currentIndex = 0;

  function showNextGreeting() {
    currentIndex = (currentIndex + 1) % GREETINGS.length;
    const item = GREETINGS[currentIndex];

    // Fade out / slide up
    container.classList.add('greeting-transitioning');

    setTimeout(() => {
      textEl.textContent = item.text;
      if (langEl) {
        langEl.textContent = item.lang;
      }
      // Fade in
      container.classList.remove('greeting-transitioning');
    }, 220);
  }

  // Set initial greeting
  const initial = GREETINGS[0];
  textEl.textContent = initial.text;
  if (langEl) langEl.textContent = initial.lang;

  // Cycle every 1.8 seconds
  const intervalId = setInterval(showNextGreeting, 1800);

  return () => clearInterval(intervalId);
}

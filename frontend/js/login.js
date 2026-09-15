/**
 * ============================================================================
 * PRISM — Simplified Simulated Portal Sign-In Controller (v5)
 * Prototype Demonstration for SIH 2026 (SIH26103)
 * Simplified direct login with show/hide password and animated multilingual greeting.
 * ============================================================================
 */

import { initMultilingualGreeting } from './greeting.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lucide Icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 2. Initialize Multilingual Welcome Greeting Cycle
  initMultilingualGreeting('multilingual-greeting');

  const form = document.getElementById('simulated-login-form');
  const usernameInput = document.getElementById('input-username');
  const passwordInput = document.getElementById('input-password');
  const rememberCheckbox = document.getElementById('checkbox-remember');
  const alertBox = document.getElementById('login-alert');
  const alertText = document.getElementById('login-alert-text');
  const togglePasswordBtn = document.getElementById('btn-toggle-password');
  const togglePasswordIcon = document.getElementById('icon-toggle-password');
  const submitBtn = document.getElementById('btn-login-submit');

  // 3. Pre-fill with saved session username if available
  try {
    const saved = localStorage.getItem('prism_demo_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.username && !usernameInput.value) {
        usernameInput.value = parsed.username;
      }
    }
  } catch (err) {
    console.warn('[PRISM Login] Could not read saved session:', err);
  }

  // 4. Password Show / Hide Visibility Toggle
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';

      togglePasswordBtn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      if (togglePasswordIcon) {
        togglePasswordIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    });
  }

  // 5. Form Submission & Simulated Authentication
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    hideAlert();

    const username = usernameInput?.value.trim() || '';
    const password = passwordInput?.value.trim() || '';
    const remember = rememberCheckbox?.checked ?? true;

    // Inline validation: Ensure non-empty
    if (!username) {
      showAlert('Please enter a username.');
      usernameInput?.focus();
      return;
    }

    if (!password) {
      showAlert('Please enter a password.');
      passwordInput?.focus();
      return;
    }

    // Indicate loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Entering PRISM...</span>
    `;

    // Persist simulated credentials in localStorage (default to MoSPI National Oversight role)
    const sessionData = {
      username,
      roleId: 'role-mospi',
      roleName: 'MoSPI National Oversight',
      remember,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('prism_logged_in', 'true');
      localStorage.setItem('prism_demo_user', JSON.stringify(sessionData));
    } catch (err) {
      console.error('[PRISM Login] Storage error:', err);
    }

    // Frictionless redirection to post-login orientation home page
    setTimeout(() => {
      window.location.href = '/home';
    }, 350);
  });

  function showAlert(msg) {
    if (alertBox && alertText) {
      alertText.textContent = msg;
      alertBox.classList.remove('hidden');
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  }

  function hideAlert() {
    if (alertBox) {
      alertBox.classList.add('hidden');
    }
  }
});

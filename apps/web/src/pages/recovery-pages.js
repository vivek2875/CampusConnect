import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';

export function renderResetPasswordPage(navigate) {
  const token = new URLSearchParams(window.location.search).get('token');
  const page = recoveryShell('Choose a new password', 'Your new password must be different and strong.');
  const panel = page.querySelector('[data-recovery-content]');
  panel.innerHTML = `
    <form class="stack" novalidate>
      <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required /></label>
      <button class="button button--primary" type="submit">Update password</button>
      <p class="form-message" hidden></p>
    </form>`;
  const form = panel.querySelector('form');
  const message = panel.querySelector('.form-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = new FormData(form).get('password')?.toString() || '';
    const confirmation = new FormData(form).get('confirmPassword')?.toString() || '';
    if (!token) return setFormMessage(message, 'This reset link is invalid or incomplete.');
    if (password !== confirmation) return setFormMessage(message, 'Passwords do not match.');
    if (!form.reportValidity()) return;
    try {
      await apiClient.resetPassword({ token, password });
      navigate('/login');
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to reset your password.');
    }
  });
  return page;
}

export function renderVerifyEmailPage(navigate) {
  const token = new URLSearchParams(window.location.search).get('token');
  const page = recoveryShell('Verifying your email', 'Please wait while we securely confirm your email address.');
  const panel = page.querySelector('[data-recovery-content]');
  const message = createElement('p', { className: 'form-message', text: 'Verifying your email…' });
  panel.append(message);
  if (!token) {
    setFormMessage(message, 'This verification link is invalid or incomplete.');
    return page;
  }
  apiClient
    .verifyEmail(token)
    .then(() => {
      page.querySelector('.recovery-card h1').textContent = 'Verification completed';
      setFormMessage(message, 'Your email address is verified. Redirecting you to sign in…', 'success');
      window.setTimeout(() => navigate('/login'), 1_200);
    })
    .catch((error) => setFormMessage(message, error.message || 'Unable to verify this email address.'));
  return page;
}

function recoveryShell(title, description) {
  const page = createElement('section', { className: 'recovery-layout' });
  page.innerHTML = `
    <a class="brand brand--dark" href="/" data-link><span class="brand__mark">C</span>CampusConnect</a>
    <section class="recovery-card"><p class="eyebrow">Secure account access</p><h1>${title}</h1><p class="muted">${description}</p><div data-recovery-content></div></section>`;
  return page;
}

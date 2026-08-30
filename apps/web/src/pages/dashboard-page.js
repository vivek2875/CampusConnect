import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';
import { createCampusLayout } from './campus-layout.js';

export function renderDashboardPage(navigate) {
  const session = sessionStore.get();
  const { page, content } = createCampusLayout({ active: 'overview', navigate });
  const verificationActions = session.user.emailVerified
    ? ''
    : '<button class="button button--secondary" data-resend>Send verification email</button><p class="form-message" data-status hidden></p>';
  content.innerHTML = `<p class="eyebrow">Your campus</p><h1>Welcome, <span data-name></span>.</h1><p class="muted">Your account is ready for the CampusConnect experience.</p><section class="dashboard-grid"><article class="profile-card"><h2>Account</h2><dl><div><dt>Institution email</dt><dd data-email></dd></div><div><dt>Role</dt><dd data-role></dd></div><div><dt>Email status</dt><dd data-verification></dd></div></dl>${verificationActions}</article><article class="next-card"><span class="icon-disc">→</span><h2>Marketplace is ready</h2><p>Find second-hand essentials, discover great value, and post items your campus needs.</p><a class="button button--secondary" href="/marketplace" data-link>Explore Marketplace</a></article></section>`;

  page.querySelector('[data-name]').textContent = session.user.firstName;
  page.querySelector('[data-email]').textContent = session.user.email;
  page.querySelector('[data-role]').textContent = roleLabel(session.user.role);
  const verification = page.querySelector('[data-verification]');
  verification.textContent = session.user.emailVerified ? 'Verified' : 'Verification required';
  verification.className = session.user.emailVerified ? 'status status--good' : 'status status--warning';

  const resendButton = page.querySelector('[data-resend]');
  const statusMessage = page.querySelector('[data-status]');
  if (resendButton && statusMessage) {
    resendButton.addEventListener('click', async () => {
      resendButton.disabled = true;
      try {
        const result = await apiClient.resendVerification();
        if (result.deliveryMode === 'preview') {
          setFormMessage(
            statusMessage,
            'Email delivery is not configured locally. Add SMTP settings before expecting a message in Gmail.',
            'info',
          );
        } else if (result.deliveryMode === 'not_needed') {
          setFormMessage(statusMessage, 'This email address is already verified.', 'success');
        } else {
          setFormMessage(statusMessage, 'A new verification email has been sent.', 'success');
        }
      } catch (error) {
        setFormMessage(statusMessage, error.message || 'Unable to send a verification email.');
      } finally {
        resendButton.disabled = false;
      }
    });
  }

  return page;
}

function roleLabel(role) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
